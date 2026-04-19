// ═══════════════════════════════════════════════════════════
// バリデーション — ピュアなビジネスロジック
// UIコンポーネントから分離してテスト可能にする
// ═══════════════════════════════════════════════════════════

import { DAYS, PERIODS } from "@/constants";
import type {
  AfternoonDailyViolation,
  ClassGroup,
  DayOfWeek,
  DoublePeriodViolation,
  Facility,
  FacilityViolation,
  FixedSlot,
  FixedSlotViolation,
  Period,
  SchoolStructure,
  SubjectPeriodViolation,
  SubjectPlacement,
  Teacher,
  TeacherConsecutiveViolation,
  TeacherConstraintSettings,
  TeacherDailyViolation,
  TeacherTimeConflictViolation,
  TeacherWeeklyViolation,
  TimetableEntry,
} from "@/types";

/** 固定コマ違反: 指定スロットに指定教科が入っていない */
export function checkFixedSlotViolations(
  timetable: TimetableEntry[],
  fixed_slots: FixedSlot[],
  structure: SchoolStructure,
): FixedSlotViolation[] {
  const violations: FixedSlotViolation[] = [];
  for (const slot of fixed_slots || []) {
    const { scope, grade, class_name, day_of_week, period, subject, label } =
      slot;

    const targets: { grade: number; class_name: string }[] = [];
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
export function checkTeacherDailyViolations(
  timetable: TimetableEntry[],
  teachers: Teacher[],
  teacher_constraints: Record<string, TeacherConstraintSettings>,
): TeacherDailyViolation[] {
  const violations: TeacherDailyViolation[] = [];
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
export function checkTeacherConsecutiveViolations(
  timetable: TimetableEntry[],
  teachers: Teacher[],
  teacher_constraints: Record<string, TeacherConstraintSettings>,
): TeacherConsecutiveViolation[] {
  const violations: TeacherConsecutiveViolation[] = [];
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
export function checkSubjectPeriodViolations(
  timetable: TimetableEntry[],
  subject_placement: Record<string, SubjectPlacement>,
): SubjectPeriodViolation[] {
  const violations: SubjectPeriodViolation[] = [];
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
export function checkAfternoonDailyViolations(
  timetable: TimetableEntry[],
  subject_placement: Record<string, SubjectPlacement>,
  lunch_after_period: number,
): AfternoonDailyViolation[] {
  const violations: AfternoonDailyViolation[] = [];
  for (const [subject, placement] of Object.entries(subject_placement || {})) {
    const max_pm = placement.max_afternoon_daily;
    if (max_pm == null) continue;
    const counts: Record<string, number> = {};
    for (const e of timetable) {
      if (e.subject !== subject) continue;
      if (e.period <= lunch_after_period) continue;
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
          day: day as DayOfWeek,
          count,
          limit: max_pm,
        });
      }
    }
  }
  return violations;
}

/** 施設競合チェック: 同一時限に同施設を複数クラスが使用 */
export function checkFacilityViolations(
  timetable: TimetableEntry[],
  facilities: Facility[],
  subject_facility: Record<string, string | null>,
): FacilityViolation[] {
  if (!facilities?.length || !subject_facility) return [];
  const violations: FacilityViolation[] = [];
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
            period: period as Period,
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
export function checkDoublePeriodViolations(
  timetable: TimetableEntry[],
  subject_placement: Record<string, SubjectPlacement>,
): DoublePeriodViolation[] {
  const violations: DoublePeriodViolation[] = [];
  for (const [subject, placement] of Object.entries(subject_placement || {})) {
    if (!placement.requires_double) continue;
    const counts: Record<string, number> = {};
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
          day: day as DayOfWeek,
          count,
        });
      }
    }
  }
  return violations;
}

/** 同一教員が同時刻に複数クラスに割り当てられている（教員時間重複） */
export function checkTeacherTimeConflicts(
  timetable: TimetableEntry[],
  teachers: Teacher[],
  class_groups: ClassGroup[] = [],
): TeacherTimeConflictViolation[] {
  const violations: TeacherTimeConflictViolation[] = [];
  const bySlot: Record<string, TimetableEntry[]> = {};
  for (const e of timetable) {
    if (!e.teacher_id || !e.subject) continue;
    const key = `${e.teacher_id}-${e.day_of_week}-${e.period}`;
    bySlot[key] = bySlot[key] ?? [];
    bySlot[key].push(e);
  }
  for (const entries of Object.values(bySlot)) {
    if (entries.length <= 1) continue;

    // 合同クラスによる正当な重複かチェック
    const subject = entries[0].subject;
    const allSameSubject = entries.every((e) => e.subject === subject);
    if (allSameSubject) {
      const group = class_groups.find(
        (g) =>
          g.grade === entries[0].grade &&
          entries.every((e) => e.grade === g.grade && g.classes.includes(e.class_name)),
      );
      // 合同クラスに属し、かつ split_subjects（分割教科）でなければ正当な合同授業
      if (group && !group.split_subjects.includes(subject)) continue;
    }

    const teacher = teachers.find((t) => t.id === entries[0].teacher_id);
    const teacher_name = teacher?.name ?? entries[0].teacher_id;
    for (const e of entries) {
      violations.push({
        teacher_name,
        teacher_id: e.teacher_id as string,
        day: e.day_of_week,
        period: e.period,
        grade: e.grade,
        class_name: e.class_name,
      });
    }
  }
  return violations;
}

/** 教員の週総コマ数チェック */
export function checkTeacherWeeklyViolations(
  timetable: TimetableEntry[],
  teachers: Teacher[],
  teacher_constraints: Record<string, TeacherConstraintSettings>,
): TeacherWeeklyViolation[] {
  const violations: TeacherWeeklyViolation[] = [];
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
