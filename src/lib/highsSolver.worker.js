/**
 * highsSolver.worker.js
 * HiGHS（WASM）を使ったブラウザ内 MIP ソルバー
 *
 * ※ クラシック Worker（ESモジュール形式ではない）
 *    SolverPanel から渡される baseUrl を使って
 *    public/highs.js を importScripts で読み込む。
 *
 * アルゴリズム:
 *   1. 時間割配置を混合整数計画問題（MIP）として定式化
 *   2. HiGHS WASM で厳密に解く（教科の時数充足を最大化）
 *   3. 解を取り出した後、教員を欲張り法で割り当て
 *
 * OR-Tools（Python サーバー）の代替として動作する。
 */

/* eslint-disable no-undef */

const DAYS    = ['月', '火', '水', '木', '金'];
const PERIODS = [1, 2, 3, 4, 5, 6];

// ── 教員・教員グループ探索（jsSolver と共通ロジック） ─────────────────
// extraGrades: 学年横断合同の場合に参加学年セットを渡すと、その学年も担当可能とみなす
function findTeacherOrGroup(grade, isSpecial, subject, day, period, teachers, teacherGroups, teacherUsage, extraGrades) {
  for (const t of teachers) {
    if (t.subjects.includes('特別支援') && !isSpecial) continue;
    if (!t.subjects.includes('特別支援') && !t.subjects.includes(subject)) continue;
    const gradeOk = (t.target_grades || []).includes(grade) ||
      (extraGrades && [...extraGrades].some(g => (t.target_grades || []).includes(g)));
    if (!gradeOk) continue;
    if (t.unavailable_times?.some(u => u.day_of_week === day && u.period === period)) continue;
    if (teacherUsage.has(`${t.id}|${day}|${period}`)) continue;
    return { teacher_id: t.id, teacher_group_id: null, usageKey: t.id };
  }
  for (const g of (teacherGroups || [])) {
    if (!(g.subjects || []).includes(subject)) continue;
    const gradeOk = (g.target_grades || []).length === 0 ||
      (g.target_grades || []).includes(grade) ||
      (extraGrades && [...extraGrades].some(gr => (g.target_grades || []).includes(gr)));
    if (!gradeOk) continue;
    if (teacherUsage.has(`${g.id}|${day}|${period}`)) continue;
    return { teacher_id: null, teacher_group_id: g.id, usageKey: g.id };
  }
  return null;
}

