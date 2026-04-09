import { describe, it, expect } from 'vitest'
import {
  validateRequiredHours,
  validateConsecutiveDays,
  validateAllowedPeriods,
} from '@/domain/validation/subjectValidator'
import { createEntry, createStructure, createGradeConfig, createSubjectPlacement } from '../../helpers/fixtures'

describe('validateRequiredHours', () => {
  it('規定時数不足を検出', () => {
    const structure = createStructure({
      grades: [createGradeConfig({ grade: 1, required_hours: { 数学: 4 } })],
    })
    // 数学が3コマしかない
    const timetable = [
      createEntry({ day_of_week: '月', period: 1, grade: 1, class_name: '1組', subject: '数学' }),
      createEntry({ day_of_week: '火', period: 1, grade: 1, class_name: '1組', subject: '数学' }),
      createEntry({ day_of_week: '水', period: 1, grade: 1, class_name: '1組', subject: '数学' }),
    ]
    const result = validateRequiredHours({ timetable, structure })
    expect(result.some((v) => v.type === 'hours_shortage')).toBe(true)
  })

  it('規定時数超過を検出', () => {
    const structure = createStructure({
      grades: [createGradeConfig({ grade: 1, required_hours: { 数学: 2 } })],
    })
    const timetable = [
      createEntry({ day_of_week: '月', period: 1, grade: 1, class_name: '1組', subject: '数学' }),
      createEntry({ day_of_week: '火', period: 1, grade: 1, class_name: '1組', subject: '数学' }),
      createEntry({ day_of_week: '水', period: 1, grade: 1, class_name: '1組', subject: '数学' }),
    ]
    const result = validateRequiredHours({ timetable, structure })
    expect(result.some((v) => v.type === 'hours_excess')).toBe(true)
  })

  it('規定通りなら違反なし', () => {
    const structure = createStructure({
      grades: [createGradeConfig({
        grade: 1,
        classes: [{ name: '1組', is_special_needs: false }],
        required_hours: { 数学: 2 },
      })],
    })
    const timetable = [
      createEntry({ day_of_week: '月', period: 1, grade: 1, class_name: '1組', subject: '数学' }),
      createEntry({ day_of_week: '火', period: 1, grade: 1, class_name: '1組', subject: '数学' }),
    ]
    const result = validateRequiredHours({ timetable, structure })
    expect(result).toHaveLength(0)
  })
})

describe('validateConsecutiveDays', () => {
  it('連続授業日数超過を検出', () => {
    const placement = createSubjectPlacement({
      subject: '数学',
      max_consecutive_days: 2,
      max_consecutive_days_hardness: 'hard',
    })
    // 月火水の3日連続
    const timetable = [
      createEntry({ day_of_week: '月', period: 1, grade: 1, class_name: '1組', subject: '数学' }),
      createEntry({ day_of_week: '火', period: 2, grade: 1, class_name: '1組', subject: '数学' }),
      createEntry({ day_of_week: '水', period: 3, grade: 1, class_name: '1組', subject: '数学' }),
    ]
    const result = validateConsecutiveDays({ timetable, placements: [placement], grade: 1, className: '1組' })
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('error')
  })

  it('間に空き日があれば違反なし', () => {
    const placement = createSubjectPlacement({
      subject: '数学',
      max_consecutive_days: 2,
      max_consecutive_days_hardness: 'hard',
    })
    // 月水金（間に空き）
    const timetable = [
      createEntry({ day_of_week: '月', period: 1, grade: 1, class_name: '1組', subject: '数学' }),
      createEntry({ day_of_week: '水', period: 2, grade: 1, class_name: '1組', subject: '数学' }),
      createEntry({ day_of_week: '金', period: 3, grade: 1, class_name: '1組', subject: '数学' }),
    ]
    const result = validateConsecutiveDays({ timetable, placements: [placement], grade: 1, className: '1組' })
    expect(result).toHaveLength(0)
  })
})

describe('validateAllowedPeriods', () => {
  it('許可されていない時限に配置されている場合に違反', () => {
    const placement = createSubjectPlacement({
      subject: '体育',
      allowed_periods: [3, 4, 5, 6],
      allowed_periods_hardness: 'soft',
    })
    const timetable = [
      createEntry({ day_of_week: '月', period: 1, grade: 1, class_name: '1組', subject: '体育' }),
    ]
    const result = validateAllowedPeriods({ timetable, placements: [placement] })
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('warning')
  })

  it('許可時限内なら違反なし', () => {
    const placement = createSubjectPlacement({
      subject: '体育',
      allowed_periods: [3, 4, 5, 6],
    })
    const timetable = [
      createEntry({ day_of_week: '月', period: 4, grade: 1, class_name: '1組', subject: '体育' }),
    ]
    const result = validateAllowedPeriods({ timetable, placements: [placement] })
    expect(result).toHaveLength(0)
  })
})
