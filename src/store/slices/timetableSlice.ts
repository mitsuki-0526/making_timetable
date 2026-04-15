import type { StateCreator } from "zustand";
import { DAYS } from "@/constants";
import { upsertSubject } from "@/lib/teacherAssignment";
import type {
  CellPosition,
  ConsecutiveDaysViolation,
  DayOfWeek,
  Period,
  Teacher,
  TimetableEntry,
  TimetableStore,
} from "@/types";

export interface TimetableSlice {
  timetable: TimetableEntry[];

  setTimetableEntry: (
    day_of_week: DayOfWeek,
    period: Period,
    grade: number,
    class_name: string,
    teacher_id: string | null,
    subject: string | null,
  ) => void;
  setTimetableTeacher: (
    day_of_week: DayOfWeek,
    period: Period,
    grade: number,
    class_name: string,
    teacher_id: string | null,
  ) => void;
  setAltEntry: (
    day_of_week: DayOfWeek,
    period: Period,
    grade: number,
    class_name: string,
    alt_subject: string | null,
    alt_teacher_id: string | null,
  ) => void;
  setEntryGroup: (
    day_of_week: DayOfWeek,
    period: Period,
    grade: number,
    class_name: string,
    teacher_group_id: string | null,
  ) => void;
  setGeneratedTimetable: (entries: TimetableEntry[]) => void;
  swapTimetableEntries: (src: CellPosition, dest: CellPosition) => void;
  clearNonFixed: () => void;
  groupCells: (cells: CellPosition[]) => void;
  ungroupCells: (groupId: string) => void;

  getEntry: (
    day_of_week: DayOfWeek,
    period: Period,
    grade: number,
    class_name: string,
  ) => TimetableEntry | undefined;
  getAvailableTeachers: (
    day_of_week: DayOfWeek,
    period: Period,
    target_grade: number,
    target_class_name: string,
  ) => Teacher[];
  getDailySubjectCount: (
    day_of_week: DayOfWeek,
    grade: number,
    class_name: string,
    subject: string,
  ) => number;
  getClassSubjectTotals: (
    grade: number,
    class_name: string,
  ) => Record<string, number>;
  getConsecutiveDaysViolations: () => ConsecutiveDaysViolation[];
}

export const createTimetableSlice: StateCreator<
  TimetableStore,
  [],
  [],
  TimetableSlice
