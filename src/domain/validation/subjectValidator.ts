import type { TimetableEntry, SchoolStructure, SubjectPlacement, ConstraintHardness } from '@/types'
import { DAYS } from '@/constants/school'

type Severity = 'error' | 'warning'

export type SubjectViolation = {
  readonly type: 'hours_shortage' | 'hours_excess' | 'consecutive_days' | 'allowed_periods' | 'afternoon_limit'
  readonly severity: Severity
  readonly message: string
}

// ─── 規定時数チェック ───

export type ValidateRequiredHoursInput = {
  readonly timetable: readonly TimetableEntry[]
  readonly structure: SchoolStructure
}

export function validateRequiredHours(input: ValidateRequiredHoursInput): SubjectViolation[] {
  const { timetable, structure } = input
  const violations: SubjectViolation[] = []

  for (const gradeConfig of structure.grades) {
    for (const cls of gradeConfig.classes) {
      for (const [subject, required] of Object.entries(gradeConfig.required_hours)) {
        const count = timetable.filter(
          (e) =>
            e.grade === gradeConfig.grade &&
            e.class_name === cls.name &&
            e.subject === subject,
        ).length

        if (count < required) {
          violations.push({
            type: 'hours_shortage',
            severity: 'warning',
            message: `${gradeConfig.grade}年${cls.name} ${subject}: ${count}/${required}コマ（不足）`,
          })
        } else if (count > required) {
          violations.push({
            type: 'hours_excess',
            severity: 'warning',
            message: `${gradeConfig.grade}年${cls.name} ${subject}: ${count}/${required}コマ（超過）`,
          })
        }
      }
    }
  }

  return violations
}

// ─── 連続授業日数チェック ───

export type ValidateConsecutiveDaysInput = {
  readonly timetable: readonly TimetableEntry[]
  readonly placements: readonly SubjectPlacement[]
  readonly grade: number
  readonly className: string
}

export function validateConsecutiveDays(input: ValidateConsecutiveDaysInput): SubjectViolation[] {
  const { timetable, placements, grade, className } = input
  const violations: SubjectViolation[] = []
  const dayIndex = new Map(DAYS.map((d, i) => [d, i]))

  for (const placement of placements) {
    if (placement.max_consecutive_days === null) continue

    const daysWithSubject = new Set<number>()
    for (const entry of timetable) {
      if (
        entry.grade === grade &&
        entry.class_name === className &&
        entry.subject === placement.subject
      ) {
        const idx = dayIndex.get(entry.day_of_week)
        if (idx !== undefined) daysWithSubject.add(idx)
      }
    }

    // 連続日数を計算
    const sortedDays = [...daysWithSubject].sort((a, b) => a - b)
    let maxConsecutive = sortedDays.length > 0 ? 1 : 0
    let current = 1
    for (let i = 1; i < sortedDays.length; i++) {
      if (sortedDays[i] === sortedDays[i - 1] + 1) {
        current++
        maxConsecutive = Math.max(maxConsecutive, current)
      } else {
        current = 1
      }
    }

    if (maxConsecutive > placement.max_consecutive_days) {
      violations.push({
        type: 'consecutive_days',
        severity: placement.max_consecutive_days_hardness === 'hard' ? 'error' : 'warning',
        message: `${grade}年${className} ${placement.subject}: ${maxConsecutive}日連続（上限${placement.max_consecutive_days}日）`,
      })
    }
  }

  return violations
}

// ─── 配置許可時限チェック ───

export type ValidateAllowedPeriodsInput = {
  readonly timetable: readonly TimetableEntry[]
  readonly placements: readonly SubjectPlacement[]
}

export function validateAllowedPeriods(input: ValidateAllowedPeriodsInput): SubjectViolation[] {
  const { timetable, placements } = input
  const violations: SubjectViolation[] = []

  for (const placement of placements) {
    if (placement.allowed_periods === null) continue
    const allowed = new Set(placement.allowed_periods)

    for (const entry of timetable) {
      if (entry.subject !== placement.subject) continue
      if (!allowed.has(entry.period)) {
        violations.push({
          type: 'allowed_periods',
          severity: placement.allowed_periods_hardness === 'hard' ? 'error' : 'warning',
          message: `${entry.grade}年${entry.class_name} ${entry.subject}: ${entry.day_of_week}${entry.period}限は配置不可`,
        })
      }
    }
  }

  return violations
}
