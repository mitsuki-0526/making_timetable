import { describe, it, expect, beforeEach } from 'vitest'
import { useTimetableStore } from '@/store/useTimetableStore'

beforeEach(() => {
  useTimetableStore.getState().reset()
})

describe('teacherSlice', () => {
  it('addTeacher で教員を追加できる', () => {
    const store = useTimetableStore.getState()
    store.addTeacher({
      id: 't1', name: '鈴木', subjects: ['数学'], target_grades: [1],
      unavailable_times: [], employment_type: 'full_time',
      available_days: null, min_hours: null, max_hours: null,
      contract_end_date: null, is_homeroom: false, homeroom_class: null,
    })

    const { teachers } = useTimetableStore.getState()
    expect(teachers).toHaveLength(1)
    expect(teachers[0].name).toBe('鈴木')
  })

  it('updateTeacher で教員を更新できる', () => {
    const store = useTimetableStore.getState()
    store.addTeacher({
      id: 't1', name: '鈴木', subjects: ['数学'], target_grades: [1],
      unavailable_times: [], employment_type: 'full_time',
      available_days: null, min_hours: null, max_hours: null,
      contract_end_date: null, is_homeroom: false, homeroom_class: null,
    })
    store.updateTeacher('t1', { name: '鈴木一郎', subjects: ['数学', '理科'] })

    const { teachers } = useTimetableStore.getState()
    expect(teachers[0].name).toBe('鈴木一郎')
    expect(teachers[0].subjects).toEqual(['数学', '理科'])
  })

  it('removeTeacher で教員を削除できる', () => {
    const store = useTimetableStore.getState()
    store.addTeacher({
      id: 't1', name: '鈴木', subjects: ['数学'], target_grades: [1],
      unavailable_times: [], employment_type: 'full_time',
      available_days: null, min_hours: null, max_hours: null,
      contract_end_date: null, is_homeroom: false, homeroom_class: null,
    })
    store.removeTeacher('t1')

    const { teachers } = useTimetableStore.getState()
    expect(teachers).toHaveLength(0)
  })

  it('addTeacherGroup でグループを追加できる', () => {
    const store = useTimetableStore.getState()
    store.addTeacherGroup({
      id: 'tg1', name: '1年道徳', teacher_ids: ['t1', 't2'],
      subjects: ['道徳'], target_grades: [1],
    })

    const { teacher_groups } = useTimetableStore.getState()
    expect(teacher_groups).toHaveLength(1)
    expect(teacher_groups[0].name).toBe('1年道徳')
  })
})
