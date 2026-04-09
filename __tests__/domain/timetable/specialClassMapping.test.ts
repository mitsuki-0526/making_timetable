import { describe, it, expect, beforeEach } from 'vitest'
import { applySpecialClassMapping } from '@/domain/timetable/specialClassMapping'
import {
  resetIdCounter,
  createEntry,
  createMappingRule,
  createSettings,
} from '../../helpers/fixtures'
import type { TimetableEntry, Settings, SchoolStructure } from '@/types'

let timetable: TimetableEntry[]
let settings: Settings
let structure: SchoolStructure

beforeEach(() => {
  resetIdCounter()

  structure = {
    grades: [{
      grade: 1,
      classes: [
        { name: '1組', is_special_needs: false },
        { name: '2組', is_special_needs: false },
        { name: '特支A', is_special_needs: true },
      ],
      required_hours: { 数学: 4, 国語: 4 },
    }],
  }

  settings = createSettings({
    mapping_rules: [
      createMappingRule({ grade: 1, from_subject: '国語', to_subject: '自立活動' }),
      createMappingRule({ grade: 1, from_subject: '数学', to_subject: '生活単元' }),
    ],
  })

  timetable = []
})

describe('applySpecialClassMapping', () => {
  it('マッピングルールに従って特支クラスにエントリが追加されること', () => {
    const result = applySpecialClassMapping({
      timetable,
      structure,
      settings,
      target: { day_of_week: '月', period: 1, grade: 1, class_name: '1組' },
      subject: '国語',
    })
    // 特支Aに「自立活動」が追加されるべき
    const specialEntry = result.find(
      (e) => e.class_name === '特支A' && e.day_of_week === '月' && e.period === 1,
    )
    expect(specialEntry).toBeDefined()
    expect(specialEntry!.subject).toBe('自立活動')
  })

  it('ルール未設定の教科は連動しないこと', () => {
    const result = applySpecialClassMapping({
      timetable,
      structure,
      settings,
      target: { day_of_week: '月', period: 1, grade: 1, class_name: '1組' },
      subject: '英語', // 英語のルールは設定していない
    })
    const specialEntry = result.find(
      (e) => e.class_name === '特支A' && e.day_of_week === '月' && e.period === 1,
    )
    expect(specialEntry).toBeUndefined()
  })

  it('手動上書き（ロック）されたコマは連動対象外であること', () => {
    // 特支Aに手動上書きされたエントリがある
    timetable = [
      createEntry({
        day_of_week: '月', period: 1, grade: 1, class_name: '特支A',
        subject: '手動教科', is_locked: true,
      }),
    ]
    const result = applySpecialClassMapping({
      timetable,
      structure,
      settings,
      target: { day_of_week: '月', period: 1, grade: 1, class_name: '1組' },
      subject: '国語',
    })
    // ロック済みなので変更されない
    const specialEntry = result.find(
      (e) => e.class_name === '特支A' && e.day_of_week === '月' && e.period === 1,
    )
    expect(specialEntry!.subject).toBe('手動教科')
    expect(specialEntry!.is_locked).toBe(true)
  })

  it('ロック解除後に再び連動対象になること', () => {
    timetable = [
      createEntry({
        day_of_week: '月', period: 1, grade: 1, class_name: '特支A',
        subject: '手動教科', is_locked: false, // ロック解除済み
      }),
    ]
    const result = applySpecialClassMapping({
      timetable,
      structure,
      settings,
      target: { day_of_week: '月', period: 1, grade: 1, class_name: '1組' },
      subject: '国語',
    })
    const specialEntry = result.find(
      (e) => e.class_name === '特支A' && e.day_of_week === '月' && e.period === 1,
    )
    expect(specialEntry!.subject).toBe('自立活動')
  })

  it('特支クラスが複数ある場合に全てに連動すること', () => {
    structure = {
      grades: [{
        grade: 1,
        classes: [
          { name: '1組', is_special_needs: false },
          { name: '特支A', is_special_needs: true },
          { name: '特支B', is_special_needs: true },
        ],
        required_hours: { 国語: 4 },
      }],
    }
    const result = applySpecialClassMapping({
      timetable,
      structure,
      settings,
      target: { day_of_week: '月', period: 1, grade: 1, class_name: '1組' },
      subject: '国語',
    })
    const specialA = result.find((e) => e.class_name === '特支A')
    const specialB = result.find((e) => e.class_name === '特支B')
    expect(specialA!.subject).toBe('自立活動')
    expect(specialB!.subject).toBe('自立活動')
  })

  it('通常クラス側の教科をクリアすると特支側もクリアされること（ロック除く）', () => {
    timetable = [
      createEntry({
        day_of_week: '月', period: 1, grade: 1, class_name: '特支A',
        subject: '自立活動', is_locked: false,
      }),
    ]
    const result = applySpecialClassMapping({
      timetable,
      structure,
      settings,
      target: { day_of_week: '月', period: 1, grade: 1, class_name: '1組' },
      subject: null, // クリア
    })
    const specialEntry = result.find(
      (e) => e.class_name === '特支A' && e.day_of_week === '月' && e.period === 1,
    )
    // エントリが削除されるか、subjectがnullになる
    if (specialEntry) {
      expect(specialEntry.subject).toBeNull()
    }
  })

  it('特支クラスからの操作は連動しないこと（単方向）', () => {
    const result = applySpecialClassMapping({
      timetable,
      structure,
      settings,
      target: { day_of_week: '月', period: 1, grade: 1, class_name: '特支A' },
      subject: '国語',
    })
    // 特支からの操作なので連動は発生しない
    expect(result).toEqual([])
  })
})
