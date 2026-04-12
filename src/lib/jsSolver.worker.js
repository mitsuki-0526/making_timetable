/**
 * jsSolver.worker.js
 * ブラウザ内で動作する時間割自動生成ソルバー（Web Worker）
 *
 * アルゴリズム: ランダム化グリーディ法（ベストエフォート）
 *   - 配置できたコマを蓄積し、配置できなかったコマは飛ばして続行
 *   - 複数回リスタートして最も多く配置できた解を採用
 *   - 「全か無か」ではなく「できるだけ多く置く」方針
 */

const DAYS    = ['月', '火', '水', '木', '金'];
const PERIODS = [1, 2, 3, 4, 5, 6];

// ── ユーティリティ ────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── 教員または教員グループを探す ──────────────────────────────────────
// 戻り値: { teacher_id, teacher_group_id, usageKey } or null

function findTeacherOrGroup(grade, isSpecial, subject, day, period, teachers, teacherGroups, teacherUsage) {
  // 1. 個別教員を優先して探す
  for (const t of teachers) {
    const isTokkiShien = t.subjects.includes('特別支援');
    if (isTokkiShien && !isSpecial) continue;
    if (!isTokkiShien && !t.subjects.includes(subject)) continue;
    if (!t.target_grades.includes(grade)) continue;
    if (t.unavailable_times?.some(u => u.day_of_week === day && u.period === period)) continue;
    if (teacherUsage.has(`${t.id}|${day}|${period}`)) continue;
    return { teacher_id: t.id, teacher_group_id: null, usageKey: t.id };
  }
  // 2. 教員グループを探す（subjects と target_grades が設定されているもの）
  for (const g of (teacherGroups || [])) {
    const gSubjects = g.subjects || [];
    const gGrades   = g.target_grades || [];
    if (gSubjects.length === 0 || !gSubjects.includes(subject)) continue;
    if (gGrades.length > 0 && !gGrades.includes(grade)) continue;
    if (teacherUsage.has(`${g.id}|${day}|${period}`)) continue;
    return { teacher_id: null, teacher_group_id: g.id, usageKey: g.id };
  }
  return null;
}

// ── 1回の試行（ベストエフォート） ─────────────────────────────────────
// 配置できないコマは飛ばして続行し、配置できた全エントリを返す

