import { describe, it, expect, beforeEach } from 'vitest'
import {
  resetIdCounter,
  createTeacher,
  createEntry,
  createStructure,
  createSettings,
  createMappingRule,
  createFixedSlot,
  createSubjectPairing,
  createStandardSchool,
} from './fixtures'
import { toCellKey, fromCellKey } from '@/types'

beforeEach(() => {
  resetIdCounter()
})

describe('テストフィクスチャ', () => {
  it('教員ファクトリがデフォルト値で生成できる', () => {
    const teacher = createTeacher()
    expect(teacher.name).toBe('山田太郎')
    expect(teacher.subjects).toEqual(['数学'])
    expect(teacher.employment_type).toBe('full_time')
  })

  it('教員ファクトリでオーバーライドできる', () => {
    const teacher = createTeacher({
      name: '佐藤花子',
      subjects: ['英語', '国語'],
      employment_type: 'part_time',
      available_days: ['月', '水', '金'],
    })
    expect(teacher.name).toBe('佐藤花子')
    expect(teacher.subjects).toEqual(['英語', '国語'])
    expect(teacher.employment_type).toBe('part_time')
    expect(teacher.available_days).toEqual(['月', '水', '金'])
  })

  it('エントリファクトリがデフォルト値で生成できる', () => {
    const entry = createEntry()
    expect(entry.day_of_week).toBe('月')
    expect(entry.period).toBe(1)
    expect(entry.subject).toBeNull()
    expect(entry.is_locked).toBe(false)
  })

  it('学校構造ファクトリが正常に生成できる', () => {
    const structure = createStructure()
    expect(structure.grades).toHaveLength(1)
    expect(structure.grades[0].classes).toHaveLength(2)
  })

  it('標準学校が3学年で生成できる', () => {
    const { structure, teachers } = createStandardSchool()
    expect(structure.grades).toHaveLength(3)
    expect(structure.grades[0].classes).toHaveLength(3)
    expect(teachers).toHaveLength(6)
  })

  it('設定ファクトリがデフォルト値で生成できる', () => {
    const settings = createSettings()
    expect(settings.mapping_rules).toEqual([])
    expect(settings.lunch_after_period).toBe(4)
  })

  it('マッピングルールファクトリが正常に生成できる', () => {
    const rule = createMappingRule()
    expect(rule.grade).toBe(1)
    expect(rule.from_subject).toBe('国語')
    expect(rule.to_subject).toBe('自立活動')
  })

  it('固定コマファクトリが正常に生成できる', () => {
    const slot = createFixedSlot()
    expect(slot.scope).toBe('school')
    expect(slot.subject).toBe('朝礼')
  })

  it('抱き合わせ教科ファクトリが正常に生成できる', () => {
    const pairing = createSubjectPairing()
    expect(pairing.class_a).toBe('1組')
    expect(pairing.subject_a).toBe('技術')
    expect(pairing.class_b).toBe('2組')
    expect(pairing.subject_b).toBe('家庭科')
  })
})

describe('セルキー', () => {
  it('CellPositionからセルキーを生成できる', () => {
    const key = toCellKey({ grade: 1, class_name: '1組', day_of_week: '月', period: 1 })
    expect(key).toBe('1|1組|月|1')
  })

  it('セルキーからCellPositionを復元できる', () => {
    const pos = fromCellKey('2|特支A|金|6')
    expect(pos.grade).toBe(2)
    expect(pos.class_name).toBe('特支A')
    expect(pos.day_of_week).toBe('金')
    expect(pos.period).toBe(6)
  })

  it('toCellKey→fromCellKeyのラウンドトリップ', () => {
    const original = { grade: 3, class_name: '2組', day_of_week: '水' as const, period: 4 }
    const restored = fromCellKey(toCellKey(original))
    expect(restored).toEqual(original)
  })
})
