import { describe, it, expect } from 'vitest'
import { validateFixedSlots } from '@/domain/validation/fixedSlotValidator'
import { createEntry, createFixedSlot } from '../../helpers/fixtures'

describe('validateFixedSlots', () => {
  it('固定コマ通りなら違反なし', () => {
    const fixedSlots = [
      createFixedSlot({ scope: 'school', day_of_week: '月', period: 1, subject: '朝礼' }),
    ]
    const timetable = [
      createEntry({ day_of_week: '月', period: 1, grade: 1, class_name: '1組', subject: '朝礼' }),
    ]
    const result = validateFixedSlots({ timetable, fixedSlots })
    expect(result).toHaveLength(0)
  })

  it('全校固定コマと異なる教科が配置されている場合に違反を返す', () => {
    const fixedSlots = [
      createFixedSlot({ scope: 'school', day_of_week: '月', period: 1, subject: '朝礼' }),
    ]
    const timetable = [
      createEntry({ day_of_week: '月', period: 1, grade: 1, class_name: '1組', subject: '数学' }),
    ]
    const result = validateFixedSlots({ timetable, fixedSlots })
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('error')
    expect(result[0].type).toBe('fixed_slot')
  })

  it('学年単位の固定コマが正しく検証される', () => {
    const fixedSlots = [
      createFixedSlot({ scope: 'grade', grade: 1, day_of_week: '火', period: 1, subject: '学年集会' }),
    ]
    const timetable = [
      createEntry({ day_of_week: '火', period: 1, grade: 1, class_name: '1組', subject: '数学' }),
      createEntry({ day_of_week: '火', period: 1, grade: 2, class_name: '1組', subject: '数学' }),
    ]
    const result = validateFixedSlots({ timetable, fixedSlots })
    // 1年のみ違反、2年は対象外
    expect(result).toHaveLength(1)
    expect(result[0].entry.grade).toBe(1)
  })

  it('クラス単位の固定コマが正しく検証される', () => {
    const fixedSlots = [
      createFixedSlot({ scope: 'class', grade: 1, class_name: '1組', day_of_week: '水', period: 3, subject: '道徳' }),
    ]
    const timetable = [
      createEntry({ day_of_week: '水', period: 3, grade: 1, class_name: '1組', subject: '英語' }),
      createEntry({ day_of_week: '水', period: 3, grade: 1, class_name: '2組', subject: '英語' }),
    ]
    const result = validateFixedSlots({ timetable, fixedSlots })
    expect(result).toHaveLength(1)
    expect(result[0].entry.class_name).toBe('1組')
  })

  it('教科未設定のコマは違反としない', () => {
    const fixedSlots = [
      createFixedSlot({ scope: 'school', day_of_week: '月', period: 1, subject: '朝礼' }),
    ]
    const timetable = [
      createEntry({ day_of_week: '月', period: 1, grade: 1, class_name: '1組', subject: null }),
    ]
    const result = validateFixedSlots({ timetable, fixedSlots })
    expect(result).toHaveLength(0)
  })
})
