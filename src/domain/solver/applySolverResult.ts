import type { TimetableEntry } from '@/types'
import type { SolverResult } from './types'

/**
 * ソルバー結果をtimetable配列に適用する
 */
export function applySolverResult(
  currentTimetable: readonly TimetableEntry[],
  result: SolverResult,
  mode: 'full' | 'empty_only',
): TimetableEntry[] {
  const updated = [...currentTimetable]

  for (const assignment of result.assignments) {
    const idx = updated.findIndex(
      (e) => e.grade === assignment.grade && e.class_name === assignment.class_name &&
        e.day_of_week === assignment.day && e.period === assignment.period,
    )

    if (idx >= 0) {
      const existing = updated[idx]
      if (mode === 'empty_only' && existing.subject) continue

      updated[idx] = {
        ...existing,
        subject: assignment.subject,
        teacher_id: assignment.teacher_id,
      }
    } else {
      // エントリが存在しない場合は新規追加
      updated.push({
        grade: assignment.grade,
        class_name: assignment.class_name,
        day_of_week: assignment.day,
        period: assignment.period,
        subject: assignment.subject,
        teacher_id: assignment.teacher_id,
        alt_subject: null,
        alt_teacher_id: null,
        teacher_group_id: null,
        cell_group_id: null,
        is_locked: false,
      })
    }
  }

  return updated
}