function tryOnce({
  classes,
  classRequiredSlots,
  teachers,
  teacherGroups,
  fixedSlotKeys,
  fixedEntries,
  subjectPlacement,
  lunchAfterPeriod,
  crossGradeGroups,
  subjectPairings,
  altTasks,
  classGroupTasks,
  sequenceTasks,
}) {
  // 配置済みマップ: "grade|class_name|day|period" → entry
  const placed      = new Map();
  // 教員使用マップ: "teacher_id|day|period" → true
  const teacherUsage = new Map();
  // 配置に成功したコマ数
  let placed_count   = 0;
  let required_count = 0;

  // 固定コマを先に登録
  for (const entry of fixedEntries) {
    const key = `${entry.grade}|${entry.class_name}|${entry.day_of_week}|${entry.period}`;
    placed.set(key, entry);
    if (entry.teacher_id) {
      teacherUsage.set(`${entry.teacher_id}|${entry.day_of_week}|${entry.period}`, true);
    }
  }

  // 共通スロット検索ヘルパー（placed・fixedSlotKeys 確定後に定義）
  const slotOk = (grade, className, subject, day, period) => {
    const cellKey = `${grade}|${className}|${day}|${period}`;
    if (placed.has(cellKey) || fixedSlotKeys.has(cellKey)) return false;
    const sp = subjectPlacement?.[subject];

    // 許可曜日チェック
    if (sp?.allowed_days?.length > 0 && !sp.allowed_days.includes(day)) return false;

    // 許可時限チェック
    if (sp?.allowed_periods?.length > 0 && !sp.allowed_periods.includes(period)) return false;

    // 1日最大コマ数チェック（未設定ならデフォルト1）
    const maxDaily = sp?.max_daily ?? 1;
    let dailyCnt = 0;
    for (const [, e] of placed) {
      if (e.grade === grade && e.class_name === className &&
          e.day_of_week === day && e.subject === subject) dailyCnt++;
    }
    if (dailyCnt >= maxDaily) return false;

    // 午後1日上限チェック
    if (sp?.max_afternoon_daily != null && period > lunchAfterPeriod) {
      let afternoonCnt = 0;
      for (const [, e] of placed) {
        if (e.grade === grade && e.class_name === className &&
            e.day_of_week === day && e.period > lunchAfterPeriod && e.subject === subject) afternoonCnt++;
      }
      if (afternoonCnt >= sp.max_afternoon_daily) return false;
    }
    return true;
  };

  // ── 全体合同授業を先に配置 ─────────────────────────────────────────
  for (const grp of crossGradeGroups) {
    if (!grp.subject || !grp.participants || grp.participants.length < 2) continue;
    const count = grp.count || 1;

    for (let i = 0; i < count; i++) {
      required_count += grp.participants.length;
      const slots = shuffle(DAYS.flatMap(day => PERIODS.map(period => ({ day, period }))));

      for (const { day, period } of slots) {
        // 全参加クラスで slotOk（max_daily 含む）チェック
        if (!grp.participants.every(p => slotOk(p.grade, p.class_name, grp.subject, day, period))) continue;

        // 教員またはグループを探す（学年横断のため参加学年を対象）
        const gradeSet = new Set(grp.participants.map(p => p.grade));
        let assignment = null;
        // 個別教員
        for (const t of teachers) {
          if (!t.subjects.includes(grp.subject)) continue;
          if (t.unavailable_times?.some(u => u.day_of_week === day && u.period === period)) continue;
          if (teacherUsage.has(`${t.id}|${day}|${period}`)) continue;
          if (![...gradeSet].some(g => t.target_grades.includes(g))) continue;
          assignment = { teacher_id: t.id, teacher_group_id: null, usageKey: t.id };
          break;
        }
        // 教員グループ
        if (!assignment) {
          for (const g of (teacherGroups || [])) {
            const gs = g.subjects || [], gg = g.target_grades || [];
            if (!gs.includes(grp.subject)) continue;
            if (gg.length > 0 && ![...gradeSet].some(gr => gg.includes(gr))) continue;
            if (teacherUsage.has(`${g.id}|${day}|${period}`)) continue;
            assignment = { teacher_id: null, teacher_group_id: g.id, usageKey: g.id };
            break;
          }
        }
        if (!assignment) continue; // 教員が見つからなければスキップ

        // 全参加クラスに配置
        for (const p of grp.participants) {
          const k = `${p.grade}|${p.class_name}|${day}|${period}`;
          placed.set(k, {
            day_of_week: day, period,
            grade: p.grade, class_name: p.class_name,
            subject: grp.subject,
            teacher_id: assignment.teacher_id,
            teacher_group_id: assignment.teacher_group_id,
          });
          placed_count++;
        }
        teacherUsage.set(`${assignment.usageKey}|${day}|${period}`, true);
        break;
      }
    }
  }

  // ── 合同クラスタスクを配置（split_subjects 以外は同一スロット・同一教員） ──
  for (const { grade, classNames, subject } of shuffle(classGroupTasks || [])) {
    required_count += classNames.length;
    const candidateSlots = shuffle(DAYS.flatMap(day => PERIODS.map(period => ({ day, period }))));

    for (const { day, period } of candidateSlots) {
      if (!classNames.every(cn => slotOk(grade, cn, subject, day, period))) continue;
      const assignment = findTeacherOrGroup(grade, false, subject, day, period, teachers, teacherGroups, teacherUsage);
      if (!assignment) continue;

      for (const cn of classNames) {
        placed.set(`${grade}|${cn}|${day}|${period}`, {
          day_of_week: day, period, grade, class_name: cn,
          subject, teacher_id: assignment.teacher_id, teacher_group_id: assignment.teacher_group_id,
        });
        placed_count++;
      }
      teacherUsage.set(`${assignment.usageKey}|${day}|${period}`, true);
      break;
    }
  }

  // ── 連続配置ペアを配置（教科A の直後の時限に教科B） ──────────────────
  for (const { grade, class_name, isSpecial, subject_a, subject_b } of shuffle(sequenceTasks || [])) {
    required_count += 2;
    // period < PERIODS.length のスロットのみ候補（最終時限は次がないため除外）
    const candidateSlots = shuffle(
      DAYS.flatMap(day =>
        PERIODS.slice(0, -1).map(period => ({ day, period }))
      )
    );

    for (const { day, period } of candidateSlots) {
      const periodB = period + 1;
      // 両時限が空いているか確認
      if (!slotOk(grade, class_name, subject_a, day, period)) continue;
      if (!slotOk(grade, class_name, subject_b, day, periodB)) continue;

      // 各時限の教員を探す
      const assignA = findTeacherOrGroup(grade, isSpecial, subject_a, day, period,  teachers, teacherGroups, teacherUsage);
      if (!assignA) continue;
      const tempUsage = new Map(teacherUsage);
      tempUsage.set(`${assignA.usageKey}|${day}|${period}`, true);
      const assignB = findTeacherOrGroup(grade, isSpecial, subject_b, day, periodB, teachers, teacherGroups, tempUsage);
      if (!assignB) continue;

      // 配置
      placed.set(`${grade}|${class_name}|${day}|${period}`, {
        day_of_week: day, period, grade, class_name,
        subject: subject_a, teacher_id: assignA.teacher_id, teacher_group_id: assignA.teacher_group_id,
      });
      placed.set(`${grade}|${class_name}|${day}|${periodB}`, {
        day_of_week: day, period: periodB, grade, class_name,
        subject: subject_b, teacher_id: assignB.teacher_id, teacher_group_id: assignB.teacher_group_id,
      });
      teacherUsage.set(`${assignA.usageKey}|${day}|${period}`,  true);
      teacherUsage.set(`${assignB.usageKey}|${day}|${periodB}`, true);
      placed_count += 2;
      break;
    }
  }

  // ── 隔週授業ペアを配置 ────────────────────────────────────────────────
  for (const { grade, class_name, isSpecial, subject_a, subject_b } of shuffle(altTasks || [])) {
    required_count++;
    const candidateSlots = shuffle(DAYS.flatMap(day => PERIODS.map(period => ({ day, period }))));

    for (const { day, period } of candidateSlots) {
      if (!slotOk(grade, class_name, subject_a, day, period)) continue;
      const assignment = findTeacherOrGroup(grade, isSpecial, subject_a, day, period, teachers, teacherGroups, teacherUsage);
      if (!assignment) continue;

      placed.set(`${grade}|${class_name}|${day}|${period}`, {
        day_of_week: day, period, grade, class_name,
        subject: subject_a, alt_subject: subject_b,
        teacher_id: assignment.teacher_id, teacher_group_id: assignment.teacher_group_id,
      });
      teacherUsage.set(`${assignment.usageKey}|${day}|${period}`, true);
      placed_count++;
      break;
    }
  }

  // ── 抱き合わせペアの解決: 必要スロットを「ペアタスク」と「単体タスク」に分類 ──
  // pairingKey: "grade|classA|subjectA|classB|subjectB" → 何コマ配置が必要か
  // 抱き合わせに含まれる教科スロットは単体タスクから除外し、ペアとして同時配置する

  // 各クラスの残必要スロット（可変なコピー）
  const remainingSlots = {};
  for (const cls of classes) {
    const key = `${cls.grade}|${cls.class_name}`;
    remainingSlots[key] = [...(classRequiredSlots[key] || [])];
    required_count += remainingSlots[key].length;
  }

  // 抱き合わせタスクを先に構築（両クラスの残スロットから1個ずつ消費）
  const pairTasks = [];
  for (const pairing of (subjectPairings || [])) {
    const { grade, classA, subjectA, classB, subjectB } = pairing;
    const keyA = `${grade}|${classA}`;
    const keyB = `${grade}|${classB}`;
    const clsA = classes.find(c => c.grade === grade && c.class_name === classA);
    const clsB = classes.find(c => c.grade === grade && c.class_name === classB);
    if (!clsA || !clsB) continue;

    // 両クラスの残スロットから消費できる数だけペアタスクを生成
    while (true) {
      const idxA = remainingSlots[keyA]?.indexOf(subjectA) ?? -1;
      const idxB = remainingSlots[keyB]?.indexOf(subjectB) ?? -1;
      if (idxA < 0 || idxB < 0) break;
      remainingSlots[keyA].splice(idxA, 1);
      remainingSlots[keyB].splice(idxB, 1);
      pairTasks.push({ grade, clsA, clsB, subjectA, subjectB });
    }
  }

  // 単体タスク（抱き合わせに使われなかった残スロット）
  const soloTasks = [];
  for (const cls of classes) {
    const key = `${cls.grade}|${cls.class_name}`;
    for (const subject of remainingSlots[key] || []) {
      soloTasks.push({ grade: cls.grade, className: cls.class_name, subject, isSpecial: cls.isSpecial });
    }
  }

  // ── 抱き合わせペアを同一スロットに配置 ───────────────────────────
  for (const { grade, clsA, clsB, subjectA, subjectB } of shuffle(pairTasks)) {
    const candidateSlots = shuffle(DAYS.flatMap(day => PERIODS.map(period => ({ day, period }))));

    for (const { day, period } of candidateSlots) {
      // 両クラスのスロットが空いているか
      if (!slotOk(grade, clsA.class_name, subjectA, day, period)) continue;
      if (!slotOk(grade, clsB.class_name, subjectB, day, period)) continue;

      // 教員またはグループを探す
      const assignA = findTeacherOrGroup(grade, clsA.isSpecial, subjectA, day, period, teachers, teacherGroups, teacherUsage);
      if (!assignA) continue;
      // assignA を使用済みにした上で assignB を探す
      const tempUsage = new Map(teacherUsage);
      tempUsage.set(`${assignA.usageKey}|${day}|${period}`, true);
      const assignB = findTeacherOrGroup(grade, clsB.isSpecial, subjectB, day, period, teachers, teacherGroups, tempUsage);
      if (!assignB) continue;

      // 両クラスに配置
      placed.set(`${grade}|${clsA.class_name}|${day}|${period}`, {
        day_of_week: day, period, grade, class_name: clsA.class_name,
        subject: subjectA, teacher_id: assignA.teacher_id, teacher_group_id: assignA.teacher_group_id,
      });
      placed.set(`${grade}|${clsB.class_name}|${day}|${period}`, {
        day_of_week: day, period, grade, class_name: clsB.class_name,
        subject: subjectB, teacher_id: assignB.teacher_id, teacher_group_id: assignB.teacher_group_id,
      });
      teacherUsage.set(`${assignA.usageKey}|${day}|${period}`, true);
      teacherUsage.set(`${assignB.usageKey}|${day}|${period}`, true);
      placed_count += 2;
      break;
    }
  }

  // ── 単体タスクを配置 ──────────────────────────────────────────────
  for (const { grade, className, subject, isSpecial } of shuffle(soloTasks)) {
    const candidateSlots = shuffle(DAYS.flatMap(day => PERIODS.map(period => ({ day, period }))));

    for (const { day, period } of candidateSlots) {
      if (!slotOk(grade, className, subject, day, period)) continue;
      const assignment = findTeacherOrGroup(grade, isSpecial, subject, day, period, teachers, teacherGroups, teacherUsage);
      if (!assignment) continue;

      placed.set(`${grade}|${className}|${day}|${period}`, {
        day_of_week: day, period, grade, class_name: className,
        subject, teacher_id: assignment.teacher_id, teacher_group_id: assignment.teacher_group_id,
      });
      teacherUsage.set(`${assignment.usageKey}|${day}|${period}`, true);
      placed_count++;
      break;
    }
  }

  return { entries: [...placed.values()], placed_count, required_count };
}

