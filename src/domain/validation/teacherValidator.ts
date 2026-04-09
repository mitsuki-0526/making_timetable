import type { TimetableEntry, Teacher, TeacherConstraintSettings, ConstraintHardness } from '@/types'
import { DAYS } from '@/constants/school'

type Severity = 'error' | 'warning'

export type TeacherViolation = {
  readonly type: 'teacher_duplicate' | 'teacher_daily' | 'teacher_consecutive' | 'teacher_weekly' | 'part_time_day'
  readonly severity: Severity
  readonly teacherId: string
  readonly teacherName: string
  readonly message: string
}

function severityFromHardness(hardness: ConstraintHardness): Severity {
  return hardness === 'hard' ? 'error' : 'warning'
}

// ─── 重複配置 ───

export type ValidateTeacherDuplicateInput = {
  readonly timetable: readonly TimetableEntry[]
  readonly teachers: readonly Teacher[]
}

export function validateTeacherDuplicate(input: ValidateTeacherDuplicateInput): TeacherViolation[] {
  const { timetable, teachers } = input
  const violations: TeacherViolation[] = []
  const teacherMap = new Map(teachers.map((t) => [t.id, t.name]))

  // day+period+teacherId でグルーピング
  const slotMap = new Map<string, TimetableEntry[]>()
  for (const entry of timetable) {
    if (!entry.teacher_id) continue
    const key = `${entry.day_of_week}|${entry.period}|${entry.teacher_id}`
    const list = slotMap.get(key) ?? []
    list.push(entry)
    slotMap.set(key, list)
  }

  for (const [, entries] of slotMap) {
    if (entries.length <= 1) continue
    const tid = entries[0].teacher_id!
    const name = teacherMap.get(tid) ?? tid
    violations.push({
      type: 'teacher_duplicate',
      severity: 'error',
      teacherId: tid,
      teacherName: name,
      message: `${name}: ${entries[0].day_of_week}${entries[0].period}限に${entries.length}クラスで重複配置`,
    })
  }
  return violations
}

// ─── 1日コマ数上限 ───

export type ValidateTeacherLimitInput = {
  readonly timetable: readonly TimetableEntry[]
  readonly teacherId: string
  readonly teacherName: string
  readonly constraints: TeacherConstraintSettings
}

export function validateTeacherDailyLimit(input: ValidateTeacherLimitInput): TeacherViolation[] {
  const { timetable, teacherId, teacherName, constraints } = input
  if (constraints.max_daily_periods === null) return []

  const violations: TeacherViolation[] = []
  const limit = constraints.max_daily_periods

  for (const day of DAYS) {
    const count = timetable.filter(
      (e) => e.teacher_id === teacherId && e.day_of_week === day && e.subject !== null,
    ).length
    if (count > limit) {
      violations.push({
        type: 'teacher_daily',
        severity: severityFromHardness(constraints.max_daily_hardness),
        teacherId,
        teacherName,
        message: `${teacherName}: ${day}曜日 ${count}コマ（上限${limit}）`,
      })
    }
  }
  return violations
}

// ─── 連続コマ数上限 ───

export function validateTeacherConsecutiveLimit(input: ValidateTeacherLimitInput): TeacherViolation[] {
  const { timetable, teacherId, teacherName, constraints } = input
  if (constraints.max_consecutive_periods === null) return []

  const violations: TeacherViolation[] = []
  const limit = constraints.max_consecutive_periods

  for (const day of DAYS) {
    const periods = timetable
      .filter((e) => e.teacher_id === teacherId && e.day_of_week === day && e.subject !== null)
      .map((e) => e.period)
      .sort((a, b) => a - b)

    let consecutive = 1
    for (let i = 1; i < periods.length; i++) {
      if (periods[i] === periods[i - 1] + 1) {
        consecutive++
        if (consecutive > limit) {
          violations.push({
            type: 'teacher_consecutive',
            severity: severityFromHardness(constraints.max_consecutive_hardness),
            teacherId,
            teacherName,
            message: `${teacherName}: ${day}曜日 ${consecutive}コマ連続（上限${limit}）`,
          })
          break
        }
      } else {
        consecutive = 1
      }
    }
  }
  return violations
}

// ─── 週コマ数上限 ───

export function validateTeacherWeeklyLimit(input: ValidateTeacherLimitInput): TeacherViolation[] {
  const { timetable, teacherId, teacherName, constraints } = input
  if (constraints.max_weekly_periods === null) return []

  const count = timetable.filter(
    (e) => e.teacher_id === teacherId && e.subject !== null,
  ).length

  if (count > constraints.max_weekly_periods) {
    return [{
      type: 'teacher_weekly',
      severity: severityFromHardness(constraints.max_weekly_hardness),
      teacherId,
      teacherName,
      message: `${teacherName}: 週${count}コマ（上限${constraints.max_weekly_periods}）`,
    }]
  }
  return []
}

// ─── 非常勤出勤日 ───

export type ValidatePartTimeInput = {
  readonly timetable: readonly TimetableEntry[]
  readonly teacher: Teacher
}

export function validatePartTimeAvailability(input: ValidatePartTimeInput): TeacherViolation[] {
  const { timetable, teacher } = input
  if (teacher.available_days === null) return []

  const violations: TeacherViolation[] = []
  const allowedDays = new Set(teacher.available_days)

  for (const entry of timetable) {
    if (entry.teacher_id !== teacher.id || entry.subject === null) continue
    if (!allowedDays.has(entry.day_of_week)) {
      violations.push({
        type: 'part_time_day',
        severity: 'error',
        teacherId: teacher.id,
        teacherName: teacher.name,
        message: `${teacher.name}: ${entry.day_of_week}曜日は出勤不可`,
      })
    }
  }
  return violations
}
