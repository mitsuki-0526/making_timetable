import { describe, it, expect } from 'vitest'
import {
  validateTeacherDuplicate,
  validateTeacherDailyLimit,
  validateTeacherConsecutiveLimit,
  validateTeacherWeeklyLimit,
  validatePartTimeAvailability,
} from '@/domain/validation/teacherValidator'
import { createTeacher, createEntry, createTeacherConstraintSettings } from '../../helpers/fixtures'

describe('validateTeacherDuplicate', () => {
  it('同日同時限に教員が重複配置されている場合にエラー', () => {
    const timetable = [
      createEntry({ day_of_week: '月', period: 1, grade: 1, class_name: '1組', teacher_id: 't1' }),
      createEntry({ day_of_week: '月', period: 1, grade: 1, class_name: '2組', teacher_id: 't1' }),
    ]
    const teachers = [createTeacher({ id: 't1', name: '鈴木' })]
    const result = validateTeacherDuplicate({ timetable, teachers })
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('error')
  })

  it('異なる時限なら重複なし', () => {
    const timetable = [
      createEntry({ day_of_week: '月', period: 1, grade: 1, class_name: '1組', teacher_id: 't1' }),
      createEntry({ day_of_week: '月', period: 2, grade: 1, class_name: '2組', teacher_id: 't1' }),
    ]
    const teachers = [createTeacher({ id: 't1' })]
    const result = validateTeacherDuplicate({ timetable, teachers })
    expect(result).toHaveLength(0)
  })
})

describe('validateTeacherDailyLimit', () => {
  it('1日コマ数上限超過をハード制約で検出', () => {
    const constraints = createTeacherConstraintSettings({
      max_daily_periods: 4,
      max_daily_hardness: 'hard',
    })
    const timetable = [1, 2, 3, 4, 5].map((period) =>
      createEntry({ day_of_week: '月', period, grade: 1, class_name: '1組', teacher_id: 't1', subject: '数学' }),
    )
    const result = validateTeacherDailyLimit({
      timetable,
      teacherId: 't1',
      teacherName: '鈴木',
      constraints,
    })
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('error')
  })

  it('上限以内なら違反なし', () => {
    const constraints = createTeacherConstraintSettings({ max_daily_periods: 5 })
    const timetable = [1, 2, 3, 4, 5].map((period) =>
      createEntry({ day_of_week: '月', period, grade: 1, class_name: '1組', teacher_id: 't1', subject: '数学' }),
    )
    const result = validateTeacherDailyLimit({ timetable, teacherId: 't1', teacherName: '鈴木', constraints })
    expect(result).toHaveLength(0)
  })

  it('ソフト制約の場合はwarningを返す', () => {
    const constraints = createTeacherConstraintSettings({
      max_daily_periods: 3,
      max_daily_hardness: 'soft',
    })
    const timetable = [1, 2, 3, 4].map((period) =>
      createEntry({ day_of_week: '月', period, grade: 1, class_name: '1組', teacher_id: 't1', subject: '数学' }),
    )
    const result = validateTeacherDailyLimit({ timetable, teacherId: 't1', teacherName: '鈴木', constraints })
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('warning')
  })
})

describe('validateTeacherConsecutiveLimit', () => {
  it('連続コマ数上限超過を検出', () => {
    const constraints = createTeacherConstraintSettings({
      max_consecutive_periods: 3,
      max_consecutive_hardness: 'hard',
    })
    // 月曜1-4限連続
    const timetable = [1, 2, 3, 4].map((period) =>
      createEntry({ day_of_week: '月', period, grade: 1, class_name: '1組', teacher_id: 't1', subject: '数学' }),
    )
    const result = validateTeacherConsecutiveLimit({ timetable, teacherId: 't1', teacherName: '鈴木', constraints })
    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result[0].severity).toBe('error')
  })

  it('昼休みで途切れる場合は連続にならない', () => {
    const constraints = createTeacherConstraintSettings({
      max_consecutive_periods: 3,
      max_consecutive_hardness: 'hard',
    })
    // 月曜1-3限 + 5-6限（4限は空き=昼休み想定）
    const timetable = [1, 2, 3, 5, 6].map((period) =>
      createEntry({ day_of_week: '月', period, grade: 1, class_name: '1組', teacher_id: 't1', subject: '数学' }),
    )
    const result = validateTeacherConsecutiveLimit({ timetable, teacherId: 't1', teacherName: '鈴木', constraints })
    expect(result).toHaveLength(0)
  })
})

describe('validateTeacherWeeklyLimit', () => {
  it('週コマ数上限超過を検出', () => {
    const constraints = createTeacherConstraintSettings({
      max_weekly_periods: 20,
      max_weekly_hardness: 'hard',
    })
    // 5日×5コマ=25コマ
    const days = ['月', '火', '水', '木', '金'] as const
    const timetable = days.flatMap((day) =>
      [1, 2, 3, 4, 5].map((period) =>
        createEntry({ day_of_week: day, period, grade: 1, class_name: '1組', teacher_id: 't1', subject: '数学' }),
      ),
    )
    const result = validateTeacherWeeklyLimit({ timetable, teacherId: 't1', teacherName: '鈴木', constraints })
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('error')
  })
})

describe('validatePartTimeAvailability', () => {
  it('非常勤が出勤不可曜日に配置されている場合にエラー', () => {
    const teacher = createTeacher({
      id: 't1', name: '鈴木',
      employment_type: 'part_time',
      available_days: ['火', '木'],
    })
    const timetable = [
      createEntry({ day_of_week: '月', period: 1, grade: 1, class_name: '1組', teacher_id: 't1', subject: '数学' }),
    ]
    const result = validatePartTimeAvailability({ timetable, teacher })
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('error')
  })

  it('常勤教員は曜日チェック対象外', () => {
    const teacher = createTeacher({ id: 't1', employment_type: 'full_time', available_days: null })
    const timetable = [
      createEntry({ day_of_week: '月', period: 1, grade: 1, class_name: '1組', teacher_id: 't1', subject: '数学' }),
    ]
    const result = validatePartTimeAvailability({ timetable, teacher })
    expect(result).toHaveLength(0)
  })
})