// ── スコア計算 ──────────────────────────────────────────────────────────

function calcScore({ placed_count, required_count, entries }) {
  const placeRate = required_count > 0 ? placed_count / required_count : 1;
  const withTeacher = entries.filter(e => e.teacher_id || e.teacher_group_id).length;
  const teachRate = entries.length > 0 ? withTeacher / entries.length : 1;
  return placeRate * 200 + teachRate * 100; // max 300
}

// ── メインソルバー ──────────────────────────────────────────────────────

function solve(data) {
  const {
    teachers            = [],
    teacher_groups      = [],
    structure           = {},
    fixed_slots         = [],
    subject_placement   = {},
    cross_grade_groups  = [],
    class_groups        = [],
    subject_pairings    = [],
    alt_week_pairs      = [],
    subject_sequences   = [],
    existing_timetable  = [],
    settings            = {},
    time_limit          = 10,
  } = data;

  const lunchAfterPeriod = settings.lunch_after_period ?? 4;
  const startMs = Date.now();

  // クラス一覧
  const classes = [];
  for (const g of (structure.grades || [])) {
    for (const cn of (g.classes || []))
      classes.push({ grade: g.grade, class_name: cn, isSpecial: false });
    for (const cn of (g.special_classes || []))
      classes.push({ grade: g.grade, class_name: cn, isSpecial: true });
  }

  if (classes.length === 0) {
    return { entries: [], placed_count: 0, required_count: 0 };
  }

  // 固定コマ（classRequiredSlots より先に展開する）
  const fixedSlotKeys = new Set();
  const fixedEntries  = [];
  for (const slot of fixed_slots) {
    for (const cls of classes) {
      const match =
        slot.scope === 'all' ||
        (slot.scope === 'grade' && cls.grade === slot.grade) ||
        (slot.scope === 'class' && cls.grade === slot.grade && cls.class_name === slot.class_name);
      if (!match) continue;
      const key = `${cls.grade}|${cls.class_name}|${slot.day_of_week}|${slot.period}`;
      fixedSlotKeys.add(key);
      if (slot.subject) {
        fixedEntries.push({
          day_of_week: slot.day_of_week, period: slot.period,
          grade: cls.grade, class_name: cls.class_name,
          subject: slot.subject, teacher_id: null,
        });
      }
    }
  }

  // 既存の手動配置エントリを fixedSlotKeys・fixedEntries にマージ
  // （空きコマ埋めモード時に渡される。これにより必要コマ数の計算と重複配置を防ぐ）
  for (const entry of existing_timetable) {
    const key = `${entry.grade}|${entry.class_name}|${entry.day_of_week}|${entry.period}`;
    if (fixedSlotKeys.has(key)) continue; // 固定コマと重複する場合はスキップ
    fixedSlotKeys.add(key);
    if (entry.subject) {
      fixedEntries.push({
        day_of_week: entry.day_of_week, period: entry.period,
        grade: entry.grade, class_name: entry.class_name,
        subject: entry.subject, teacher_id: entry.teacher_id || null,
      });
      // 隔週授業の場合、alt_subject も同一コマで要件を満たすため別エントリとして計上する
      if (entry.alt_subject) {
        fixedEntries.push({
          day_of_week: entry.day_of_week, period: entry.period,
          grade: entry.grade, class_name: entry.class_name,
          subject: entry.alt_subject, teacher_id: entry.teacher_id || null,
        });
      }
    }
  }

  // クラスごとの必要教科スロット（固定コマ＋既存エントリ分を差し引く）
  // ※ fixedEntries 展開後に計算することで、配置済みコマを正確に除外できる
  const classRequiredSlots = {};
  for (const cls of classes) {
    const reqKey = cls.isSpecial ? `${cls.grade}_特支` : `${cls.grade}_通常`;
    const req    = structure.required_hours?.[reqKey] || {};

    // この学年・クラスの配置済みコマで既に配置されている教科ごとのカウント
    const fixedCounts = {};
    for (const fe of fixedEntries) {
      if (fe.grade === cls.grade && fe.class_name === cls.class_name && fe.subject) {
        fixedCounts[fe.subject] = (fixedCounts[fe.subject] || 0) + 1;
      }
    }

    const slots = [];
    for (const [subj, cnt] of Object.entries(req)) {
      const alreadyFixed = fixedCounts[subj] || 0;
      const remaining    = Math.max(0, cnt - alreadyFixed);
      for (let i = 0; i < remaining; i++) slots.push(subj);
    }
    classRequiredSlots[`${cls.grade}|${cls.class_name}`] = slots;
  }

  // 合同授業（cross_grade_groups）の分を classRequiredSlots から差し引く
  // ※ tryOnce の crossGradeGroups フェーズで配置するため、soloTasks と重複しないよう除外する
  for (const grp of cross_grade_groups) {
    if (!grp.subject || !grp.participants) continue;
    const subtractCount = grp.count || 1;
    for (const p of grp.participants) {
      const key = `${p.grade}|${p.class_name}`;
      if (!classRequiredSlots[key]) continue;
      let removed = 0;
      classRequiredSlots[key] = classRequiredSlots[key].filter(s => {
        if (s === grp.subject && removed < subtractCount) { removed++; return false; }
        return true;
      });
    }
  }

  // 合同クラス（class_groups）の処理
  // split_subjects 以外の教科は全クラスを同一スロットに配置する classGroupTasks を生成する
  const classGroupTasks = [];
  for (const grp of class_groups) {
    const { grade, classes: grpClasses, split_subjects = [] } = grp;
    if (!grpClasses || grpClasses.length < 2) continue;

    const keys = grpClasses.map(cn => `${grade}|${cn}`);

    // 全クラスに共通する非分割教科のうち、最小コマ数を joint count とする
    const subjectMinCounts = {};
    for (const key of keys) {
      const counts = {};
      for (const s of (classRequiredSlots[key] || [])) {
        if (!split_subjects.includes(s)) counts[s] = (counts[s] || 0) + 1;
      }
      for (const [subj, cnt] of Object.entries(counts)) {
        subjectMinCounts[subj] = subjectMinCounts[subj] === undefined
          ? cnt
          : Math.min(subjectMinCounts[subj], cnt);
      }
    }

    for (const [subj, cnt] of Object.entries(subjectMinCounts)) {
      // 各クラスの required slots から差し引く
      for (const key of keys) {
        let removed = 0;
        classRequiredSlots[key] = (classRequiredSlots[key] || []).filter(s => {
          if (s === subj && removed < cnt) { removed++; return false; }
          return true;
        });
      }
      // グループタスクを生成
      for (let i = 0; i < cnt; i++) {
        classGroupTasks.push({ grade, classNames: grpClasses, subject: subj });
      }
    }
  }

  // 隔週授業ペア（alt_week_pairs）の分を差し引き、altTasks を生成
  // ※ 1スロットが subject_a / subject_b 両方の要件を満たす（隔週で使い回し）
  const altTasks = [];
  for (const pair of alt_week_pairs) {
    const sepIdx = pair.class_key.indexOf('|');
    if (sepIdx < 0) continue;
    const grade      = Number(pair.class_key.slice(0, sepIdx));
    const class_name = pair.class_key.slice(sepIdx + 1);
    const key        = `${grade}|${class_name}`;
    if (!classRequiredSlots[key]) continue;

    const pairCount = pair.count || 1;

    // subject_a を差し引く
    let removedA = 0;
    classRequiredSlots[key] = classRequiredSlots[key].filter(s => {
      if (s === pair.subject_a && removedA < pairCount) { removedA++; return false; }
      return true;
    });
    // subject_b を差し引く
    let removedB = 0;
    classRequiredSlots[key] = classRequiredSlots[key].filter(s => {
      if (s === pair.subject_b && removedB < pairCount) { removedB++; return false; }
      return true;
    });

    const cls = classes.find(c => c.grade === grade && c.class_name === class_name);
    if (!cls) continue;

    for (let i = 0; i < pairCount; i++) {
      altTasks.push({
        grade, class_name, isSpecial: cls.isSpecial,
        subject_a: pair.subject_a, subject_b: pair.subject_b,
      });
    }
  }

  // 連続配置ペアの処理（subject_a → subject_b を連続2コマで配置）
  const sequenceTasks = [];
  for (const seq of subject_sequences) {
    const targets = classes.filter(c =>
      c.grade === seq.grade &&
      (seq.class_name == null || c.class_name === seq.class_name)
    );
    for (const cls of targets) {
      const key = `${cls.grade}|${cls.class_name}`;
      if (!classRequiredSlots[key]) continue;

      // subject_a / subject_b それぞれ1コマずつ差し引く
      let removedA = 0;
      classRequiredSlots[key] = classRequiredSlots[key].filter(s => {
        if (s === seq.subject_a && removedA < 1) { removedA++; return false; }
        return true;
      });
      let removedB = 0;
      classRequiredSlots[key] = classRequiredSlots[key].filter(s => {
        if (s === seq.subject_b && removedB < 1) { removedB++; return false; }
        return true;
      });
      if (removedA === 0 && removedB === 0) continue;

      sequenceTasks.push({
        grade: cls.grade, class_name: cls.class_name, isSpecial: cls.isSpecial,
        subject_a: seq.subject_a, subject_b: seq.subject_b,
      });
    }
  }

  const params = {
    classes, classRequiredSlots,
    teachers, teacherGroups: teacher_groups,
    fixedSlotKeys, fixedEntries,
    subjectPlacement: subject_placement,
    lunchAfterPeriod,
    crossGradeGroups: cross_grade_groups,
    subjectPairings:  subject_pairings,
    altTasks,
    classGroupTasks,
    sequenceTasks,
  };

  let bestResult = null;
  let bestScore  = -1;
  let attempts   = 0;

  while (Date.now() - startMs < time_limit * 1000) {
    attempts++;
    const result = tryOnce(params);
    const score  = calcScore(result);

    if (score > bestScore) {
      bestScore  = score;
      bestResult = result;
      const pct = Math.min(99, Math.round((result.placed_count / Math.max(1, result.required_count)) * 100));
      self.postMessage({ type: 'progress', score: pct, attempts, placed: result.placed_count, required: result.required_count });
    }

    // 完全解に達したら終了
    if (score >= 300) break;

    if (attempts % 10 === 0) {
      const pct = Math.min(99, Math.round((bestResult.placed_count / Math.max(1, bestResult.required_count)) * 100));
      self.postMessage({ type: 'progress', score: pct, attempts, placed: bestResult.placed_count, required: bestResult.required_count });
    }
  }

  return bestResult || { entries: fixedEntries, placed_count: fixedEntries.length, required_count: 0 };
}

// ── Web Worker メッセージハンドラ ─────────────────────────────────────

self.onmessage = (e) => {
  if (e.data?.type === 'solve') {
    try {
      const result = solve(e.data.data);
      self.postMessage({
        type: 'done',
        timetable: result.entries,
        count: result.entries.length,
        placed: result.placed_count,
        required: result.required_count,
      });
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message });
    }
  }
};
