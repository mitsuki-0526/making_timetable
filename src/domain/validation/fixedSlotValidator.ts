import type { TimetableEntry, FixedSlot } from '@/types'

export type FixedSlotViolation = {
  readonly type: 'fixed_slot'
  readonly severity: 'error'
  readonly entry: TimetableEntry
  readonly fixedSlot: FixedSlot
  readonly message: string
}

export type ValidateFixedSlotsInput = {
  readonly timetable: readonly TimetableEntry[]
  readonly fixedSlots: readonly FixedSlot[]
}

/**
 * 固定コマ違反を検出する。
 * 固定コマに設定された教科と異なる教科が配置されている場合にエラーを返す。
 * 教科未設定(null)のコマは違反としない。
 */
export function validateFixedSlots(input: ValidateFixedSlotsInput): FixedSlotViolation[] {
  const { timetable, fixedSlots } = input
  const violations: FixedSlotViolation[] = []

  for (const slot of fixedSlots) {
    for (const entry of timetable) {
      if (entry.subject === null) continue
      if (entry.day_of_week !== slot.day_of_week || entry.period !== slot.period) continue

      // スコープチェック
      if (slot.scope === 'grade' && entry.grade !== slot.grade) continue
      if (slot.scope === 'class' && (entry.grade !== slot.grade || entry.class_name !== slot.class_name)) continue

      if (entry.subject !== slot.subject) {
        violations.push({
          type: 'fixed_slot',
          severity: 'error',
          entry,
          fixedSlot: slot,
          message: `${entry.grade}年${entry.class_name} ${entry.day_of_week}${entry.period}限: 固定コマ「${slot.subject}」に「${entry.subject}」が配置されています`,
        })
      }
    }
  }

  return violations
}