> = (set, get) => ({
  timetable: [],

  setTimetableEntry: (
    day_of_week,
    period,
    grade,
    class_name,
    teacher_id,
    subject,
  ) => {
    set((state) => {
      let currentTimetable = [...state.timetable];

      // 既存エントリの cell_group_id を保持
      const existingEntry = currentTimetable.find(
        (entry) =>
          entry.day_of_week === day_of_week &&
          entry.period === period &&
          entry.grade === grade &&
          entry.class_name === class_name,
      );
      const preservedCellGroupId = existingEntry?.cell_group_id || null;

      // 対象セルのエントリを削除
      currentTimetable = currentTimetable.filter(
        (entry) =>
          !(
            entry.day_of_week === day_of_week &&
            entry.period === period &&
            entry.grade === grade &&
            entry.class_name === class_name
          ),
      );

      // 新しいエントリを追加
      if (teacher_id || subject) {
        const newEntry: TimetableEntry = {
          day_of_week,
          period,
          grade,
          class_name,
          teacher_id,
          subject: subject || "",
        };
        if (preservedCellGroupId) {
          newEntry.cell_group_id = preservedCellGroupId;
        }
        currentTimetable.push(newEntry);
      }

      // 【特別支援学級マッピング機能（自動連動）】
      const isNormalClass = !class_name.includes("特支");
      if (isNormalClass && subject) {
        const gradeRules = state.settings.mappingRules[grade] || {};
        const mappedSubject = gradeRules[subject];
        if (mappedSubject) {
          const targetGradeObj = state.structure.grades.find(
            (g) => g.grade === grade,
          );
          if (targetGradeObj?.special_classes) {
            for (const spClass of targetGradeObj.special_classes) {
              if (spClass !== class_name) {
                upsertSubject(
                  currentTimetable,
                  state,
                  day_of_week,
                  period,
                  grade,
                  spClass,
                  mappedSubject,
                );
              }
            }
          }
        }
      }

      // 【抱き合わせ教科の自動連動】
      if (subject) {
        for (const pairing of state.subject_pairings) {
          if (pairing.grade === grade) {
            if (pairing.classA === class_name && pairing.subjectA === subject) {
              upsertSubject(
                currentTimetable,
                state,
                day_of_week,
                period,
                grade,
                pairing.classB,
                pairing.subjectB,
              );
            } else if (
              pairing.classB === class_name &&
              pairing.subjectB === subject
            ) {
              upsertSubject(
                currentTimetable,
                state,
                day_of_week,
                period,
                grade,
                pairing.classA,
                pairing.subjectA,
              );
            }
          }
        }
      }

      return { timetable: currentTimetable };
    });
  },

  setTimetableTeacher: (day_of_week, period, grade, class_name, teacher_id) => {
    set((state) => ({
      timetable: state.timetable.map((e) =>
        e.day_of_week === day_of_week &&
        e.period === period &&
        e.grade === grade &&
        e.class_name === class_name
          ? { ...e, teacher_id: teacher_id || null }
          : e,
      ),
    }));
  },

  setAltEntry: (
    day_of_week,
    period,
    grade,
    class_name,
    alt_subject,
    alt_teacher_id,
  ) => {
    set((state) => ({
      timetable: state.timetable.map((e) =>
        e.day_of_week === day_of_week &&
        e.period === period &&
        e.grade === grade &&
        e.class_name === class_name
          ? {
              ...e,
              alt_subject: alt_subject || null,
              alt_teacher_id: alt_teacher_id || null,
            }
          : e,
      ),
    }));
  },

  setEntryGroup: (day_of_week, period, grade, class_name, teacher_group_id) => {
    set((state) => ({
      timetable: state.timetable.map((e) =>
        e.day_of_week === day_of_week &&
        e.period === period &&
        e.grade === grade &&
        e.class_name === class_name
          ? {
              ...e,
              teacher_id: teacher_group_id ? null : e.teacher_id,
              teacher_group_id: teacher_group_id || null,
            }
          : e,
      ),
    }));
  },

  setGeneratedTimetable: (entries) => {
    set({ timetable: entries });
  },

  swapTimetableEntries: (src, dest) => {
    set((state) => {
      const timetable = [...state.timetable];

      const findIdx = (pos: CellPosition) =>
        timetable.findIndex(
          (e) =>
            e.grade === pos.grade &&
            e.class_name === pos.class_name &&
            e.day_of_week === pos.day_of_week &&
            e.period === pos.period,
        );

      const srcIdx = findIdx(src);
      const destIdx = findIdx(dest);
      const srcEntry = srcIdx >= 0 ? { ...timetable[srcIdx] } : null;
      const destEntry = destIdx >= 0 ? { ...timetable[destIdx] } : null;

      const filtered = timetable.filter(
        (e) =>
          !(
            e.grade === src.grade &&
            e.class_name === src.class_name &&
            e.day_of_week === src.day_of_week &&
            e.period === src.period
          ) &&
          !(
            e.grade === dest.grade &&
            e.class_name === dest.class_name &&
            e.day_of_week === dest.day_of_week &&
            e.period === dest.period
          ),
      );

      if (srcEntry) {
        filtered.push({
          ...srcEntry,
          grade: dest.grade,
          class_name: dest.class_name,
          day_of_week: dest.day_of_week,
          period: dest.period,
        });
      }
      if (destEntry) {
        filtered.push({
          ...destEntry,
          grade: src.grade,
          class_name: src.class_name,
          day_of_week: src.day_of_week,
          period: src.period,
        });
      }

      return { timetable: filtered };
    });
  },

  clearNonFixed: () => {
    set((state) => {
      const { fixed_slots = [], structure } = state;
      const fixedKeys = new Set<string>();

      const allClasses: { grade: number; class_name: string }[] = [];
      for (const g of structure.grades || []) {
        for (const cn of g.classes || [])
          allClasses.push({ grade: g.grade, class_name: cn });
        for (const cn of g.special_classes || [])
          allClasses.push({ grade: g.grade, class_name: cn });
      }

      for (const slot of fixed_slots) {
        for (const cls of allClasses) {
          const match =
            slot.scope === "all" ||
            (slot.scope === "grade" && cls.grade === slot.grade) ||
            (slot.scope === "class" &&
              cls.grade === slot.grade &&
              cls.class_name === slot.class_name);
          if (match) {
            fixedKeys.add(
              `${cls.grade}|${cls.class_name}|${slot.day_of_week}|${slot.period}`,
            );
          }
        }
      }

      const newTimetable = state.timetable.filter((e) =>
        fixedKeys.has(
          `${e.grade}|${e.class_name}|${e.day_of_week}|${e.period}`,
        ),
      );
      return { timetable: newTimetable };
    });
  },

  groupCells: (cells) => {
    set((state) => {
      const groupId = `CGRP${Date.now()}`;
      const newCellGroups = [...state.cell_groups, { id: groupId }];
      const newTimetable = state.timetable.map((e) => {
        const match = cells.find(
          (c) =>
            c.day_of_week === e.day_of_week &&
            c.period === e.period &&
            c.grade === e.grade &&
            c.class_name === e.class_name,
        );
        return match ? { ...e, cell_group_id: groupId } : e;
      });
      return { timetable: newTimetable, cell_groups: newCellGroups };
    });
  },

  ungroupCells: (groupId) => {
    set((state) => ({
      timetable: state.timetable.map((e) =>
        e.cell_group_id === groupId ? { ...e, cell_group_id: null } : e,
      ),
      cell_groups: state.cell_groups.filter((g) => g.id !== groupId),
    }));
  },

  // ── セレクタ ──
  getEntry: (day_of_week, period, grade, class_name) => {
    const state = get();
    return state.timetable.find(
      (entry) =>
        entry.day_of_week === day_of_week &&
        entry.period === period &&
        entry.grade === grade &&
        entry.class_name === class_name,
    );
  },

  getAvailableTeachers: (
    day_of_week,
    period,
    target_grade,
    target_class_name,
  ) => {
    const state = get();
    return state.teachers.filter((teacher) => {
      const isTokkiShien = teacher.subjects.includes("特別支援");
      if (!isTokkiShien && !teacher.target_grades.includes(target_grade)) {
        return false;
      }

      const isUnavailable = teacher.unavailable_times.some(
        (time) => time.day_of_week === day_of_week && time.period === period,
      );
      if (isUnavailable) return false;

      const isAlreadyAssigned = state.timetable.some((entry) => {
        if (entry.day_of_week !== day_of_week || entry.period !== period)
          return false;
        if (target_class_name && entry.class_name === target_class_name)
          return false;

        const teacherInEntry =
          entry.teacher_id === teacher.id ||
          entry.alt_teacher_id === teacher.id ||
          (() => {
            if (!entry.teacher_group_id) return false;
            const grp = state.teacher_groups.find(
              (g) => g.id === entry.teacher_group_id,
            );
            return grp?.teacher_ids?.includes(teacher.id) ?? false;
          })();
        if (!teacherInEntry) return false;

        if (target_class_name && entry.class_name !== target_class_name) {
          const classGrp = state.class_groups.find(
            (g) =>
              g.grade === target_grade &&
              g.classes.includes(target_class_name) &&
              g.classes.includes(entry.class_name),
          );
          if (classGrp) {
            const entrySubject = entry.subject;
            if (
              !entrySubject ||
              !classGrp.split_subjects.includes(entrySubject)
            ) {
              return false;
            }
          }
        }

        return true;
      });
      if (isAlreadyAssigned) return false;

      return true;
    });
  },

  getDailySubjectCount: (day_of_week, grade, class_name, subject) => {
    const state = get();
    if (!subject) return 0;
    return state.timetable.filter(
      (entry) =>
        entry.day_of_week === day_of_week &&
        entry.grade === grade &&
        entry.class_name === class_name &&
        entry.subject === subject,
    ).length;
  },

  getClassSubjectTotals: (grade, class_name) => {
    const state = get();
    const totals: Record<string, number> = {};
    const classEntries = state.timetable.filter(
      (entry) =>
        entry.grade === grade &&
        entry.class_name === class_name &&
        entry.subject,
    );
    for (const entry of classEntries) {
      totals[entry.subject] = (totals[entry.subject] || 0) + 1;
      if (entry.alt_subject) {
        totals[entry.alt_subject] = (totals[entry.alt_subject] || 0) + 1;
      }
    }
    return totals;
  },

  getConsecutiveDaysViolations: () => {
    const state = get();
    const violations: ConsecutiveDaysViolation[] = [];

    const classes = state.structure.grades.flatMap((g) => [
      ...g.classes.map((c) => ({ grade: g.grade, class_name: c })),
      ...(g.special_classes || []).map((c) => ({
        grade: g.grade,
        class_name: c,
      })),
    ]);

    const constrainedSubjects = Object.entries(
      state.subject_constraints || {},
    ).filter(([, c]) => c.max_consecutive_days != null);

    for (const { grade, class_name } of classes) {
      for (const [subject, constraint] of constrainedSubjects) {
        const hasSubjectOnDay = DAYS.map((day) =>
          state.timetable.some(
            (e) =>
              e.grade === grade &&
              e.class_name === class_name &&
              e.day_of_week === day &&
              (e.subject === subject || e.alt_subject === subject),
          ),
        );

        let maxConsecutive = 0;
        let current = 0;
        for (const has of hasSubjectOnDay) {
          current = has ? current + 1 : 0;
          if (current > maxConsecutive) maxConsecutive = current;
        }

        if (
          constraint.max_consecutive_days !== null &&
          maxConsecutive >= constraint.max_consecutive_days
        ) {
          violations.push({
            grade,
            class_name,
            subject,
            maxConsecutive,
            limit: constraint.max_consecutive_days,
          });
        }
      }
    }

    return violations;
  },
});
