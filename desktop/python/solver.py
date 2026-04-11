"""
時間割最適化ソルバー — Google OR-Tools CP-SAT
フロントエンドの useTimetableStore と同じデータ構造を受け取り、
最適化された時間割エントリのリストを返す。

ハード制約（必ず守る）:
  - 教科ごとの週あたり必要コマ数
  - 各クラス・各スロットに最大1教科
  - 教員（グループ含む）の同時間帯重複禁止
  - 教員の出勤不可時間
  - 固定コマ（fixed_slots）・既存コマ（existing_timetable）
  - 合同クラス（class_groups）の同期
  - 連続配置（subject_sequences）の保証

ソフト制約（できれば守る）:
  - 教員を可能な限り割り当てる（未割り当て最小化）
  - subject_constraints の max_consecutive_days 超過を減らす
  - 教員の1日最大コマ数・連続コマ数
  - 教科の配置可能時限・1日最大・午後上限・午後分散・全体分散
"""

from ortools.sat.python import cp_model  # type: ignore

DAYS = ['月', '火', '水', '木', '金']
PERIODS = [1, 2, 3, 4, 5, 6]
NUM_DAYS = len(DAYS)
NUM_PERIODS = len(PERIODS)


def run(
    teachers: list,
    structure: dict,
    subject_constraints: dict,
    fixed_slots: list = None,
    teacher_constraints: dict = None,
    subject_placement: dict = None,
    lunch_after_period: int = 4,
    facilities: list = None,
    subject_facility: dict = None,
    alt_week_pairs: list = None,        # 隔週授業ペア: [{class_key, subject_a, subject_b, count}]
    cross_grade_groups: list = None,    # 複数学年合同授業: [{name, participants:[{grade,class_name}], subject, count}]
    class_groups: list = None,          # 合同クラス: [{id, grade, classes:[class_name], split_subjects:[subject]}]
    subject_sequences: list = None,     # 連続配置ペア: [{id, grade, class_name, subject_a, subject_b}]
    teacher_groups: list = None,        # 教員グループ: [{id, name, subjects:[], target_grades:[]}]
    existing_timetable: list = None,    # 既存コマ（空きコマ埋めモード）: [{grade,class_name,day_of_week,period,subject,...}]
    time_limit: int = 60,
) -> tuple[list | None, str | None]:
    """
    時間割を計算して返す。

    Returns:
        (timetable_entries, error_message)
    """
    model = cp_model.CpModel()

    # 午後判定セット（1-indexed period値）
    pm_periods_set = {p for p in PERIODS if p > lunch_after_period}
    # period index (0-indexed) → afternoon?
    pm_idx_set = {i for i, p in enumerate(PERIODS) if p > lunch_after_period}

    # ------------------------------------------------------------------ #
    # 1. インデックス構築
    # ------------------------------------------------------------------ #
    classes: list[tuple] = []
    for g in structure.get("grades", []):
        grade = g["grade"]
        for cn in g.get("classes", []):
            classes.append((grade, cn, f"{grade}_通常"))
        for cn in g.get("special_classes", []):
            classes.append((grade, cn, f"{grade}_特支"))

    if not classes:
        return None, "クラスが登録されていません。マスタ設定を確認してください。"

    subject_set: set[str] = set()
    required_hours: dict = structure.get("required_hours", {})
    for hours in required_hours.values():
        subject_set.update(hours.keys())

    if not subject_set:
        return None, "教科が登録されていません。マスタ設定を確認してください。"

    subjects = sorted(subject_set)

    # 教員グループを含む「担当可能エンティティ」リストを構築
    # all_assignable[i] = { id, is_group, subjects, target_grades, unavailable_times }
    all_assignable = []
    for t in teachers:
        all_assignable.append({
            "id": t["id"],
            "is_group": False,
            "subjects": t.get("subjects", []),
            "target_grades": t.get("target_grades", []),
            "unavailable_times": t.get("unavailable_times", []),
            "_original": t,
        })
    for g in (teacher_groups or []):
        all_assignable.append({
            "id": g["id"],
            "is_group": True,
            "subjects": g.get("subjects", []),
            "target_grades": g.get("target_grades", []),
            "unavailable_times": [],
            "_original": g,
        })

    NUM_ASSIGNABLE = len(all_assignable)

    # ------------------------------------------------------------------ #
    # 2. ヘルパー
    # ------------------------------------------------------------------ #
    def can_teach(a: dict, subject: str, grade: int) -> bool:
        """担当可能エンティティが特定の教科・学年を担当できるか判定"""
        if a["is_group"]:
            # グループ: subjects が設定されていれば一致チェック、target_grades も同様
            grp_subjects = a["subjects"]
            grp_grades = a["target_grades"]
            if not grp_subjects:
                return False  # 教科未設定のグループは使用しない
            if subject not in grp_subjects:
                return False
            if grp_grades and grade not in grp_grades:
                return False
            return True
        else:
            # 個別教員（既存ロジック）
            if subject not in a["subjects"]:
                return False
            if "特別支援" in a["subjects"]:
                return True
            return grade in a["target_grades"]

    def is_unavailable(a: dict, day_idx: int, period: int) -> bool:
        """担当不可時間チェック（グループは制約なし）"""
        return any(
            u["day_of_week"] == DAYS[day_idx] and u["period"] == period
            for u in a.get("unavailable_times", [])
        )

    def get_fixed_class_indices(slot: dict) -> list[int]:
        """固定コマの適用対象クラスインデックスを返す"""
        scope = slot.get("scope", "class")
        result = []
        for c_idx, (grade, class_name, _) in enumerate(classes):
            if scope == "all":
                result.append(c_idx)
            elif scope == "grade" and grade == slot.get("grade"):
                result.append(c_idx)
            elif scope == "class" and grade == slot.get("grade") and class_name == slot.get("class_name"):
                result.append(c_idx)
        return result

    # ------------------------------------------------------------------ #
    # 3. 決定変数
    # ------------------------------------------------------------------ #
    assign: dict = {}
    for d in range(NUM_DAYS):
        for p in range(NUM_PERIODS):
            for c, (grade, class_name, class_key) in enumerate(classes):
                for s, subject in enumerate(subjects):
                    for a, assignable in enumerate(all_assignable):
                        if not can_teach(assignable, subject, grade):
                            continue
                        if is_unavailable(assignable, d, PERIODS[p]):
                            continue
                        v = model.NewBoolVar(f"a_{d}_{p}_{c}_{s}_{a}")
                        assign[(d, p, c, s, a)] = v

    no_teach: dict = {}
    for d in range(NUM_DAYS):
        for p in range(NUM_PERIODS):
            for c in range(len(classes)):
                for s in range(len(subjects)):
                    no_teach[(d, p, c, s)] = model.NewBoolVar(f"nt_{d}_{p}_{c}_{s}")

    # ------------------------------------------------------------------ #
    # 4. ハード制約
    # ------------------------------------------------------------------ #

    # 4-a. 各スロットに最大1教科
    for d in range(NUM_DAYS):
        for p in range(NUM_PERIODS):
            for c in range(len(classes)):
                slot_vars = [no_teach[(d, p, c, s)] for s in range(len(subjects))]
                for s in range(len(subjects)):
                    for a in range(NUM_ASSIGNABLE):
                        if (d, p, c, s, a) in assign:
                            slot_vars.append(assign[(d, p, c, s, a)])
                model.AddAtMostOne(slot_vars)

    # ------------------------------------------------------------------ #
    # 4-f. 隔週授業ペア変数の生成（4-b の前に行う）
    # alt_tag[(pair_idx, d, p, c)] = 1: そのスロットを隔週ペアのA週スロットとして使用
    # ------------------------------------------------------------------ #
    alt_tag: dict = {}      # {(pair_idx, d, p, c): BoolVar}
    # pair ごとの対象クラスインデックスリスト
    pair_class_indices: dict = {}  # pair_idx -> [c_idx, ...]

    for pair_idx, pair in enumerate(alt_week_pairs or []):
        ck  = pair.get("class_key", "")
        s_a_name = pair.get("subject_a", "")
        s_b_name = pair.get("subject_b", "")
        count_p  = int(pair.get("count", 0))
        if s_a_name not in subjects or s_b_name not in subjects:
            continue
        s_a = subjects.index(s_a_name)

        c_indices = [i for i, (_, _, class_key) in enumerate(classes) if class_key == ck]
        pair_class_indices[pair_idx] = c_indices

        for c_idx in c_indices:
            tag_vars_for_pair_class = []
            for d in range(NUM_DAYS):
                for p in range(NUM_PERIODS):
                    v = model.NewBoolVar(f"alt_{pair_idx}_{c_idx}_{d}_{p}")
                    alt_tag[(pair_idx, d, p, c_idx)] = v
                    tag_vars_for_pair_class.append(v)
                    # タグが立つ → そのスロットに subject_a が配置されていること
                    subj_a_at = [no_teach[(d, p, c_idx, s_a)]]
                    for a in range(NUM_ASSIGNABLE):
                        if (d, p, c_idx, s_a, a) in assign:
                            subj_a_at.append(assign[(d, p, c_idx, s_a, a)])
                    model.Add(sum(subj_a_at) >= 1).OnlyEnforceIf(v)
            # このクラスの隔週スロット数をちょうど count に
            model.Add(sum(tag_vars_for_pair_class) == count_p)

    # ------------------------------------------------------------------ #
    # 4-f'. B週担当者の割り当て変数
    # alt_tag が立つスロットに subject_b を担当できる教員を割り当てる
    # ------------------------------------------------------------------ #
    assign_alt_b: dict = {}      # {(pair_idx, d, p, c_idx, a): BoolVar}
    no_teach_alt_b: dict = {}    # {(pair_idx, d, p, c_idx): BoolVar}

    for pair_idx, pair in enumerate(alt_week_pairs or []):
        s_b_name = pair.get("subject_b", "")
        if s_b_name not in subjects:
            continue
        for c_idx in pair_class_indices.get(pair_idx, []):
            grade_c = classes[c_idx][0]
            for d in range(NUM_DAYS):
                for p in range(NUM_PERIODS):
                    if (pair_idx, d, p, c_idx) not in alt_tag:
                        continue
                    atv = alt_tag[(pair_idx, d, p, c_idx)]
                    nt_v = model.NewBoolVar(f"ntaltb_{pair_idx}_{c_idx}_{d}_{p}")
                    no_teach_alt_b[(pair_idx, d, p, c_idx)] = nt_v
                    this_alt_vars = [nt_v]
                    for a, assignable in enumerate(all_assignable):
                        if not can_teach(assignable, s_b_name, grade_c):
                            continue
                        if is_unavailable(assignable, d, PERIODS[p]):
                            continue
                        v = model.NewBoolVar(f"altb_{pair_idx}_{c_idx}_{d}_{p}_{a}")
                        assign_alt_b[(pair_idx, d, p, c_idx, a)] = v
                        this_alt_vars.append(v)
                    # alt_tag が立つ → exactly 1 つ選択
                    model.Add(sum(this_alt_vars) == 1).OnlyEnforceIf(atv)
                    # alt_tag が立たない → 全て0
                    for v in this_alt_vars:
                        model.Add(v == 0).OnlyEnforceIf(atv.Not())

    # B週担当者の同時間帯重複禁止（B週どうし）
    for d in range(NUM_DAYS):
        for p in range(NUM_PERIODS):
            for a in range(NUM_ASSIGNABLE):
                b_slots = [
                    assign_alt_b[(pi, d, p, ci, a)]
                    for pi in range(len(alt_week_pairs or []))
                    for ci in pair_class_indices.get(pi, [])
                    if (pi, d, p, ci, a) in assign_alt_b
                ]
                if len(b_slots) > 1:
                    model.AddAtMostOne(b_slots)

    # ------------------------------------------------------------------ #
    # 4-g. 複数学年合同授業の同期制約
    # 参加クラス全員が同一スロットに同一教科を受けるよう強制する
    # ------------------------------------------------------------------ #
    cgx_joint_var: dict = {}      # {(grp_idx, d, p): BoolVar}
    cgx_exempt_pairs: set = set() # 合同授業グループ内で同一担当者の重複を許可
    cgx_group_class_pairs: dict = {}  # grp_idx -> list of c_idx

    for grp_idx, grp in enumerate(cross_grade_groups or []):
        s_name  = grp.get("subject", "")
        cnt_grp = int(grp.get("count", 1))
        if s_name not in subjects or cnt_grp == 0:
            continue
        s_idx = subjects.index(s_name)

        # 参加クラスのインデックスを解決
        grp_c_indices = []
        for part in grp.get("participants", []):
            p_grade = part.get("grade")
            p_class = part.get("class_name", "")
            for ci, (g, cn, _ck) in enumerate(classes):
                if g == p_grade and cn == p_class:
                    grp_c_indices.append(ci)
                    break
        if len(grp_c_indices) < 2:
            continue
        cgx_group_class_pairs[grp_idx] = grp_c_indices

        # 各スロットの「合同フラグ」BoolVar を生成
        slot_vars_for_grp = []
        for d in range(NUM_DAYS):
            for p in range(NUM_PERIODS):
                jv = model.NewBoolVar(f"jgrp_{grp_idx}_{d}_{p}")
                cgx_joint_var[(grp_idx, d, p)] = jv
                slot_vars_for_grp.append(jv)

                # 代表クラス(grp_c_indices[0])の当該教科スロット変数を集計
                c0 = grp_c_indices[0]
                c0_slots = []
                if (d, p, c0, s_idx) in no_teach:
                    c0_slots.append(no_teach[(d, p, c0, s_idx)])
                for a in range(NUM_ASSIGNABLE):
                    if (d, p, c0, s_idx, a) in assign:
                        c0_slots.append(assign[(d, p, c0, s_idx, a)])

                if c0_slots:
                    model.Add(sum(c0_slots) >= 1).OnlyEnforceIf(jv)
                    model.Add(sum(c0_slots) == 0).OnlyEnforceIf(jv.Not())

                # 他クラスも代表クラスと同期
                for ci in grp_c_indices[1:]:
                    ci_slots = []
                    if (d, p, ci, s_idx) in no_teach:
                        ci_slots.append(no_teach[(d, p, ci, s_idx)])
                    for a in range(NUM_ASSIGNABLE):
                        if (d, p, ci, s_idx, a) in assign:
                            ci_slots.append(assign[(d, p, ci, s_idx, a)])
                    if ci_slots and c0_slots:
                        model.Add(sum(ci_slots) >= 1).OnlyEnforceIf(jv)
                        model.Add(sum(ci_slots) == 0).OnlyEnforceIf(jv.Not())

                # 合同スロットでは同一担当者が複数クラスに割り当て可 → exempt 登録
                for a in range(NUM_ASSIGNABLE):
                    for ci in grp_c_indices:
                        if (d, p, ci, s_idx, a) in assign:
                            cgx_exempt_pairs.add((d, p, ci, s_idx, a))

        # 合同授業のコマ数をちょうど count に
        model.Add(sum(slot_vars_for_grp) == cnt_grp)

    # ------------------------------------------------------------------ #
    # 4-h. 合同クラス（class_groups）の同期制約
    # split_subjects 以外の教科は、グループ内全クラスが同一スロットで受講する
    # ------------------------------------------------------------------ #
    cg_joint_var: dict = {}   # {(cg_idx, s_idx, d, p): BoolVar}
    cg_exempt_pairs: set = set()  # 合同クラス内で同一担当者の重複を許可

    for cg_idx, cg in enumerate(class_groups or []):
        cg_grade = cg.get("grade")
        cg_classes = cg.get("classes", [])
        split_subj = cg.get("split_subjects", [])
        if len(cg_classes) < 2:
            continue

        # グループ内クラスのインデックスを解決
        cg_c_indices = []
        for cn in cg_classes:
            for ci, (g, class_name, _) in enumerate(classes):
                if g == cg_grade and class_name == cn:
                    cg_c_indices.append(ci)
                    break
        if len(cg_c_indices) < 2:
            continue

        # split_subjects 以外の教科に同期制約を追加
        for s_idx, subject in enumerate(subjects):
            if subject in split_subj:
                continue

            # 代表クラスで required_hours > 0 のものだけ処理
            c0 = cg_c_indices[0]
            grade0, _, ck0 = classes[c0]
            if (required_hours.get(ck0) or {}).get(subject, 0) == 0:
                continue

            for d in range(NUM_DAYS):
                for p in range(NUM_PERIODS):
                    jv = model.NewBoolVar(f"cgjt_{cg_idx}_{s_idx}_{d}_{p}")
                    cg_joint_var[(cg_idx, s_idx, d, p)] = jv

                    c0_slots = [no_teach[(d, p, c0, s_idx)]]
                    for a in range(NUM_ASSIGNABLE):
                        if (d, p, c0, s_idx, a) in assign:
                            c0_slots.append(assign[(d, p, c0, s_idx, a)])

                    model.Add(sum(c0_slots) >= 1).OnlyEnforceIf(jv)
                    model.Add(sum(c0_slots) == 0).OnlyEnforceIf(jv.Not())

                    for ci in cg_c_indices[1:]:
                        ci_slots = [no_teach[(d, p, ci, s_idx)]]
                        for a in range(NUM_ASSIGNABLE):
                            if (d, p, ci, s_idx, a) in assign:
                                ci_slots.append(assign[(d, p, ci, s_idx, a)])
                        model.Add(sum(ci_slots) >= 1).OnlyEnforceIf(jv)
                        model.Add(sum(ci_slots) == 0).OnlyEnforceIf(jv.Not())

                    # 合同クラス内での同一担当者重複を許可
                    for a in range(NUM_ASSIGNABLE):
                        for ci in cg_c_indices:
                            if (d, p, ci, s_idx, a) in assign:
                                cg_exempt_pairs.add((d, p, ci, s_idx, a))

    # 4-b. 教科ごとの必要コマ数（隔週ペアの subject_b 分も加算）
    for c, (grade, class_name, class_key) in enumerate(classes):
        class_req = required_hours.get(class_key, {})
        for s, subject in enumerate(subjects):
            required = class_req.get(subject, 0)
            all_slots = []
            for d in range(NUM_DAYS):
                for p in range(NUM_PERIODS):
                    all_slots.append(no_teach[(d, p, c, s)])
                    for a in range(NUM_ASSIGNABLE):
                        if (d, p, c, s, a) in assign:
                            all_slots.append(assign[(d, p, c, s, a)])
            # 隔週ペアで subject_b に相当するタグも必要コマ数にカウント
            for pair_idx, pair in enumerate(alt_week_pairs or []):
                if pair.get("class_key") == class_key and pair.get("subject_b") == subject:
                    c_indices = pair_class_indices.get(pair_idx, [])
                    if c in c_indices:
                        for d in range(NUM_DAYS):
                            for p in range(NUM_PERIODS):
                                if (pair_idx, d, p, c) in alt_tag:
                                    all_slots.append(alt_tag[(pair_idx, d, p, c)])
            model.Add(sum(all_slots) == required)

    # 4-c. 担当者の同時間帯重複禁止（合同授業の同一担当者重複は許可）
    for d in range(NUM_DAYS):
        for p in range(NUM_PERIODS):
            for a in range(NUM_ASSIGNABLE):
                assignable_slots = [
                    assign[(d, p, c, s, a)]
                    for c in range(len(classes))
                    for s in range(len(subjects))
                    if (d, p, c, s, a) in assign
                    and (d, p, c, s, a) not in cgx_exempt_pairs
                    and (d, p, c, s, a) not in cg_exempt_pairs
                ]
                if len(assignable_slots) > 1:
                    model.AddAtMostOne(assignable_slots)

    # 4-d. 固定コマ（ハード制約）
    # existing_timetable エントリも固定コマとして扱う
    # ただし、隔週ペアの subject_b は alt_tag で処理するため固定コマに含めない
    # （subject_b を固定すると 4-b の「regular=0」制約と矛盾して INFEASIBLE になる）
    alt_week_subject_b_keys: set = set()
    for pair in (alt_week_pairs or []):
        ck_pair = pair.get("class_key", "")
        sb = pair.get("subject_b", "")
        if ck_pair and sb:
            alt_week_subject_b_keys.add((ck_pair, sb))

    all_fixed = list(fixed_slots or [])
    for entry in (existing_timetable or []):
        e_grade = entry.get("grade")
        e_class = entry.get("class_name", "")
        e_subj  = entry.get("subject", "")
        # このエントリのクラスキーを解決
        e_class_key = next(
            (ck for g, cn, ck in classes if g == e_grade and cn == e_class),
            None
        )
        # 隔週 subject_b はスキップ（alt_tag 機構で要件を満たすため）
        if e_class_key and (e_class_key, e_subj) in alt_week_subject_b_keys:
            continue
        all_fixed.append({
            "scope": "class",
            "grade": e_grade,
            "class_name": e_class,
            "day_of_week": entry.get("day_of_week"),
            "period": entry.get("period"),
            "subject": e_subj,
        })

    for slot in all_fixed:
        day_str = slot.get("day_of_week", "")
        period_val = slot.get("period")
        subject_str = slot.get("subject", "")

        if day_str not in DAYS or period_val not in PERIODS or subject_str not in subjects:
            continue

        d = DAYS.index(day_str)
        p = PERIODS.index(period_val)
        s = subjects.index(subject_str)

        for c_idx in get_fixed_class_indices(slot):
            grade, _, class_key = classes[c_idx]
            # 必要コマ数が0のクラスには適用しない（INFEASIBLE回避）
            if (required_hours.get(class_key) or {}).get(subject_str, 0) == 0:
                continue

            must_vars = [no_teach[(d, p, c_idx, s)]]
            for a in range(NUM_ASSIGNABLE):
                if (d, p, c_idx, s, a) in assign:
                    must_vars.append(assign[(d, p, c_idx, s, a)])

            if must_vars:
                model.AddExactlyOne(must_vars)

    # 4-d'. 既存の隔週エントリを alt_tag にピン留め
    # existing_timetable のエントリが alt_subject を持つ場合、対応する alt_week_pair の
    # alt_tag をそのスロットに強制する。これにより:
    #   - ソルバーが alt_tag を別スロットへ動かすのを防ぐ
    #   - 他クラスへ影響する 4-b の隔週 subject_b カウントが既存スロットで確実に消化される
    #   - 結果として、マニュアル配置済みの隔週教科がソルバーによって超過配置されなくなる
    for entry in (existing_timetable or []):
        e_alt_subj = entry.get("alt_subject") or ""
        if not e_alt_subj:
            continue
        e_grade = entry.get("grade")
        e_class = entry.get("class_name", "")
        e_subj  = entry.get("subject", "")
        day_str = entry.get("day_of_week", "")
        period_val = entry.get("period")

        if day_str not in DAYS or period_val not in PERIODS:
            continue

        d = DAYS.index(day_str)
        p = PERIODS.index(period_val)

        # エントリのクラス index を解決
        c_idx = next(
            (i for i, (g, cn, _) in enumerate(classes) if g == e_grade and cn == e_class),
            None
        )
        if c_idx is None:
            continue
        e_class_key = classes[c_idx][2]

        # 対応する alt_week_pair を検索（subject_a=entry.subject, subject_b=entry.alt_subject）
        matched_pair_idx = None
        for pair_idx, pair in enumerate(alt_week_pairs or []):
            if pair.get("class_key") != e_class_key:
                continue
            if pair.get("subject_a") != e_subj:
                continue
            if pair.get("subject_b") != e_alt_subj:
                continue
            matched_pair_idx = pair_idx
            break

        if matched_pair_idx is None:
            continue

        # alt_tag をこのスロットに固定
        key = (matched_pair_idx, d, p, c_idx)
        if key in alt_tag:
            model.Add(alt_tag[key] == 1)

        # alt_teacher_id が指定されていれば B週担当者も固定
        e_alt_tid = entry.get("alt_teacher_id")
        if e_alt_tid:
            for a, assignable in enumerate(all_assignable):
                if assignable.get("is_group"):
                    continue
                if assignable["id"] != e_alt_tid:
                    continue
                tup = (matched_pair_idx, d, p, c_idx, a)
                if tup in assign_alt_b:
                    model.Add(assign_alt_b[tup] == 1)
                break

    # 4-e. 施設制約（ハード制約）: 同一時限に同じ施設を複数クラスが使用不可
    if facilities and subject_facility:
        for fac in (facilities or []):
            fac_id = fac.get("id")
            if not fac_id:
                continue
            for d in range(NUM_DAYS):
                for p in range(NUM_PERIODS):
                    class_uses_fac = []
                    for c in range(len(classes)):
                        c_vars = []
                        for s, subject in enumerate(subjects):
                            if (subject_facility or {}).get(subject) != fac_id:
                                continue
                            c_vars.append(no_teach[(d, p, c, s)])
                            for a in range(NUM_ASSIGNABLE):
                                if (d, p, c, s, a) in assign:
                                    c_vars.append(assign[(d, p, c, s, a)])
                        if not c_vars:
                            continue
                        c_uses = model.NewBoolVar(f"fu_{fac_id}_{c}_{d}_{p}")
                        model.Add(sum(c_vars) >= 1).OnlyEnforceIf(c_uses)
                        model.Add(sum(c_vars) == 0).OnlyEnforceIf(c_uses.Not())
                        class_uses_fac.append(c_uses)
                    if len(class_uses_fac) > 1:
                        model.AddAtMostOne(class_uses_fac)

    # 4-i. 連続配置制約（subject_sequences）
    # 指定された学年・クラスで subject_a の直後に subject_b が来るスロットペアが
    # 少なくとも1つ存在することを保証する（ソフト: 孤立 subject_a にペナルティ）
    seq_isolated_penalty = []  # 連続ペアにならなかった subject_a のペナルティ項
    for seq_idx, seq in enumerate(subject_sequences or []):
        s_a_name = seq.get("subject_a", "")
        s_b_name = seq.get("subject_b", "")
        seq_grade = seq.get("grade")
        seq_class = seq.get("class_name")  # None = 学年全体

        if s_a_name not in subjects or s_b_name not in subjects:
            continue
        s_a = subjects.index(s_a_name)
        s_b = subjects.index(s_b_name)

        # 対象クラスを解決
        target_c_indices = []
        for c_idx, (g, cn, _) in enumerate(classes):
            if g != seq_grade:
                continue
            if seq_class and cn != seq_class:
                continue
            target_c_indices.append(c_idx)

        for c_idx in target_c_indices:
            pair_vars = []
            for d in range(NUM_DAYS):
                for p in range(NUM_PERIODS - 1):  # p+1 が有効な範囲
                    p_next = p + 1

                    a_vars = [no_teach[(d, p, c_idx, s_a)]]
                    for a in range(NUM_ASSIGNABLE):
                        if (d, p, c_idx, s_a, a) in assign:
                            a_vars.append(assign[(d, p, c_idx, s_a, a)])

                    b_vars = [no_teach[(d, p_next, c_idx, s_b)]]
                    for a in range(NUM_ASSIGNABLE):
                        if (d, p_next, c_idx, s_b, a) in assign:
                            b_vars.append(assign[(d, p_next, c_idx, s_b, a)])

                    has_a = model.NewBoolVar(f"seqa_{seq_idx}_{c_idx}_{d}_{p}")
                    has_b = model.NewBoolVar(f"seqb_{seq_idx}_{c_idx}_{d}_{p}")
                    model.Add(sum(a_vars) >= 1).OnlyEnforceIf(has_a)
                    model.Add(sum(a_vars) == 0).OnlyEnforceIf(has_a.Not())
                    model.Add(sum(b_vars) >= 1).OnlyEnforceIf(has_b)
                    model.Add(sum(b_vars) == 0).OnlyEnforceIf(has_b.Not())

                    # has_a AND has_b → consecutive pair exists at this slot
                    pair = model.NewBoolVar(f"seqpair_{seq_idx}_{c_idx}_{d}_{p}")
                    model.AddMinEquality(pair, [has_a, has_b])
                    pair_vars.append(pair)

                    # 孤立 subject_a ペナルティ: subject_a があるのに直後に subject_b がない
                    isolated_a = model.NewBoolVar(f"isoa_{seq_idx}_{c_idx}_{d}_{p}")
                    model.AddBoolAnd([has_a, pair.Not()]).OnlyEnforceIf(isolated_a)
                    model.AddBoolOr([has_a.Not(), pair]).OnlyEnforceIf(isolated_a.Not())
                    seq_isolated_penalty.append(isolated_a * 150)

            # 最終コマに subject_a が配置されたペナルティ（直後に subject_b を置けない）
            for d in range(NUM_DAYS):
                p_last = NUM_PERIODS - 1
                a_last_vars = [no_teach[(d, p_last, c_idx, s_a)]]
                for a in range(NUM_ASSIGNABLE):
                    if (d, p_last, c_idx, s_a, a) in assign:
                        a_last_vars.append(assign[(d, p_last, c_idx, s_a, a)])
                has_a_last = model.NewBoolVar(f"seqa_last_{seq_idx}_{c_idx}_{d}")
                model.Add(sum(a_last_vars) >= 1).OnlyEnforceIf(has_a_last)
                model.Add(sum(a_last_vars) == 0).OnlyEnforceIf(has_a_last.Not())
                seq_isolated_penalty.append(has_a_last * 150)

            if pair_vars:
                # 少なくとも1つの連続ペアが存在すること
                model.Add(sum(pair_vars) >= 1)

    # ------------------------------------------------------------------ #
    # 5. ソフト制約（ペナルティとして目的関数に組み込む）
    # ------------------------------------------------------------------ #
    # 4-i で収集した連続授業の孤立ペナルティを引き継ぐ
    penalty_terms = list(seq_isolated_penalty)

    # 5-a. 連続授業日数超過ペナルティ
    for c in range(len(classes)):
        for s, subject in enumerate(subjects):
            limit = (subject_constraints.get(subject) or {}).get("max_consecutive_days")
            if limit is None:
                continue
            window_size = limit + 1
            if window_size > NUM_DAYS:
                continue
            for d_start in range(NUM_DAYS - window_size + 1):
                window_vars = []
                for dd in range(d_start, d_start + window_size):
                    for p in range(NUM_PERIODS):
                        window_vars.append(no_teach[(dd, p, c, s)])
                        for a in range(NUM_ASSIGNABLE):
                            if (dd, p, c, s, a) in assign:
                                window_vars.append(assign[(dd, p, c, s, a)])
                if not window_vars:
                    continue
                overuse = model.NewIntVar(0, len(window_vars), f"over_{c}_{s}_{d_start}")
                model.Add(overuse == sum(window_vars) - limit)
                clipped = model.NewIntVar(0, len(window_vars), f"clip_{c}_{s}_{d_start}")
                model.AddMaxEquality(clipped, [overuse, model.NewConstant(0)])
                penalty_terms.append(clipped * 100)

    # 5-b. 教員未割り当てペナルティ
    for c, (grade, class_name, class_key) in enumerate(classes):
        class_req = required_hours.get(class_key, {})
        for s, subject in enumerate(subjects):
            if class_req.get(subject, 0) > 0:
                for d in range(NUM_DAYS):
                    for p in range(NUM_PERIODS):
                        penalty_terms.append(no_teach[(d, p, c, s)])

    # 5-b'. B週担当者の未割り当てペナルティ
    for nt_v in no_teach_alt_b.values():
        penalty_terms.append(nt_v)

    # 5-c. 教員（グループ含む）の1日最大コマ数ペナルティ
    for a, assignable in enumerate(all_assignable):
        if assignable["is_group"]:
            continue  # グループには max_daily 制約なし
        tid = assignable["id"]
        max_d = (teacher_constraints or {}).get(tid, {}).get("max_daily")
        if max_d is None:
            continue
        for d in range(NUM_DAYS):
            day_vars = [
                assign[(d, p, c, s, a)]
                for p in range(NUM_PERIODS)
                for c in range(len(classes))
                for s in range(len(subjects))
                if (d, p, c, s, a) in assign
            ]
            if not day_vars:
                continue
            overuse = model.NewIntVar(0, len(day_vars), f"td_{a}_{d}")
            model.Add(overuse >= sum(day_vars) - max_d)
            clipped = model.NewIntVar(0, len(day_vars), f"td_c_{a}_{d}")
            model.AddMaxEquality(clipped, [overuse, model.NewConstant(0)])
            penalty_terms.append(clipped * 60)

    # 5-d. 教員の連続コマ数ペナルティ
    for a, assignable in enumerate(all_assignable):
        if assignable["is_group"]:
            continue
        tid = assignable["id"]
        max_c = (teacher_constraints or {}).get(tid, {}).get("max_consecutive")
        if max_c is None:
            continue
        win = max_c + 1
        if win > NUM_PERIODS:
            continue
        for d in range(NUM_DAYS):
            for p_start in range(NUM_PERIODS - win + 1):
                w_vars = [
                    assign[(d, p, c, s, a)]
                    for p in range(p_start, p_start + win)
                    for c in range(len(classes))
                    for s in range(len(subjects))
                    if (d, p, c, s, a) in assign
                ]
                if not w_vars:
                    continue
                overuse = model.NewIntVar(0, len(w_vars), f"tc_{a}_{d}_{p_start}")
                model.Add(overuse >= sum(w_vars) - max_c)
                clipped = model.NewIntVar(0, len(w_vars), f"tc_c_{a}_{d}_{p_start}")
                model.AddMaxEquality(clipped, [overuse, model.NewConstant(0)])
                penalty_terms.append(clipped * 60)

    # 5-e. 教科の配置可能時限ペナルティ
    for s, subject in enumerate(subjects):
        placement = (subject_placement or {}).get(subject) or {}
        allowed_p = placement.get("allowed_periods") or []
        if not allowed_p:
            continue
        for d in range(NUM_DAYS):
            for p in range(NUM_PERIODS):
                if PERIODS[p] in allowed_p:
                    continue
                for c in range(len(classes)):
                    penalty_terms.append(no_teach[(d, p, c, s)] * 40)
                    for a in range(NUM_ASSIGNABLE):
                        if (d, p, c, s, a) in assign:
                            penalty_terms.append(assign[(d, p, c, s, a)] * 40)

    # 5-f. 教科の1日最大コマ数ペナルティ（未設定時はデフォルト1）
    for s, subject in enumerate(subjects):
        placement = (subject_placement or {}).get(subject) or {}
        max_daily = placement.get("max_daily")
        if max_daily is None:
            max_daily = 1
        for c in range(len(classes)):
            for d in range(NUM_DAYS):
                day_vars = [no_teach[(d, p, c, s)] for p in range(NUM_PERIODS)]
                for p in range(NUM_PERIODS):
                    for a in range(NUM_ASSIGNABLE):
                        if (d, p, c, s, a) in assign:
                            day_vars.append(assign[(d, p, c, s, a)])
                overuse = model.NewIntVar(0, len(day_vars), f"sd_{s}_{c}_{d}")
                model.Add(overuse >= sum(day_vars) - max_daily)
                clipped = model.NewIntVar(0, len(day_vars), f"sd_c_{s}_{c}_{d}")
                model.AddMaxEquality(clipped, [overuse, model.NewConstant(0)])
                penalty_terms.append(clipped * 70)

    # 5-g. 教科の午後1日最大コマ数ペナルティ
    for s, subject in enumerate(subjects):
        placement = (subject_placement or {}).get(subject) or {}
        max_pm = placement.get("max_afternoon_daily")
        if max_pm is None:
            continue
        for c in range(len(classes)):
            for d in range(NUM_DAYS):
                pm_vars = [no_teach[(d, p, c, s)] for p in pm_idx_set]
                for p in pm_idx_set:
                    for a in range(NUM_ASSIGNABLE):
                        if (d, p, c, s, a) in assign:
                            pm_vars.append(assign[(d, p, c, s, a)])
                if not pm_vars:
                    continue
                overuse = model.NewIntVar(0, len(pm_vars), f"pm_{s}_{c}_{d}")
                model.Add(overuse >= sum(pm_vars) - max_pm)
                clipped = model.NewIntVar(0, len(pm_vars), f"pm_c_{s}_{c}_{d}")
                model.AddMaxEquality(clipped, [overuse, model.NewConstant(0)])
                penalty_terms.append(clipped * 80)

    # 5-h. 教科の午後分散ペナルティ（隣接曜日に午後コマが重なったらペナルティ）
    for s, subject in enumerate(subjects):
        placement = (subject_placement or {}).get(subject) or {}
        if not placement.get("afternoon_spread"):
            continue
        for c in range(len(classes)):
            day_has_pm = []
            for d in range(NUM_DAYS):
                pm_vars = [no_teach[(d, p, c, s)] for p in pm_idx_set]
                for p in pm_idx_set:
                    for a in range(NUM_ASSIGNABLE):
                        if (d, p, c, s, a) in assign:
                            pm_vars.append(assign[(d, p, c, s, a)])
                if not pm_vars:
                    day_has_pm.append(None)
                    continue
                has_pm = model.NewBoolVar(f"hpm_{s}_{c}_{d}")
                model.Add(sum(pm_vars) >= 1).OnlyEnforceIf(has_pm)
                model.Add(sum(pm_vars) == 0).OnlyEnforceIf(has_pm.Not())
                day_has_pm.append(has_pm)
            for d in range(NUM_DAYS - 1):
                if day_has_pm[d] is None or day_has_pm[d + 1] is None:
                    continue
                both = model.NewBoolVar(f"both_pm_{s}_{c}_{d}")
                model.AddMinEquality(both, [day_has_pm[d], day_has_pm[d + 1]])
                penalty_terms.append(both * 50)

    # 5-i. 全体分散ペナルティ（同教科・同クラスを同一曜日に複数置かない）
    for s, subject in enumerate(subjects):
        placement = (subject_placement or {}).get(subject) or {}
        if not placement.get("spread_days"):
            continue
        for c in range(len(classes)):
            for d in range(NUM_DAYS):
                day_vars = [no_teach[(d, p, c, s)] for p in range(NUM_PERIODS)]
                for p in range(NUM_PERIODS):
                    for a in range(NUM_ASSIGNABLE):
                        if (d, p, c, s, a) in assign:
                            day_vars.append(assign[(d, p, c, s, a)])
                overuse = model.NewIntVar(0, len(day_vars), f"sp_{s}_{c}_{d}")
                model.Add(overuse >= sum(day_vars) - 1)
                clipped = model.NewIntVar(0, len(day_vars), f"sp_c_{s}_{c}_{d}")
                model.AddMaxEquality(clipped, [overuse, model.NewConstant(0)])
                penalty_terms.append(clipped * 45)

    # 5-j. 教員の週総コマ数ペナルティ
    for a, assignable in enumerate(all_assignable):
        if assignable["is_group"]:
            continue
        tid = assignable["id"]
        max_w = (teacher_constraints or {}).get(tid, {}).get("max_weekly")
        if max_w is None:
            continue
        week_vars = [
            assign[(d, p, c, s, a)]
            for d in range(NUM_DAYS)
            for p in range(NUM_PERIODS)
            for c in range(len(classes))
            for s in range(len(subjects))
            if (d, p, c, s, a) in assign
        ]
        if not week_vars:
            continue
        overuse = model.NewIntVar(0, len(week_vars), f"tw_{a}")
        model.Add(overuse >= sum(week_vars) - max_w)
        clipped = model.NewIntVar(0, len(week_vars), f"tw_c_{a}")
        model.AddMaxEquality(clipped, [overuse, model.NewConstant(0)])
        penalty_terms.append(clipped * 55)

    # 5-k. 担任優先ソフト制約（担任クラスに他教員が入る場合のペナルティ）
    for a, assignable in enumerate(all_assignable):
        if assignable["is_group"]:
            continue
        tid = assignable["id"]
        tc = (teacher_constraints or {}).get(tid, {})
        hr_grade = tc.get("homeroom_grade")
        hr_class = tc.get("homeroom_class")
        if hr_grade is None or not hr_class:
            continue
        hr_c_idx = next(
            (c_idx for c_idx, (g, cn, _) in enumerate(classes)
             if g == hr_grade and cn == hr_class),
            None
        )
        if hr_c_idx is None:
            continue
        for d in range(NUM_DAYS):
            for p in range(NUM_PERIODS):
                for s in range(len(subjects)):
                    for a2, assignable2 in enumerate(all_assignable):
                        if a2 == a:
                            continue
                        if (d, p, hr_c_idx, s, a2) in assign:
                            if (d, p, hr_c_idx, s, a) in assign:
                                penalty_terms.append(assign[(d, p, hr_c_idx, s, a2)] * 5)

    # 5-l. 空きコマ集約ペナルティ（授業の間に空きコマを作らない）
    for a, assignable in enumerate(all_assignable):
        if assignable["is_group"]:
            continue
        tid = assignable["id"]
        tc = (teacher_constraints or {}).get(tid, {})
        if not tc.get("consolidate_free"):
            continue
        for d in range(NUM_DAYS):
            for p_mid in range(1, NUM_PERIODS - 1):
                prev_vars = [
                    assign[(d, p_mid - 1, c, s, a)]
                    for c in range(len(classes))
                    for s in range(len(subjects))
                    if (d, p_mid - 1, c, s, a) in assign
                ]
                curr_vars = [
                    assign[(d, p_mid, c, s, a)]
                    for c in range(len(classes))
                    for s in range(len(subjects))
                    if (d, p_mid, c, s, a) in assign
                ]
                next_vars = [
                    assign[(d, p_mid + 1, c, s, a)]
                    for c in range(len(classes))
                    for s in range(len(subjects))
                    if (d, p_mid + 1, c, s, a) in assign
                ]
                if not prev_vars or not next_vars:
                    continue
                has_prev = model.NewBoolVar(f"cf_prev_{a}_{d}_{p_mid}")
                has_curr = model.NewBoolVar(f"cf_curr_{a}_{d}_{p_mid}")
                has_next = model.NewBoolVar(f"cf_next_{a}_{d}_{p_mid}")
                model.Add(sum(prev_vars) >= 1).OnlyEnforceIf(has_prev)
                model.Add(sum(prev_vars) == 0).OnlyEnforceIf(has_prev.Not())
                if curr_vars:
                    model.Add(sum(curr_vars) >= 1).OnlyEnforceIf(has_curr)
                    model.Add(sum(curr_vars) == 0).OnlyEnforceIf(has_curr.Not())
                else:
                    model.Add(model.NewConstant(0) == 1).OnlyEnforceIf(has_curr)
                    model.Add(model.NewConstant(0) == 0).OnlyEnforceIf(has_curr.Not())
                model.Add(sum(next_vars) >= 1).OnlyEnforceIf(has_next)
                model.Add(sum(next_vars) == 0).OnlyEnforceIf(has_next.Not())
                gap = model.NewBoolVar(f"gap_{a}_{d}_{p_mid}")
                model.AddBoolAnd([has_prev, has_curr.Not(), has_next]).OnlyEnforceIf(gap)
                model.AddBoolOr([has_prev.Not(), has_curr, has_next.Not()]).OnlyEnforceIf(gap.Not())
                penalty_terms.append(gap * 20)

    # 5-m. 2コマ連続授業ペナルティ（奇数コマ = 連続できないコマが発生）
    for s, subject in enumerate(subjects):
        placement = (subject_placement or {}).get(subject) or {}
        if not placement.get("requires_double"):
            continue
        for c in range(len(classes)):
            for d in range(NUM_DAYS):
                day_vars = [no_teach[(d, p, c, s)] for p in range(NUM_PERIODS)]
                for p in range(NUM_PERIODS):
                    for a in range(NUM_ASSIGNABLE):
                        if (d, p, c, s, a) in assign:
                            day_vars.append(assign[(d, p, c, s, a)])
                if not day_vars:
                    continue
                count_v = model.NewIntVar(0, len(day_vars), f"dbl_{s}_{c}_{d}")
                model.Add(count_v == sum(day_vars))
                remainder = model.NewIntVar(0, 1, f"dblrem_{s}_{c}_{d}")
                model.AddModuloEquality(remainder, count_v, 2)
                penalty_terms.append(remainder * 90)
                for p in range(NUM_PERIODS - 1):
                    p_vars = [no_teach[(d, p, c, s)]] + [
                        assign[(d, p, c, s, a)] for a in range(NUM_ASSIGNABLE)
                        if (d, p, c, s, a) in assign
                    ]
                    p1_vars = [no_teach[(d, p + 1, c, s)]] + [
                        assign[(d, p + 1, c, s, a)] for a in range(NUM_ASSIGNABLE)
                        if (d, p + 1, c, s, a) in assign
                    ]
                    has_p = model.NewBoolVar(f"dbl_p_{s}_{c}_{d}_{p}")
                    has_p1 = model.NewBoolVar(f"dbl_p1_{s}_{c}_{d}_{p}")
                    model.Add(sum(p_vars) >= 1).OnlyEnforceIf(has_p)
                    model.Add(sum(p_vars) == 0).OnlyEnforceIf(has_p.Not())
                    model.Add(sum(p1_vars) >= 1).OnlyEnforceIf(has_p1)
                    model.Add(sum(p1_vars) == 0).OnlyEnforceIf(has_p1.Not())
                    only_p = model.NewBoolVar(f"iso_p_{s}_{c}_{d}_{p}")
                    model.AddBoolAnd([has_p, has_p1.Not()]).OnlyEnforceIf(only_p)
                    model.AddBoolOr([has_p.Not(), has_p1]).OnlyEnforceIf(only_p.Not())
                    penalty_terms.append(only_p * 30)

    if penalty_terms:
        model.Minimize(sum(penalty_terms))

    # ------------------------------------------------------------------ #
    # 6. ソルバー実行
    # ------------------------------------------------------------------ #
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = float(time_limit)
    solver.parameters.num_workers = 4

    status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return None, (
            f"解が見つかりませんでした（{solver.StatusName(status)}）。\n"
            "必要コマ数の合計が週の総スロット数（30）を超えていないか、"
            "固定コマの設定が必要コマ数と矛盾していないか確認してください。"
        )

    # ------------------------------------------------------------------ #
    # 7. 結果抽出
    # ------------------------------------------------------------------ #

    # 隔週タグの解値を収集: (d, p, c) -> subject_b name
    alt_subject_map: dict = {}   # {(d, p, c): subject_b_name}
    alt_teacher_map: dict = {}   # {(d, p, c): alt_teacher_id}
    for pair_idx, pair in enumerate(alt_week_pairs or []):
        s_b_name = pair.get("subject_b", "")
        for c_idx in pair_class_indices.get(pair_idx, []):
            for d in range(NUM_DAYS):
                for p in range(NUM_PERIODS):
                    key = (pair_idx, d, p, c_idx)
                    if key in alt_tag and solver.BooleanValue(alt_tag[key]):
                        alt_subject_map[(d, p, c_idx)] = s_b_name
                        # B週担当者を解から取得
                        for a, assignable in enumerate(all_assignable):
                            if (pair_idx, d, p, c_idx, a) in assign_alt_b and \
                               solver.BooleanValue(assign_alt_b[(pair_idx, d, p, c_idx, a)]):
                                alt_teacher_map[(d, p, c_idx)] = assignable["id"]
                                break

    timetable = []
    for d in range(NUM_DAYS):
        for p in range(NUM_PERIODS):
            for c, (grade, class_name, _) in enumerate(classes):
                for s, subject in enumerate(subjects):
                    found_teacher_id = None
                    found_group_id = None
                    for a, assignable in enumerate(all_assignable):
                        if (d, p, c, s, a) in assign and solver.BooleanValue(assign[(d, p, c, s, a)]):
                            if assignable["is_group"]:
                                found_group_id = assignable["id"]
                            else:
                                found_teacher_id = assignable["id"]
                            break

                    no_t = solver.BooleanValue(no_teach[(d, p, c, s)])

                    if found_teacher_id or found_group_id or no_t:
                        alt_subj = alt_subject_map.get((d, p, c))
                        timetable.append({
                            "day_of_week":      DAYS[d],
                            "period":           PERIODS[p],
                            "grade":            grade,
                            "class_name":       class_name,
                            "subject":          subject,
                            "teacher_id":       found_teacher_id,
                            "teacher_group_id": found_group_id,
                            "alt_subject":      alt_subj,
                            "alt_teacher_id":   alt_teacher_map.get((d, p, c)),
                        })

    return timetable, None
