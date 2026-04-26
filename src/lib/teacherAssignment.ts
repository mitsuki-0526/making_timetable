import type {
  DayOfWeek,
  Period,
  TimetableEntry,
  TimetableStore,
} from "@/types";
import {
  entryIncludesTeacher,
  snapshotTimetableEntryTeacherTeams,
} from "@/lib/teamTeaching";

/**
 * 教科を上書きし、適切な教員を自動割り当てするヘルパー関数群
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
  const prevTeacherFits = prevTeacher?.subjects.includes(targetSubject);

  // 前の先生が適合する場合は引き継ぐ
  let newTeacherId: string | null = prevTeacherFits ? prevTeacherId : null;

  // 新しく割り当てる必要がある場合
  if (!newTeacherId) {
    const suitable = state.teachers.find((t) => {
      if (!t.subjects.includes(targetSubject)) return false;
      if (
        t.unavailable_times.some(
          (u) => u.day_of_week === day_of_week && u.period === period,
        )
      )
        return false;
      if (!t.target_grades.includes(grade)) return false;
      if (t.target_classes) {
        const allowed = t.target_classes[grade];
        if (allowed && allowed.length > 0 && !allowed.includes(targetClass))
          return false;
      }

      // 同一時間に他クラスで使われていないかチェック
      const alreadyUsed = currentTimetable.some((e) => {
        if (e.day_of_week !== day_of_week || e.period !== period) return false;
        if (e.class_name === targetClass) return false;
        return entryIncludesTeacher(e, t.id, state.teacher_groups);
      });
      return !alreadyUsed;
    });
    newTeacherId = suitable ? suitable.id : null;
  }

  if (idx >= 0) {
    currentTimetable[idx] = snapshotTimetableEntryTeacherTeams(
      {
        ...currentTimetable[idx],
        subject: targetSubject,
        teacher_id: newTeacherId,
        teacher_group_id: null,
        teacher_ids: newTeacherId ? [newTeacherId] : undefined,
      },
      state.teacher_groups,
    );
  } else {
    currentTimetable.push(
      snapshotTimetableEntryTeacherTeams(
        {
          day_of_week,
          period,
          grade,
          class_name: targetClass,
          teacher_id: newTeacherId,
          subject: targetSubject,
        },
        state.teacher_groups,
      ),
    );
  }
}
