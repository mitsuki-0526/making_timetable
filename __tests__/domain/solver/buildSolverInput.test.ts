import { describe, it, expect, beforeEach } from 'vitest'
import { buildSolverInput } from '@/domain/solver/buildSolverInput'
import { createStandardSchool, createEntry, createFixedSlot, resetIdCounter, createTeacherConstraintSettings } from '../../helpers/fixtures'
import type { TimetableStore } from '@/store/useTimetableStore'

function createMockStore(overrides: Partial<TimetableStore> = {}): TimetableStore {
  const { structure, teachers } = createStandardSchool()
  return {
    structure,
    teachers,
    teacher_groups: [],
    timetable: [],
    cell_groups: [],
    settings: { mapping_rules: [], lunch_after_period: 4 },
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
    ...overrides,
  } as TimetableStore
}

describe('buildSolverInput', () => {
  beforeEach(() => resetIdCounter())

  it('全上書きモードで全スロットを非固定として返す', () => {
    const store = createMockStore()
    const input = buildSolverInput(store, 'full')

    // 3学年 × 3クラス × 5日 × 6時限 = 270スロット
    expect(input.slots.length).toBe(270)
    expect(input.slots.every((s) => !s.isFixed)).toBe(true)
  })

  it('空きのみモードで既存配置を固定として返す', () => {
    const store = createMockStore({
      timetable: [
        createEntry({ grade: 1, class_name: '1組', day_of_week: '月', period: 1, subject: '数学', teacher_id: 't1' }),
      ],
    })
    const input = buildSolverInput(store, 'empty_only')

    const fixedSlot = input.slots.find(
      (s) => s.grade === 1 && s.class_name === '1組' && s.day === '月' && s.period === 1,
    )
    expect(fixedSlot?.isFixed).toBe(true)
    expect(fixedSlot?.currentSubject).toBe('数学')
  })

  it('固定コマをisFixedとしてマークする', () => {
    const store = createMockStore({
      fixed_slots: [
        createFixedSlot({ scope: 'school', day_of_week: '月', period: 1, subject: '朝礼' }),
      ],
    })
    const input = buildSolverInput(store, 'full')

    const monday1stSlots = input.slots.filter((s) => s.day === '月' && s.period === 1)
    expect(monday1stSlots.every((s) => s.isFixed)).toBe(true)
  })

  it('教科の不足分をrequirementsとして返す', () => {
    const store = createMockStore()
    const input = buildSolverInput(store, 'full')

    // 1年1組の数学は required=4, current=0
    const mathReq = input.requirements.find(
      (r) => r.grade === 1 && r.class_name === '1組' && r.subject === '数学',
    )
    expect(mathReq).toBeDefined()
    expect(mathReq!.required).toBe(4)
    expect(mathReq!.current).toBe(0)
  })

  it('教員情報を正しく変換する', () => {
    const store = createMockStore()
    const input = buildSolverInput(store, 'full')

    expect(input.teachers.length).toBe(6)
    const suzuki = input.teachers.find((t) => t.id === 't1')
    expect(suzuki?.name).toBe('鈴木')
    expect(suzuki?.subjects).toEqual(['数学'])
  })

  it('ハード制約の教員日次上限を抽出する', () => {
    const store = createMockStore({
      teacher_constraints: {
        t1: createTeacherConstraintSettings({ max_daily_periods: 4, max_daily_hardness: 'hard' }),
      },
    })
    const input = buildSolverInput(store, 'full')

    expect(input.hardConstraints.maxDailyPerTeacher['t1']).toBe(4)
  })
})
