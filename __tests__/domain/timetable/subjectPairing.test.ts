import { describe, it, expect, beforeEach } from 'vitest'
import { applySubjectPairing } from '@/domain/timetable/subjectPairing'
import {
  resetIdCounter,
  createEntry,
  createSubjectPairing,
} from '../../helpers/fixtures'
import type { TimetableEntry, SubjectPairing } from '@/types'

let timetable: TimetableEntry[]
let pairings: SubjectPairing[]

beforeEach(() => {
  resetIdCounter()
  pairings = [
    createSubjectPairing({
      id: 'p1', grade: 1,
      class_a: '1組', subject_a: '技術',
      class_b: '2組', subject_b: '家庭科',
    }),
  ]
  timetable = []
})

describe('applySubjectPairing', () => {
  it('ペア設定に従って対象クラスに自動配置されること', () => {
    // 1組に「技術」を配置 → 2組に「家庭科」が入るべき
    const result = applySubjectPairing({
      timetable,
      pairings,
      target: { day_of_week: '月', period: 1, grade: 1, class_name: '1組' },
      subject: '技術',
    })
    expect(result).toHaveLength(1)
    expect(result[0].class_name).toBe('2組')
    expect(result[0].subject).toBe('家庭科')
  })

  it('双方向に動作すること（B→Aでも）', () => {
    // 2組に「家庭科」を配置 → 1組に「技術」が入るべき
    const result = applySubjectPairing({
      timetable,
      pairings,
      target: { day_of_week: '月', period: 1, grade: 1, class_name: '2組' },
      subject: '家庭科',
    })
    expect(result).toHaveLength(1)
    expect(result[0].class_name).toBe('1組')
    expect(result[0].subject).toBe('技術')
  })

  it('同一学年内のクラス間のみで動作すること', () => {
    // 2年の1組に「技術」を配置 → ルールはgrade=1なので連動しない
    const result = applySubjectPairing({
      timetable,
      pairings,
      target: { day_of_week: '月', period: 1, grade: 2, class_name: '1組' },
      subject: '技術',
    })
    expect(result).toHaveLength(0)
  })

  it('ペアの片方をクリアすると対応するペアもクリアされること', () => {
    timetable = [
      createEntry({
        day_of_week: '月', period: 1, grade: 1, class_name: '2組',
        subject: '家庭科', teacher_id: 't1',
      }),
    ]
    // 1組の「技術」をクリア → 2組の「家庭科」もクリアされるべき
    const result = applySubjectPairing({
      timetable,
      pairings,
      target: { day_of_week: '月', period: 1, grade: 1, class_name: '1組' },
      subject: null,
    })
    expect(result).toHaveLength(1)
    expect(result[0].class_name).toBe('2組')
    expect(result[0].subject).toBeNull()
  })

  it('ペア設定がない教科は連動しないこと', () => {
    const result = applySubjectPairing({
      timetable,
      pairings,
      target: { day_of_week: '月', period: 1, grade: 1, class_name: '1組' },
      subject: '数学',
    })
    expect(result).toHaveLength(0)
  })
})