// ── MIP を LP 文字列として構築 ─────────────────────────────────────────
function buildLP({ classes, subjects, reqMatrix, fixedOne, fixedZero, subjectPlacement, teachers, teacher_groups, entryMap }) {
  const C = classes.length;
  const S = subjects.length;

  // 変数名: x{c}_{d}_{p}_{s}
  const vn = (c, d, p, s) => `x${c}_${d}_${p}_${s}`;
  const isFree = (c, d, p, s) => !fixedZero.has(vn(c,d,p,s)) && !fixedOne.has(vn(c,d,p,s));

  const objTerms  = [];
  const cstLines  = [];
  const bndLines  = [];
  const slkLines  = [];
  const genVars   = [];

  // ── 制約1: 各(クラス, 教科)の必要時数  ───────────────────────────
  for (let c = 0; c < C; c++) {
    for (let s = 0; s < S; s++) {
      const need = reqMatrix[c][s];
      if (need <= 0) continue;

      let fixedCnt = 0;
      for (let d = 0; d < 5; d++)
        for (let p = 0; p < 6; p++)
          if (fixedOne.has(vn(c,d,p,s))) fixedCnt++;

      const remaining = need - fixedCnt;
      if (remaining <= 0) continue;

      const terms = [];
      for (let d = 0; d < 5; d++)
        for (let p = 0; p < 6; p++)
          if (isFree(c, d, p, s)) terms.push(vn(c,d,p,s));

      if (terms.length === 0) continue;

      const slk = `sl_${c}_${s}`;
      objTerms.push(`1000 ${slk}`);
      slkLines.push(`  0 <= ${slk}`);
      cstLines.push(`  req_${c}_${s}: ${terms.join(' + ')} + ${slk} = ${remaining}`);
      terms.forEach(v => { genVars.push(v); });
    }
  }

  // ── 制約2: 1スロットに1教科まで ─────────────────────────────────
  for (let c = 0; c < C; c++) {
    for (let d = 0; d < 5; d++) {
      for (let p = 0; p < 6; p++) {
        let fixedCnt = 0;
        for (let s = 0; s < S; s++) if (fixedOne.has(vn(c,d,p,s))) fixedCnt++;

        const terms = [];
        for (let s = 0; s < S; s++) if (isFree(c, d, p, s)) terms.push(vn(c,d,p,s));

        if (fixedCnt > 0 && terms.length > 0) {
          cstLines.push(`  slot_${c}_${d}_${p}: ${terms.join(' + ')} <= 0`);
        } else if (terms.length > 1) {
          cstLines.push(`  slot_${c}_${d}_${p}: ${terms.join(' + ')} <= 1`);
        }
      }
    }
  }

  // ── 制約3: 1日あたりの教科配置上限 ────────────────────────────────
  for (let c = 0; c < C; c++) {
    for (let s = 0; s < S; s++) {
      const sp  = subjectPlacement[subjects[s]] || {};
      const max = sp.max_daily ?? 1;
      for (let d = 0; d < 5; d++) {
        const terms = [];
        for (let p = 0; p < 6; p++) if (isFree(c, d, p, s)) terms.push(vn(c,d,p,s));
        if (terms.length > max) {
          cstLines.push(`  daily_${c}_${s}_${d}: ${terms.join(' + ')} <= ${max}`);
        }
      }
    }
  }

  // ── 制約4: 教員競合（同一教員が同一時間帯に複数クラスを担当しない） ──
  // 各教員について、その教員が担当できる (クラス, 教科) の組み合わせが
  // 同じ (曜日, 時限) に複数配置されることを防ぐ。
  // 教員が「ボトルネック」（担当クラス数 > 1）の場合のみ制約を追加して LP サイズを抑制。
  const DAYS_LP    = ['月', '火', '水', '木', '金'];
  const PERIODS_LP = [1, 2, 3, 4, 5, 6];

  // 教員グループ（道徳など）も同様に競合制約を適用
  const allEntities = [
    ...(teachers || []).map(t => ({ id: t.id, isGroup: false, obj: t })),
    ...(teacher_groups || []).map(g => ({ id: g.id, isGroup: true, obj: g })),
  ];

  let teacherCstIdx = 0;
  for (const { id, isGroup, obj } of allEntities) {
    for (let d = 0; d < 5; d++) {
      const day = DAYS_LP[d];
      // 配置不可時間は教員オブジェクトにのみ存在（グループには無し）
      const unavailPeriods = isGroup ? [] :
        (obj.unavailable_times || []).filter(u => u.day_of_week === day).map(u => u.period);

      for (let p = 0; p < 6; p++) {
        const period = PERIODS_LP[p];
        if (unavailPeriods.includes(period)) continue;

        // この教員が (day, period) に担当できる自由変数の一覧を収集
        const terms = [];
        for (let c = 0; c < C; c++) {
          const cls = classes[c];
          for (let s = 0; s < S; s++) {
            if (!isFree(c, d, p, s)) continue;
            const subj = subjects[s];
            if (isGroup) {
              // 教員グループ: 担当教科と対象学年を確認
              if (!(obj.subjects || []).includes(subj)) continue;
              if ((obj.target_grades || []).length > 0 && !(obj.target_grades).includes(cls.grade)) continue;
            } else {
              // 個人教員: 特支専任 / 通常教科チェック
              if (obj.subjects.includes('特別支援') && !cls.isSpecial) continue;
              if (!obj.subjects.includes('特別支援') && !obj.subjects.includes(subj)) continue;
              if (!(obj.target_grades || []).includes(cls.grade)) continue;
            }
            terms.push(vn(c, d, p, s));
          }
        }

        // entryMap から実際に割り当て済みの固定コマをカウント
        // （teacher_id / teacher_group_id が一致するエントリが同時間帯に存在するか）
        let fixedUsed = 0;
        for (const entry of (entryMap ? entryMap.values() : [])) {
          if (entry.day_of_week !== day || entry.period !== period) continue;
          if (isGroup) {
            if (entry.teacher_group_id === id) fixedUsed++;
          } else {
            if (entry.teacher_id === id) fixedUsed++;
          }
        }

        const available = 1 - fixedUsed; // この時間帯に追加配置できる上限
        if (available <= 0) {
          // 既に割り当て済みで埋まっているので自由変数は全部 0 に
          if (terms.length > 0) {
            cstLines.push(`  tc_${teacherCstIdx++}: ${terms.join(' + ')} <= 0`);
          }
        } else if (terms.length > available) {
          cstLines.push(`  tc_${teacherCstIdx++}: ${terms.join(' + ')} <= ${available}`);
        }
      }
    }
  }

  const uniqueVars = [...new Set(genVars)];
  uniqueVars.forEach(v => bndLines.push(`  0 <= ${v} <= 1`));

  if (uniqueVars.length === 0) return null;

  return [
    'Minimize',
    `  obj: ${objTerms.length ? objTerms.join(' + ') : '0'}`,
    'Subject To',
    ...cstLines,
    'Bounds',
    ...bndLines,
    ...slkLines,
    'General',
    `  ${uniqueVars.join(' ')}`,
    'End',
  ].join('\n');
}

