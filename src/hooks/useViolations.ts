import { useMemo } from "react";
import {
  checkAfternoonDailyViolations,
  checkDoublePeriodViolations,
  checkFacilityViolations,
  checkFixedSlotViolations,
  checkSubjectPeriodViolations,
  checkTeacherConsecutiveViolations,
  checkTeacherDailyViolations,
  checkTeacherTimeConflicts,
  checkTeacherWeeklyViolations,
} from "@/lib/validation";
import { useTimetableStore } from "@/store/useTimetableStore";
import type { DayOfWeek, Period } from "@/types";

export interface ViolationItem {
  message: string;
  grade?: number;
  class_name?: string;
  day?: DayOfWeek;
  period?: Period;
}

export function useViolations() {
  const {
    timetable,
    structure,
    teachers,
    teacher_constraints,
    subject_placement,
    fixed_slots,
    facilities,
    subject_facility,
    settings,
    class_groups,
    getConsecutiveDaysViolations,
  } = useTimetableStore();

  const lunch_after_period = settings?.lunch_after_period ?? 4;

  const violations = useMemo<ViolationItem[]>(() => {
    const items: ViolationItem[] = [];

    for (const v of checkTeacherTimeConflicts(timetable, teachers, class_groups)) {
      items.push({
        message: `教員重複: ${v.teacher_name}先生 ${v.day}曜${v.period}限 (${v.grade}-${v.class_name})`,
        grade: v.grade,
        class_name: v.class_name,
        day: v.day,
        period: v.period,
      });
    }

    for (const v of checkFixedSlotViolations(
      timetable,
      fixed_slots,
      structure,
    )) {
      items.push({
        message: `固定コマ違反: ${v.grade}-${v.class_name} ${v.day_of_week}${v.period}限「${v.expected}」が未配置`,
        grade: v.grade,
        class_name: v.class_name,
        day: v.day_of_week,
        period: v.period,
      });
    }

    for (const v of checkTeacherDailyViolations(
      timetable,
      teachers,
      teacher_constraints,
    )) {
      items.push({
        message: `教員日数超過: ${v.teacher} ${v.day}曜 ${v.count}コマ (上限${v.limit})`,
      });
    }

    for (const v of checkTeacherConsecutiveViolations(
      timetable,
      teachers,
      teacher_constraints,
    )) {
      items.push({
        message: `連続コマ超過: ${v.teacher} ${v.day}曜 ${v.maxRun}連続 (上限${v.limit})`,
      });
    }

    for (const v of checkTeacherWeeklyViolations(
      timetable,
      teachers,
      teacher_constraints,
    )) {
      items.push({
        message: `週コマ数超過: ${v.teacher} ${v.count}コマ (上限${v.limit})`,
      });
    }

    for (const v of checkSubjectPeriodViolations(
      timetable,
      subject_placement,
    )) {
      items.push({
        message: `配置制約違反: ${v.subject} ${v.grade}-${v.class_name} ${v.day}${v.period}限`,
        grade: v.grade,
        class_name: v.class_name,
        day: v.day,
        period: v.period,
      });
    }

    for (const v of checkAfternoonDailyViolations(
      timetable,
      subject_placement,
      lunch_after_period,
    )) {
      items.push({
        message: `午後上限超過: ${v.subject} ${v.grade}-${v.class_name} ${v.day}曜 ${v.count}コマ (上限${v.limit})`,
        grade: v.grade,
        class_name: v.class_name,
        day: v.day,
      });
    }

    for (const v of checkFacilityViolations(
      timetable,
      facilities,
      subject_facility,
    )) {
      items.push({
        message: `施設競合: ${v.facility} ${v.day}${v.period}限 (${v.classes.join(", ")})`,
      });
    }

    for (const v of checkDoublePeriodViolations(timetable, subject_placement)) {
      items.push({
        message: `連続配置: ${v.subject} ${v.grade}-${v.class_name} ${v.day}曜`,
        grade: v.grade,
        class_name: v.class_name,
        day: v.day,
      });
    }

    for (const v of getConsecutiveDaysViolations()) {
      items.push({
        message: `連続日数超過: ${v.grade}-${v.class_name} ${v.subject} ${v.maxConsecutive}日連続 (上限${v.limit})`,
        grade: v.grade,
        class_name: v.class_name,
      });
    }

    return items;
  }, [
    timetable,
    structure,
    teachers,
    teacher_constraints,
    subject_placement,
    fixed_slots,
    facilities,
    subject_facility,
    lunch_after_period,
    class_groups,
    getConsecutiveDaysViolations,
  ]);

  const conflictKeys = useMemo(() => {
    const s = new Set<string>();
    for (const v of violations) {
      if (v.grade != null && v.class_name && v.day && v.period) {
        s.add(`${v.grade}|${v.class_name}|${v.day}|${v.period}`);
      }
    }
    return s;
  }, [violations]);

  return { violations, conflictKeys, totalCount: violations.length };
}
