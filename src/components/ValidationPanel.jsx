import { useMemo } from "react";
import { useTimetableStore } from "../store/useTimetableStore";

const DAYS = ["月", "火", "水", "木", "金"];
const PERIODS = [1, 2, 3, 4, 5, 6];

// ─── 違反チェック関数群 ──────────────────────

/** 固定コマ違反: 指定スロットに指定教科が入っていない */
function checkFixedSlotViolations(timetable, fixed_slots, structure) {
  const violations = [];
  for (const slot of fixed_slots || []) {
    const { scope, grade, class_name, day_of_week, period, subject, label } =
      slot;

    // 対象クラスを列挙
    const targets = [];
    for (const g of structure.grades || []) {
      const allClasses = [...(g.classes || []), ...(g.special_classes || [])];
      for (const cn of allClasses) {
        if (scope === "all") targets.push({ grade: g.grade, class_name: cn });
        else if (scope === "grade" && g.grade === grade)
          targets.push({ grade: g.grade, class_name: cn });
        else if (scope === "class" && g.grade === grade && cn === class_name)
          targets.push({ grade: g.grade, class_name: cn });
      }
    }

    for (const { grade: g, class_name: cn } of targets) {
      const entry = timetable.find(
        (e) =>
          e.grade === g &&
          e.class_name === cn &&
          e.day_of_week === day_of_week &&
          e.period === period,
      );
      if (!entry || entry.subject !== subject) {
        violations.push({
          label: label || subject,
          grade: g,
          class_name: cn,
          day_of_week,
          period,
          expected: subject,
          actual: entry?.subject || "（空欄）",
        });
      }
    }
  }
  return violations;
}

/** 教員の1日最大コマ数違反 */
function checkTeacherDailyViolations(timetable, teachers, teacher_constraints) {
  const violations = [];
  for (const teacher of teachers) {
    const max_d = teacher_constraints[teacher.id]?.max_daily;
    if (!max_d) continue;
    for (const day of DAYS) {
      const count = timetable.filter(
        (e) => e.teacher_id === teacher.id && e.day_of_week === day,
      ).length;
      if (count > max_d) {
        violations.push({ teacher: teacher.name, day, count, limit: max_d });
      }
    }
  }
  return violations;
}

/** 教員の連続コマ数違反 */
function checkTeacherConsecutiveViolations(
  timetable,
  teachers,
  teacher_constraints,
) {
  const violations = [];
  for (const teacher of teachers) {
    const max_c = teacher_constraints[teacher.id]?.max_consecutive;
    if (!max_c) continue;
    for (const day of DAYS) {
      let consecutive = 0;
      let maxRun = 0;
      for (const period of PERIODS) {
        const assigned = timetable.some(
          (e) =>
            e.teacher_id === teacher.id &&
            e.day_of_week === day &&
            e.period === period,
        );
        if (assigned) {
          consecutive++;
          if (consecutive > maxRun) maxRun = consecutive;
        } else {
          consecutive = 0;
        }
      }
      if (maxRun > max_c) {
        violations.push({ teacher: teacher.name, day, maxRun, limit: max_c });
      }
    }
  }
  return violations;
}

/** 教科の配置可能時限違反 */
function checkSubjectPeriodViolations(timetable, subject_placement) {
  const violations = [];
  for (const [subject, placement] of Object.entries(subject_placement || {})) {
    const allowed = placement.allowed_periods || [];
    if (!allowed.length) continue;
    const badEntries = timetable.filter(
      (e) => e.subject === subject && !allowed.includes(e.period),
    );
    for (const e of badEntries) {
      violations.push({
        subject,
        grade: e.grade,
        class_name: e.class_name,
        day: e.day_of_week,
        period: e.period,
        allowed,
      });
    }
  }
  return violations;
}