// ── メインソルバー ─────────────────────────────────────────────────────
async function solve(data, wasmUrl) {
  const {
    teachers            = [],
    teacher_groups      = [],
    structure           = {},
    fixed_slots         = [],
    subject_placement   = {},
    existing_timetable  = [],
    class_groups        = [],
    cross_grade_groups  = [],
    time_limit          = 30,
  } = data;

  // クラス一覧
  const classes = [];
  for (const g of (structure.grades || [])) {
    for (const cn of (g.classes || []))
      classes.push({ grade: g.grade, class_name: cn, isSpecial: false });
    for (const cn of (g.special_classes || []))
      classes.push({ grade: g.grade, class_name: cn, isSpecial: true });
  }
  if (classes.length === 0) return { entries: [], placed: 0, required: 0 };

  // 教科一覧
  const subjectSet = new Set();
  for (const key of Object.keys(structure.required_hours || {}))
    for (const s of Object.keys(structure.required_hours[key] || {}))
      subjectSet.add(s);
  const subjects = [...subjectSet];
  if (subjects.length === 0) return { entries: [], placed: 0, required: 0 };

  const C = classes.length;
  const S = subjects.length;
  const vn = (c, d, p, s) => `x${c}_${d}_${p}_${s}`;

  // 必要時数行列
  const reqMatrix = classes.map(cls => {
    const reqKey = cls.isSpecial ? `${cls.grade}_特支` : `${cls.grade}_通常`;
    const r = structure.required_hours?.[reqKey] || {};
    return subjects.map(subj => r[subj] ?? 0);
  });

  // 配置率計算用の合計（合同クラス処理で reqMatrix を修正する前に計算）
  let totalRequired = 0;
  for (let c = 0; c < C; c++)
    for (let s = 0; s < S; s++)
      totalRequired += reqMatrix[c][s];

  const fixedOne  = new Set();
  const fixedZero = new Set();
  // slotKey → entry のマップで管理して重複エントリを防ぐ
  const entryMap  = new Map(); // `grade|class_name|day|period` → entry
  const addEntry  = (e) => {
    const k = `${e.grade}|${e.class_name}|${e.day_of_week}|${e.period}`;
    if (!entryMap.has(k)) entryMap.set(k, e);
  };

  // fixed_slots を処理
  for (const slot of fixed_slots) {
    const di = DAYS.indexOf(slot.day_of_week);
    const pi = PERIODS.indexOf(slot.period);
    if (di < 0 || pi < 0) continue;

    for (let ci = 0; ci < C; ci++) {
      const cls = classes[ci];
      const match =
        slot.scope === 'all' ||
        (slot.scope === 'grade' && cls.grade === slot.grade) ||
        (slot.scope === 'class' && cls.grade === slot.grade && cls.class_name === slot.class_name);
      if (!match) continue;

      for (let si = 0; si < S; si++) fixedZero.add(vn(ci, di, pi, si));

      if (slot.subject) {
        const si = subjects.indexOf(slot.subject);
        if (si >= 0) {
          fixedZero.delete(vn(ci, di, pi, si));
          fixedOne.add(vn(ci, di, pi, si));
          addEntry({
            day_of_week: slot.day_of_week, period: slot.period,
            grade: cls.grade, class_name: cls.class_name,
            subject: slot.subject, teacher_id: null, teacher_group_id: null,
          });
        }
      }
    }
  }

  // existing_timetable を処理
  for (const entry of existing_timetable) {
    const ci = classes.findIndex(c => c.grade === entry.grade && c.class_name === entry.class_name);
    if (ci < 0) continue;
    const di = DAYS.indexOf(entry.day_of_week);
    const pi = PERIODS.indexOf(entry.period);
    if (di < 0 || pi < 0) continue;

    for (let si = 0; si < S; si++) fixedZero.add(vn(ci, di, pi, si));

    if (entry.subject) {
      const si = subjects.indexOf(entry.subject);
      if (si >= 0) {
        fixedZero.delete(vn(ci, di, pi, si));
        fixedOne.add(vn(ci, di, pi, si));
      }
      if (entry.alt_subject) {
        const altSi = subjects.indexOf(entry.alt_subject);
        if (altSi >= 0) fixedOne.add(vn(ci, di, pi, altSi));
      }
      addEntry({ ...entry });
    }
  }

  // subject_placement の allowed_periods / allowed_days 制約
  for (let ci = 0; ci < C; ci++) {
    for (let si = 0; si < S; si++) {
      const sp           = subject_placement[subjects[si]] || {};
      const allowedP     = sp.allowed_periods || [];
      const allowedDays  = sp.allowed_days    || [];
      for (let d = 0; d < 5; d++) {
        // 許可曜日制限
        if (allowedDays.length > 0 && !allowedDays.includes(DAYS[d])) {
          for (let p = 0; p < 6; p++) fixedZero.add(vn(ci, d, p, si));
          continue;
        }
        // 許可時限制限
        if (allowedP.length > 0) {
          for (let p = 0; p < 6; p++)
            if (!allowedP.includes(PERIODS[p])) fixedZero.add(vn(ci, d, p, si));
        }
      }
    }
  }

  // ── 合同クラスグループの処理 ───────────────────────────────────────
  // class_groups で定義された合同クラスは、split_subjects 以外の教科を
  // グループ内の「代表クラス」1つだけ MIP で配置し、後で他クラスにコピーする。
  // こうすることで LP サイズを削減しつつ、教員が同時間帯に重複配置されることを防ぐ。
  // `groupInfo`: `repCi|si` → グループ全員のクラスインデックス配列
  const groupInfo = new Map();

  for (const grp of class_groups) {
    const { grade, classes: grpClassNames, split_subjects = [] } = grp;
    if (!grpClassNames || grpClassNames.length < 2) continue;

    const groupCis = grpClassNames
      .map(cn => classes.findIndex(c => c.grade === grade && c.class_name === cn))
      .filter(ci => ci >= 0);
    if (groupCis.length < 2) continue;

    const repCi    = groupCis[0];       // 代表クラス（MIP で配置する）
    const otherCis = groupCis.slice(1); // 非代表クラス（LP から除外して後でコピー）

    for (let si = 0; si < S; si++) {
      const subj = subjects[si];
      if (split_subjects.includes(subj)) continue; // 分割教科はそれぞれ独立配置

      // グループ内のどこかにこの教科の要件があれば合同対象とする
      const anyReq = groupCis.some(ci => reqMatrix[ci][si] > 0);
      if (!anyReq) continue;

      // 非代表クラスの slots を fixedZero にして LP から除外
      for (const ci of otherCis) {
        for (let d = 0; d < 5; d++)
          for (let p = 0; p < 6; p++)
            if (!fixedOne.has(vn(ci, d, p, si))) fixedZero.add(vn(ci, d, p, si));
        // LP では配置しない（後でコピーするため必要量を 0 に）
        reqMatrix[ci][si] = 0;
      }

      // 後でコピーするためにグループ情報を保存
      groupInfo.set(`${repCi}|${si}`, groupCis);
    }
  }

  // ── 学年横断合同授業グループの処理 ───────────────────────────────────
  // cross_grade_groups で定義された合同授業（例: 保体の全学年合同）は、
  // 参加クラスのうち先頭の「代表クラス」だけを MIP で配置し、後で全員にコピーする。
  // crossGroupList: { repCi, si, participantCis, participatingGrades }[]
  // crossRepGrades: Map<`ci|si`, Set<grade>>  — 教員プリフィルタ・割り当てで参照
  const crossGroupList  = [];
  const crossRepGrades  = new Map(); // repCi|si → 参加学年セット

  for (const grp of cross_grade_groups) {
    if (!grp.subject || !grp.participants || grp.participants.length < 2) continue;
    const si = subjects.indexOf(grp.subject);
    if (si < 0) continue;

    const participantCis = grp.participants
      .map(p => classes.findIndex(c => c.grade === p.grade && c.class_name === p.class_name))
      .filter(ci => ci >= 0);
    if (participantCis.length < 2) continue;

    const participatingGrades = new Set(grp.participants.map(p => p.grade));
    const repCi    = participantCis[0];
    const otherCis = participantCis.slice(1);

    // 非代表クラスを fixedZero にして LP から除外
    for (const ci of otherCis) {
      for (let d = 0; d < 5; d++)
        for (let p = 0; p < 6; p++)
          if (!fixedOne.has(vn(ci, d, p, si))) fixedZero.add(vn(ci, d, p, si));
      reqMatrix[ci][si] = 0;
    }

    // 代表クラスの教員探索で参加学年全体を考慮できるよう記録
    const repKey = `${repCi}|${si}`;
    if (!crossRepGrades.has(repKey)) crossRepGrades.set(repKey, new Set());
    for (const g of participatingGrades) crossRepGrades.get(repKey).add(g);

    crossGroupList.push({ repCi, si, participantCis, participatingGrades });
  }

  // ── 教員の静的制約を fixedZero に反映 ─────────────────────────────
  // ある (クラス, 曜日, 時限, 教科) に配置できる教員が1人もいない場合、
  // その変数を fixedZero にしてMIPが解かないようにする。
  // 学年横断合同の代表クラスは参加学年全体で教員を探す。
  for (let ci = 0; ci < C; ci++) {
    const cls = classes[ci];
    for (let si = 0; si < S; si++) {
      const subj = subjects[si];
      const extraGrades = crossRepGrades.get(`${ci}|${si}`); // 学年横断合同の参加学年（あれば）
      for (let d = 0; d < 5; d++) {
        const day = DAYS[d];
        for (let p = 0; p < 6; p++) {
          const period = PERIODS[p];
          const key = vn(ci, d, p, si);
          if (fixedZero.has(key) || fixedOne.has(key)) continue;

          let hasTeacher = false;
          for (const t of teachers) {
            if (t.subjects.includes('特別支援') && !cls.isSpecial) continue;
            if (!t.subjects.includes('特別支援') && !t.subjects.includes(subj)) continue;
            // 通常学年チェック + 学年横断合同の参加学年もチェック
            const gradeOk = (t.target_grades || []).includes(cls.grade) ||
              (extraGrades && [...extraGrades].some(g => (t.target_grades || []).includes(g)));
            if (!gradeOk) continue;
            if ((t.unavailable_times || []).some(u => u.day_of_week === day && u.period === period)) continue;
            hasTeacher = true;
            break;
          }
          if (!hasTeacher) {
            for (const g of teacher_groups) {
              if (!(g.subjects || []).includes(subj)) continue;
              const gradeOk = (g.target_grades || []).length === 0 ||
                (g.target_grades || []).includes(cls.grade) ||
                (extraGrades && [...extraGrades].some(gr => (g.target_grades || []).includes(gr)));
              if (!gradeOk) continue;
              hasTeacher = true;
              break;
            }
          }
          if (!hasTeacher) fixedZero.add(key);
        }
      }
    }
  }

  // LP を構築
  self.postMessage({ type: 'progress', score: 15, attempts: 0 });

  const lpStr = buildLP({ classes, subjects, reqMatrix, fixedOne, fixedZero, subjectPlacement: subject_placement, teachers, teacher_groups, entryMap });

  if (!lpStr) {
    const entries = [...entryMap.values()];
    return { entries, placed: entries.filter(e => e.subject).length, required: 0 };
  }

  // HiGHS で解く
  self.postMessage({ type: 'progress', score: 20, attempts: 0 });

  // importScripts で public/highs.js を読み込む（クラシックWorker）
  // Module は highs.js がグローバルに定義する Emscripten 初期化関数
  importScripts(wasmUrl.replace(/highs\.wasm$/, 'highs.js'));

  self.postMessage({ type: 'progress', score: 25, attempts: 0 });

  // HiGHS を初期化（locateFile で WASM のパスを指定）
  // eslint-disable-next-line no-undef
  const highs = await Module({ locateFile: () => wasmUrl });

  self.postMessage({ type: 'progress', score: 30, attempts: 0 });

  // output_flag: false にすると solution 出力まで抑制されて parse エラーになるため
  // time_limit のみ渡す（Worker 内なのでコンソール出力はユーザーには見えない）
  const result = highs.solve(lpStr, { time_limit });

  self.postMessage({ type: 'progress', score: 85, attempts: 0 });

  // 解を取り出す（entryMap のキーセットで重複を防ぐ）
  if (result.Status === 'Optimal' || result.Status === 'Feasible' || result.Status === 'Time limit reached') {
    const cols = result.Columns;
    for (const [varName, colInfo] of Object.entries(cols)) {
      if (!varName.startsWith('x')) continue;
      if ((colInfo.Primal ?? 0) < 0.5) continue;

      const parts = varName.slice(1).split('_').map(Number);
      if (parts.length !== 4) continue;
      const [ci, di, pi, si] = parts;
      if (ci >= C || di >= 5 || pi >= 6 || si >= S) continue;

      const cls    = classes[ci];
      const day    = DAYS[di];
      const period = PERIODS[pi];
      const subj   = subjects[si];

      addEntry({
        day_of_week: day, period,
        grade: cls.grade, class_name: cls.class_name,
        subject: subj,
        teacher_id: null, teacher_group_id: null,
      });
    }
  }

  // entryMap からエントリ配列を取得
  const outputEntries = [...entryMap.values()];

  // ── 教員を MRV（制約の少ない順）で割り当て ───────────────────────
  // 同一スロットに複数クラスが集まる場合、選択肢の少ない（担当可能教員が少ない）
  // クラスから優先的に割り当てることで「空きなし」を最小化する。
  const teacherUsage = new Map();
  for (const e of outputEntries) {
    if (e.teacher_id)       teacherUsage.set(`${e.teacher_id}|${e.day_of_week}|${e.period}`, true);
    if (e.teacher_group_id) teacherUsage.set(`${e.teacher_group_id}|${e.day_of_week}|${e.period}`, true);
  }

  // 教員割り当て対象エントリ（教員未設定かつ教科あり）
  const toAssign = outputEntries.filter(e => !e.teacher_id && !e.teacher_group_id && e.subject);

  // 同一スロット内でまず処理してから次のスロットへ（ day×period ごとにグループ化）
  const slotGroups = new Map();
  for (const e of toAssign) {
    const key = `${e.day_of_week}|${e.period}`;
    if (!slotGroups.has(key)) slotGroups.set(key, []);
    slotGroups.get(key).push(e);
  }

  // 学年横断合同の代表エントリ検索用ルックアップ: `grade|class_name|subject` → 参加学年セット
  const crossRepLookup = new Map();
  for (const { repCi, si, participatingGrades } of crossGroupList) {
    const repCls = classes[repCi];
    crossRepLookup.set(`${repCls.grade}|${repCls.class_name}|${subjects[si]}`, participatingGrades);
  }

  for (const group of slotGroups.values()) {
    // 選択可能な教員数を静的にカウントしてソート（少ない順 = 制約の強い順）
    const withCount = group.map(e => {
      const cls        = classes.find(c => c.grade === e.grade && c.class_name === e.class_name);
      const extraGrades = crossRepLookup.get(`${e.grade}|${e.class_name}|${e.subject}`);
      let cnt = 0;
      for (const t of teachers) {
        if (t.subjects.includes('特別支援') && !cls?.isSpecial) continue;
        if (!t.subjects.includes('特別支援') && !t.subjects.includes(e.subject)) continue;
        const gradeOk = (t.target_grades || []).includes(e.grade) ||
          (extraGrades && [...extraGrades].some(g => (t.target_grades || []).includes(g)));
        if (!gradeOk) continue;
        if ((t.unavailable_times || []).some(u => u.day_of_week === e.day_of_week && u.period === e.period)) continue;
        cnt++;
      }
      return { entry: e, cnt };
    });
    withCount.sort((a, b) => a.cnt - b.cnt);

    for (const { entry } of withCount) {
      const cls        = classes.find(c => c.grade === entry.grade && c.class_name === entry.class_name);
      const extraGrades = crossRepLookup.get(`${entry.grade}|${entry.class_name}|${entry.subject}`);
      if (!cls) continue;
      const assignment = findTeacherOrGroup(
        entry.grade, cls.isSpecial, entry.subject,
        entry.day_of_week, entry.period,
        teachers, teacher_groups, teacherUsage,
        extraGrades, // 学年横断合同の参加学年（通常クラスは undefined）
      );
      if (assignment) {
        entry.teacher_id        = assignment.teacher_id;
        entry.teacher_group_id  = assignment.teacher_group_id;
        teacherUsage.set(`${assignment.usageKey}|${entry.day_of_week}|${entry.period}`, true);
      }
    }
  }

  // ── 合同クラス・学年横断合同の配置を他クラスにコピー（教員割り当て後） ──
  // 代表クラスに割り当てられた教員ごと、グループ内の全クラスにコピーする。
  const copyGroupToOthers = (repCi, si, participantCis) => {
    const repCls = classes[repCi];
    const subj   = subjects[si];
    for (const entry of [...entryMap.values()]) {
      if (entry.grade !== repCls.grade || entry.class_name !== repCls.class_name) continue;
      if (entry.subject !== subj) continue;
      for (const ci of participantCis) {
        if (ci === repCi) continue;
        const cls = classes[ci];
        addEntry({
          day_of_week:      entry.day_of_week,
          period:           entry.period,
          grade:            cls.grade,
          class_name:       cls.class_name,
          subject:          subj,
          teacher_id:       entry.teacher_id,
          teacher_group_id: entry.teacher_group_id,
        });
      }
    }
  };

  // 同学年合同クラス（class_groups）
  for (const [key, groupCis] of groupInfo.entries()) {
    const [repCiStr, siStr] = key.split('|');
    copyGroupToOthers(Number(repCiStr), Number(siStr), groupCis);
  }

  // 学年横断合同（cross_grade_groups）
  for (const { repCi, si, participantCis } of crossGroupList) {
    copyGroupToOthers(repCi, si, participantCis);
  }

  // 最終エントリ（コピー分も含む）
  const finalEntries = [...entryMap.values()];
  const placed = finalEntries.filter(e => e.subject).length;
  return { entries: finalEntries, placed, required: totalRequired };
}

// ── Web Worker メッセージハンドラ ─────────────────────────────────────
self.onmessage = async (e) => {
  if (e.data?.type !== 'solve') return;
  try {
    self.postMessage({ type: 'progress', score: 5, attempts: 0 });

    // baseUrl は SolverPanel から渡される（import.meta.env.BASE_URL）
    const baseUrl = e.data.data?.baseUrl || '/';
    const wasmUrl = baseUrl.replace(/\/$/, '') + '/highs.wasm';

    const { entries, placed, required } = await solve(e.data.data, wasmUrl);
    self.postMessage({ type: 'progress', score: 100, attempts: 0 });
    self.postMessage({
      type: 'done',
      timetable: entries,
      count:     entries.length,
      placed,
      required,
    });
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err?.message ?? err) });
  }
};
