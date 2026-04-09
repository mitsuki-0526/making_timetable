import { describe, it, expect, beforeEach } from 'vitest'
import { useTimetableStore } from '@/store/useTimetableStore'

beforeEach(() => {
  useTimetableStore.getState().reset()
  // テスト用のデータをセットアップ
  const store = useTimetableStore.getState()
  store.addGrade(1)
  store.addClass(1, '1組', false)
  store.addClass(1, '特支A', true)
  store.addTeacher({
    id: 't1', name: '鈴木', subjects: ['数学', '国語'], target_grades: [1],
    unavailable_times: [], employment_type: 'full_time',
    available_days: null, min_hours: null, max_hours: null,
    contract_end_date: null, is_homeroom: false, homeroom_class: null,
  })
})

describe('timetableSlice', () => {
  it('setEntry でコマを配置し、教員が自動割り当てされる', () => {
    const store = useTimetableStore.getState()
    store.setEntry({
      day_of_week: '月', period: 1, grade: 1, class_name: '1組',
    }, '数学', null)

    const { timetable } = useTimetableStore.getState()
    const entry = timetable.find(
      (e) => e.grade === 1 && e.class_name === '1組' && e.day_of_week === '月' && e.period === 1,
    )
    expect(entry).toBeDefined()
    expect(entry!.subject).toBe('数学')
    expect(entry!.teacher_id).toBe('t1')
  })

  it('setEntry で教科クリアできる', () => {
    const store = useTimetableStore.getState()
    store.setEntry({ day_of_week: '月', period: 1, grade: 1, class_name: '1組' }, '数学', null)
    store.setEntry({ day_of_week: '月', period: 1, grade: 1, class_name: '1組' }, null, null)

    const { timetable } = useTimetableStore.getState()
    const entry = timetable.find(
      (e) => e.grade === 1 && e.class_name === '1組' && e.day_of_week === '月' && e.period === 1,
    )
    expect(entry!.subject).toBeNull()
  })

  it('setEntry で特支マッピングが連動する', () => {
    const store = useTimetableStore.getState()
    store.addMappingRule({ grade: 1, from_subject: '国語', to_subject: '自立活動' })
    store.setEntry({ day_of_week: '月', period: 1, grade: 1, class_name: '1組' }, '国語', null)

    const { timetable } = useTimetableStore.getState()
    const specialEntry = timetable.find(
      (e) => e.class_name === '特支A' && e.day_of_week === '月' && e.period === 1,
    )
    expect(specialEntry).toBeDefined()
    expect(specialEntry!.subject).toBe('自立活動')
  })

  it('groupCells / ungroupCells でセルグループ操作できる', () => {
    const store = useTimetableStore.getState()
    store.setEntry({ day_of_week: '月', period: 1, grade: 1, class_name: '1組' }, '体育', 't1')

    store.addGrade(1) // already exists, noop
    store.addClass(1, '2組', false)
    store.addTeacher({
      id: 't2', name: '田中', subjects: ['体育'], target_grades: [1],
      unavailable_times: [], employment_type: 'full_time',
      available_days: null, min_hours: null, max_hours: null,
      contract_end_date: null, is_homeroom: false, homeroom_class: null,
    })
    store.setEntry({ day_of_week: '月', period: 1, grade: 1, class_name: '2組' }, '体育', 't2')

    store.groupCells(['1|1組|月|1', '1|2組|月|1'], 'g1')

    let state = useTimetableStore.getState()
    expect(state.cell_groups).toHaveLength(1)
    const e1 = state.timetable.find((e) => e.class_name === '1組' && e.day_of_week === '月' && e.period === 1)
    expect(e1!.cell_group_id).toBe('g1')

    store.ungroupCells('g1')
    state = useTimetableStore.getState()
    expect(state.cell_groups).toHaveLength(0)
  })
})
