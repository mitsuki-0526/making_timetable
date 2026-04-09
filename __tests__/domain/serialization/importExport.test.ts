import { describe, it, expect, beforeEach } from 'vitest'
import { exportState } from '@/domain/serialization/exportState'
import { importState } from '@/domain/serialization/importState'
import type { SerializableState } from '@/domain/serialization/exportState'
import {
  createStandardSchool, createSettings, createEntry,
  createFixedSlot, resetIdCounter,
} from '../../helpers/fixtures'

function createFullState(): SerializableState {
  const { structure, teachers } = createStandardSchool()
  return {
    structure,
    teachers,
    teacher_groups: [],
    timetable: [
      createEntry({ grade: 1, class_name: '1組', day_of_week: '月', period: 1, subject: '数学', teacher_id: 't1' }),
    ],
    settings: createSettings(),
    cell_groups: [],
    fixed_slots: [createFixedSlot()],
    subject_constraints: [],
    subject_placements: [],
    subject_pairings: [],
    class_groups: [],
    facilities: [],
    subject_facilities: [],
    teacher_constraints: {},
    alt_week_pairs: [],
    subject_sequences: [],
    cross_grade_groups: [],
  }
}

describe('export → import ラウンドトリップ', () => {
  beforeEach(() => resetIdCounter())

  it('exportしてimportすると元のデータが復元される', () => {
    const original = createFullState()
    const exported = exportState(original)
    const result = importState(exported)

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.teachers.length).toBe(original.teachers.length)
    expect(result.data.timetable.length).toBe(original.timetable.length)
    expect(result.data.timetable[0].subject).toBe('数学')
    expect(result.data.structure.grades.length).toBe(original.structure.grades.length)
  })

  it('JSON文字列経由でもラウンドトリップが成功する', () => {
    const original = createFullState()
    const exported = exportState(original)
    const json = JSON.stringify(exported)
    const parsed = JSON.parse(json)
    const result = importState(parsed)

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.teachers[0].name).toBe('鈴木')
  })
})