/** 教科の午後1日最大コマ数違反 */
function checkAfternoonDailyViolations(
  timetable,
  subject_placement,
  lunch_after_period,
) {
  const violations = [];
  for (const [subject, placement] of Object.entries(subject_placement || {})) {
    const max_pm = placement.max_afternoon_daily;
    if (max_pm == null) continue;
    // クラス × 曜日ごとに集計
    const counts = {};
    for (const e of timetable) {
      if (e.subject !== subject) continue;
      if (e.period <= lunch_after_period) continue; // 午前はスキップ
      const key = `${e.grade}|${e.class_name}|${e.day_of_week}`;
      counts[key] = (counts[key] || 0) + 1;
    }
    for (const [key, count] of Object.entries(counts)) {
      if (count > max_pm) {
        const [grade, class_name, day] = key.split("|");
        violations.push({
          subject,
          grade: Number(grade),
          class_name,
          day,
          count,
          limit: max_pm,
        });
      }
    }
  }
  return violations;
}

/** 施設競合チェック: 同一時限に同施設を複数クラスが使用 */
function checkFacilityViolations(timetable, facilities, subject_facility) {
  if (!facilities?.length || !subject_facility) return [];
  const violations = [];
  const DAYS = ["月", "火", "水", "木", "金"];
  const PERIODS = [1, 2, 3, 4, 5, 6];
  for (const fac of facilities) {
    for (const day of DAYS) {
      for (const period of PERIODS) {
        const users = timetable.filter(
          (e) =>
            e.day_of_week === day &&
            e.period === period &&
            subject_facility[e.subject] === fac.id,
        );
        if (users.length > 1) {
          violations.push({
            facility: fac.name,
            day,
            period,
            classes: users.map(
              (e) => `${e.grade}年${e.class_name}(${e.subject})`,
            ),
          });
        }
      }
    }
  }
  return violations;
}

/** 2コマ連続授業チェック: 孤立した単発コマを検出 */
function checkDoublePeriodViolations(timetable, subject_placement) {
  const violations = [];
  const _DAYS = ["月", "火", "水", "木", "金"];
  const _PERIODS = [1, 2, 3, 4, 5, 6];
  for (const [subject, placement] of Object.entries(subject_placement || {})) {
    if (!placement.requires_double) continue;
    // クラス×曜日ごとに集計
    const counts = {};
    for (const e of timetable) {
      if (e.subject !== subject) continue;
      const key = `${e.grade}|${e.class_name}|${e.day_of_week}`;
      counts[key] = (counts[key] || 0) + 1;
    }
    for (const [key, count] of Object.entries(counts)) {
      if (count % 2 !== 0) {
        const [grade, class_name, day] = key.split("|");
        violations.push({
          subject,
          grade: Number(grade),
          class_name,
          day,
          count,
        });
      }
    }
  }
  return violations;
}

/** 教員の週総コマ数チェック */
function checkTeacherWeeklyViolations(
  timetable,
  teachers,
  teacher_constraints,
) {
  const violations = [];
  for (const teacher of teachers) {
    const max_w = teacher_constraints[teacher.id]?.max_weekly;
    if (!max_w) continue;
    const count = timetable.filter((e) => e.teacher_id === teacher.id).length;
    if (count > max_w) {
      violations.push({ teacher: teacher.name, count, limit: max_w });
    }
  }
  return violations;
}

