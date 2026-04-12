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
function findTeacherOrGroup(grade, isSpecial, subject, day, period, teachers, teacherGroups, teacherUsage) {
  for (const t of teachers) {
    if (t.subjects.includes('特別支援') && !isSpecial) continue;
    if (!t.subjects.includes('特別支援') && !t.subjects.includes(subject)) continue;
    if (!t.target_grades.includes(grade)) continue;
    if (t.unavailable_times?.some(u => u.day_of_week === day && u.period === period)) continue;
    if (teacherUsage.has(`${t.id}|${day}|${period}`)) continue;
    return { teacher_id: t.id, teacher_group_id: null, usageKey: t.id };
  }
  for (const g of (teacherGroups || [])) {
    if (!(g.subjects || []).includes(subject)) continue;
    if ((g.target_grades || []).length > 0 && !(g.target_grades).includes(grade)) continue;
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
    teachers           = [],
    teacher_groups     = [],
    structure          = {},
    fixed_slots        = [],
    subject_placement  = {},
    existing_timetable = [],
    time_limit         = 30,
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

  // ── 教員の静的制約を fixedZero に反映 ─────────────────────────────
  // ある (クラス, 曜日, 時限, 教科) に配置できる教員が1人もいない場合、
  // その変数を fixedZero にしてMIPが解かないようにする。
  // これにより教員なし（空きなし）の配置を事前に防ぐ。
  for (let ci = 0; ci < C; ci++) {
    const cls = classes[ci];
    for (let si = 0; si < S; si++) {
      const subj = subjects[si];
      // 特別支援クラスの教科は「特別支援」担当教員のみ
      for (let d = 0; d < 5; d++) {
        const day = DAYS[d];
        for (let p = 0; p < 6; p++) {
          const period = PERIODS[p];
          const key = vn(ci, d, p, si);
          if (fixedZero.has(key) || fixedOne.has(key)) continue;

          // この (教科, 学年, 曜日, 時限) に対応できる教員が存在するか確認
          // jsSolver.worker.js の findTeacherOrGroup と同じ条件で判定する
          let hasTeacher = false;
          for (const t of teachers) {
            // 特支専任教員は通常クラスへの配置不可
            if (t.subjects.includes('特別支援') && !cls.isSpecial) continue;
            // 通常クラスの場合: 教科不一致はスキップ（特支クラスは 特別支援 教員が全教科担当可）
            if (!t.subjects.includes('特別支援') && !t.subjects.includes(subj)) continue;
            if (!(t.target_grades || []).includes(cls.grade)) continue;
            if ((t.unavailable_times || []).some(u => u.day_of_week === day && u.period === period)) continue;
            hasTeacher = true;
            break;
          }
          // 教員グループでも確認
          if (!hasTeacher) {
            for (const g of teacher_groups) {
              if (!(g.subjects || []).includes(subj)) continue;
              if ((g.target_grades || []).length > 0 && !(g.target_grades).includes(cls.grade)) continue;
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

  for (const group of slotGroups.values()) {
    // 選択可能な教員数を静的にカウントしてソート（少ない順 = 制約の強い順）
    const withCount = group.map(e => {
      const cls = classes.find(c => c.grade === e.grade && c.class_name === e.class_name);
      let cnt = 0;
      for (const t of teachers) {
        if (t.subjects.includes('特別支援') && !cls?.isSpecial) continue;
        if (!t.subjects.includes('特別支援') && !t.subjects.includes(e.subject)) continue;
        if (!(t.target_grades || []).includes(e.grade)) continue;
        if ((t.unavailable_times || []).some(u => u.day_of_week === e.day_of_week && u.period === e.period)) continue;
        cnt++;
      }
      return { entry: e, cnt };
    });
    withCount.sort((a, b) => a.cnt - b.cnt);

    for (const { entry } of withCount) {
      const cls = classes.find(c => c.grade === entry.grade && c.class_name === entry.class_name);
      if (!cls) continue;
      const assignment = findTeacherOrGroup(
        entry.grade, cls.isSpecial, entry.subject,
        entry.day_of_week, entry.period,
        teachers, teacher_groups, teacherUsage
      );
      if (assignment) {
        entry.teacher_id        = assignment.teacher_id;
        entry.teacher_group_id  = assignment.teacher_group_id;
        teacherUsage.set(`${assignment.usageKey}|${entry.day_of_week}|${entry.period}`, true);
      }
    }
  }

  // 必要時数の合計（配置率計算用）
  let totalRequired = 0;
  for (let c = 0; c < C; c++)
    for (let s = 0; s < S; s++)
      totalRequired += reqMatrix[c][s];

  const placed = outputEntries.filter(e => e.subject).length;
  return { entries: outputEntries, placed, required: totalRequired };
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
