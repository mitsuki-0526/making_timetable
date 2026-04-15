import type {
  DayOfWeek,
  Period,
  TimetableEntry,
  TimetableStore,
} from "@/types";

/**
 * 教科を上書きし、適切な教員を自動割り当て、または連動ルールを適用するヘルパー関数群
 */

export function upsertSubject(
  currentTimetable: TimetableEntry[],
  state: TimetableStore,
  day_of_week: DayOfWeek,
  period: Period,
  grade: number,
  targetClass: string,
  targetSubject: string,
): void {
  const isTargetSpecial = targetClass.includes("特支");
  const idx = currentTimetable.findIndex(
    (e) =>
      e.day_of_week === day_of_week &&
      e.period === period &&
      e.grade === grade &&
      e.class_name === targetClass,
  );

  const prevTeacherId = idx >= 0 ? currentTimetable[idx].teacher_id : null;
  const prevTeacher = state.teachers.find((t) => t.id === prevTeacherId);

  // 以前の教員が新しい教科にも適しているかチェック
  const prevTeacherFits =
    prevTeacher &&
    (prevTeacher.subjects.includes(targetSubject) ||
      (isTargetSpecial && prevTeacher.subjects.includes("特別支援")));

  const prevTeacherIsTokkiShien =
    prevTeacher?.subjects.includes("特別支援") ?? false;

  // 前の先生が適合し、かつ「特別支援」のみの先生でない場合は引き継ぐ
  let newTeacherId: string | null =
    prevTeacherFits && !prevTeacherIsTokkiShien ? prevTeacherId : null;

  // 新しく割り当てる必要がある場合
  if (!newTeacherId) {
    const suitable = state.teachers.find((t) => {
      if (t.subjects.includes("特別支援")) return false;
      if (!t.subjects.includes(targetSubject)) return false;
      if (
        t.unavailable_times.some(
          (u) => u.day_of_week === day_of_week && u.period === period,
        )
      )
        return false;
      if (!t.target_grades.includes(grade)) return false;

      // 同一時間に他クラスで使われていないかチェック
      const alreadyUsed = currentTimetable.some((e) => {
        if (e.day_of_week !== day_of_week || e.period !== period) return false;
        if (e.class_name === targetClass) return false;
        return e.teacher_id === t.id || e.alt_teacher_id === t.id;
      });
      return !alreadyUsed;
    });
    newTeacherId = suitable ? suitable.id : null;
  }

  if (idx >= 0) {
    currentTimetable[idx] = {
      ...currentTimetable[idx],
      subject: targetSubject,
      teacher_id: newTeacherId,
    };
  } else {
    currentTimetable.push({
      day_of_week,
      period,
      grade,
      class_name: targetClass,
      teacher_id: newTeacherId,
      subject: targetSubject,
    });
  }
}