// ─────────────────────────────────────────────
// メインコンポーネント
// ─────────────────────────────────────────────
const ValidationPanel = () => {
  const {
    structure,
    timetable,
    teachers,
    teacher_constraints,
    subject_placement,
    fixed_slots,
    facilities,
    subject_facility,
    settings,
    getClassSubjectTotals,
    getConsecutiveDaysViolations,
  } = useTimetableStore();

  const { grades, required_hours } = structure;
  const lunch_after_period = settings?.lunch_after_period ?? 4;

  const classList = [];
  grades.forEach((g) => {
    g.classes.forEach((c) => {
      classList.push({
        type: "normal",
        grade: g.grade,
        class_name: c,
        label: `${g.grade}-${c}`,
        reqKey: `${g.grade}_通常`,
      });
    });
    if (g.special_classes) {
      g.special_classes.forEach((c) => {
        classList.push({
          type: "special",
          grade: g.grade,
          class_name: c,
          label: `${g.grade}特支 ${c}`,
          reqKey: `${g.grade}_特支`,
        });
      });
    }
  });

  const consecutiveViolations = getConsecutiveDaysViolations();

  // 新制約チェック（memoize）
  const fixedViolations = useMemo(
    () => checkFixedSlotViolations(timetable, fixed_slots, structure),
    [timetable, fixed_slots, structure],
  );
  const teacherDailyViol = useMemo(
    () => checkTeacherDailyViolations(timetable, teachers, teacher_constraints),
    [timetable, teachers, teacher_constraints],
  );
  const teacherConsecViol = useMemo(
    () =>
      checkTeacherConsecutiveViolations(
        timetable,
        teachers,
        teacher_constraints,
      ),
    [timetable, teachers, teacher_constraints],
  );
  const periodViol = useMemo(
    () => checkSubjectPeriodViolations(timetable, subject_placement),
    [timetable, subject_placement],
  );
  const afternoonViol = useMemo(
    () =>
      checkAfternoonDailyViolations(
        timetable,
        subject_placement,
        lunch_after_period,
      ),
    [timetable, subject_placement, lunch_after_period],
  );
  const facilityViol = useMemo(
    () => checkFacilityViolations(timetable, facilities, subject_facility),
    [timetable, facilities, subject_facility],
  );
  const doublePeriodViol = useMemo(
    () => checkDoublePeriodViolations(timetable, subject_placement),
    [timetable, subject_placement],
  );
  const teacherWeeklyViol = useMemo(
    () =>
      checkTeacherWeeklyViolations(timetable, teachers, teacher_constraints),
    [timetable, teachers, teacher_constraints],
  );

  const newViolationCount =
    fixedViolations.length +
    teacherDailyViol.length +
    teacherConsecViol.length +
    periodViol.length +
    afternoonViol.length +
    facilityViol.length +
    doublePeriodViol.length +
    teacherWeeklyViol.length;

  return (
    <div className="validation-panel">
      <div className="validation-header">
        <h3 className="validation-header__title">週あたりの授業時数チェック</h3>
        <span className="validation-header__hint">
          規定数と一致しない場合は警告されます
        </span>
      </div>
      <div className="validation-grid">
        {classList.map((cls) => {
          const totals = getClassSubjectTotals(cls.grade, cls.class_name);
          const required = required_hours[cls.reqKey] || {};
          const subjects = Object.keys(required);
          if (subjects.length === 0) return null;
          const classModifier =
            cls.type === "special" ? " class-validation--special" : "";
          return (
            <div
              key={`${cls.grade}-${cls.class_name}`}
              className={`class-validation${classModifier}`}
            >
              <div className="class-badge">{cls.label}</div>
              <div className="subject-totals">
                {subjects.map((subj) => {
                  const current = totals[subj] || 0;
                  const req = required[subj];
                  const isWarning = current !== req;
                  return (
                    <div
                      key={subj}
                      className={`subject-item ${isWarning ? "subject-item--warning" : "subject-item--ok"}`}
                    >
                      <span className="subject-item__name">{subj}</span>
                      <span className="subject-item__count">
                        {current}/{req}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 連続授業日数の警告 */}
      {consecutiveViolations.length > 0 && (
        <ViolationBlock icon="⚠️" title="連続授業日数の警告" color="amber">
          {consecutiveViolations.map((v) => (
            <li key={`${v.grade}-${v.class_name}-${v.subject}`}>
              <strong>
                {v.grade}年{v.class_name}
              </strong>{" "}
              ─ 「{v.subject}」が{v.maxConsecutive}日連続（上限: {v.limit}日）
            </li>
          ))}
        </ViolationBlock>
      )}

      {/* 条件設定違反まとめ */}
      {newViolationCount > 0 && (
        <div className="validation-violations">
          <div className="validation-violations__heading">
            条件設定の違反
            <span className="validation-violations__count">
              {newViolationCount}件
            </span>
          </div>

          {fixedViolations.length > 0 && (
            <ViolationBlock icon="🔒" title="固定コマ未反映" color="red">
              {fixedViolations.map((v) => (
                <li
                  key={`${v.grade}-${v.class_name}-${v.day_of_week}-${v.period}-${v.label}`}
                >
                  <strong>
                    {v.grade}年{v.class_name}
                  </strong>{" "}
                  {v.day_of_week}曜{v.period}限 ─ 「{v.label}」が必要ですが「
                  {v.actual}」が入っています
                </li>
              ))}
            </ViolationBlock>
          )}

          {teacherDailyViol.length > 0 && (
            <ViolationBlock
              icon="👨‍🏫"
              title="教員の1日最大コマ数超過"
              color="orange"
            >
              {teacherDailyViol.map((v) => (
                <li key={`${v.teacher}-${v.day}-${v.count}-${v.limit}`}>
                  <strong>{v.teacher}</strong> ─ {v.day}曜日 {v.count}
                  コマ（上限: {v.limit}コマ）
                </li>
              ))}
            </ViolationBlock>
          )}

          {teacherConsecViol.length > 0 && (
            <ViolationBlock
              icon="⏱️"
              title="教員の連続コマ数超過"
              color="orange"
            >
              {teacherConsecViol.map((v) => (
                <li key={`${v.teacher}-${v.day}-${v.maxRun}-${v.limit}`}>
                  <strong>{v.teacher}</strong> ─ {v.day}曜日 {v.maxRun}
                  コマ連続（上限: {v.limit}コマ）
                </li>
              ))}
            </ViolationBlock>
          )}

          {periodViol.length > 0 && (
            <ViolationBlock
              icon="📚"
              title="配置可能時限外への配置"
              color="purple"
            >
              {periodViol.map((v) => (
                <li
                  key={`${v.grade}-${v.class_name}-${v.subject}-${v.day}-${v.period}`}
                >
                  <strong>
                    {v.grade}年{v.class_name}
                  </strong>{" "}
                  ─ 「{v.subject}」が{v.day}曜{v.period}限（許可時限:{" "}
                  {v.allowed.join("・")}限）
                </li>
              ))}
            </ViolationBlock>
          )}

          {afternoonViol.length > 0 && (
            <ViolationBlock icon="🌇" title="午後コマ上限超過" color="yellow">
              {afternoonViol.map((v) => (
                <li
                  key={`${v.grade}-${v.class_name}-${v.subject}-${v.day}-${v.count}`}
                >
                  <strong>
                    {v.grade}年{v.class_name}
                  </strong>{" "}
                  ─ 「{v.subject}」が{v.day}曜日の午後に{v.count}コマ（上限:{" "}
                  {v.limit}コマ）
                </li>
              ))}
            </ViolationBlock>
          )}

          {teacherWeeklyViol.length > 0 && (
            <ViolationBlock
              icon="📅"
              title="教員の週総コマ数超過"
              color="orange"
            >
              {teacherWeeklyViol.map((v) => (
                <li key={`${v.teacher}-${v.count}-${v.limit}`}>
                  <strong>{v.teacher}</strong> ─ 週{v.count}コマ（上限:{" "}
                  {v.limit}コマ）
                </li>
              ))}
            </ViolationBlock>
          )}

          {facilityViol.length > 0 && (
            <ViolationBlock
              icon="🏫"
              title="施設の競合（同時使用）"
              color="red"
            >
              {facilityViol.map((v) => (
                <li
                  key={`${v.facility}-${v.day}-${v.period}-${v.classes.join("-")}`}
                >
                  <strong>【{v.facility}】</strong> {v.day}曜{v.period}限 ─{" "}
                  {v.classes.join(" / ")} が同時使用
                </li>
              ))}
            </ViolationBlock>
          )}

          {doublePeriodViol.length > 0 && (
            <ViolationBlock
              icon="⏭️"
              title="2コマ連続授業の不整合（奇数コマ）"
              color="purple"
            >
              {doublePeriodViol.map((v) => (
                <li
                  key={`${v.grade}-${v.class_name}-${v.subject}-${v.day}-${v.count}`}
                >
                  <strong>
                    {v.grade}年{v.class_name}
                  </strong>{" "}
                  ─ 「{v.subject}」が{v.day}曜日に{v.count}
                  コマ（偶数でないと2コマ連続にできません）
                </li>
              ))}
            </ViolationBlock>
          )}
        </div>
      )}
    </div>
  );
};

// ─── 警告ブロック共通コンポーネント ─────────
// カラーは CSS の .violation-block--{color} で管理
function ViolationBlock({ icon, title, color = "amber", children }) {
  return (
    <div className={`violation-block violation-block--${color}`}>
      <div className="violation-block__header">
        <span>{icon}</span>
        <strong className="violation-block__title">{title}</strong>
      </div>
      <ul className="violation-block__list">{children}</ul>
    </div>
  );
}

export default ValidationPanel;
