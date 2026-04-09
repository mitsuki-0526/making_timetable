import { describe, it, expect, beforeEach } from 'vitest'
import { exportState, importState } from '@/domain/serialization'
import {
  resetIdCounter,
  createTeacher,
  createEntry,
  createStructure,
  createGradeConfig,
  createSettings,
  createMappingRule,
} from '../../helpers/fixtures'
import type { TimetableEntry, Teacher, SchoolStructure, Settings } from '@/types'

let teachers: Teacher[]
let timetable: TimetableEntry[]
let structure: SchoolStructure
let settings: Settings

beforeEach(() => {
  resetIdCounter()
  teachers = [
    createTeacher({ id: 't1', name: '鈴木', subjects: ['数学'], target_grades: [1] }),
  ]
  timetable = [
    createEntry({
      day_of_week: '月', period: 1, grade: 1, class_name: '1組',
      subject: '数学', teacher_id: 't1',
    }),
  ]
  structure = createStructure({
    grades: [createGradeConfig({ grade: 1 })],
  })
  settings = createSettings({
    mapping_rules: [createMappingRule({ grade: 1, from_subject: '国語', to_subject: '自立活動' })],
  })
})

describe('exportState', () => {
  it('ストア状態をJSONオブジェクトに変換できる', () => {
    const result = exportState({
      teachers,
      teacher_groups: [],
      timetable,
      structure,
      settings,
      cell_groups: [],
      fixed_slots: [],
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
    })

    expect(result.version).toBe(2)
    expect(result.teachers).toHaveLength(1)
    expect(result.timetable).toHaveLength(1)
    expect(result.structure.grades).toHaveLength(1)
  })
})

describe('importState', () => {
  it('JSONオブジェクトからストア状態を復元できる', () => {
    const exported = exportState({
      teachers,
      teacher_groups: [],
      timetable,
      structure,
      settings,
      cell_groups: [],
      fixed_slots: [],
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
    })

    const result = importState(exported)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.teachers).toHaveLength(1)
      expect(result.data.timetable).toHaveLength(1)
    }
  })

  it('不正なJSON入力でエラーメッセージを返す', () => {
    const result = importState({ invalid: true })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBeTruthy()
    }
  })

  it('バージョンが未対応の場合にエラー', () => {
    const result = importState({ version: 999 })
    expect(result.success).toBe(false)
  })

  it('ラウンドトリップテスト（export→import→exportで同一）', () => {
    const stateInput = {
      teachers,
      teacher_groups: [],
      timetable,
      structure,
      settings,
      cell_groups: [],
      fixed_slots: [],
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

    const exported1 = exportState(stateInput)
    const imported = importState(exported1)
    expect(imported.success).toBe(true)
    if (imported.success) {
      const exported2 = exportState(imported.data)
      expect(exported2).toEqual(exported1)
    }
  })
})
