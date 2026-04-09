import { describe, it, expect, beforeEach } from 'vitest'
import { useTimetableStore } from '@/store/useTimetableStore'

beforeEach(() => {
  useTimetableStore.getState().reset()
})

describe('schoolStructureSlice', () => {
  it('初期状態でgradesが空配列', () => {
    const { structure } = useTimetableStore.getState()
    expect(structure.grades).toEqual([])
  })

  it('addClass でクラスを追加できる', () => {
    const store = useTimetableStore.getState()
    store.addGrade(1)
    store.addClass(1, '1組', false)

    const { structure } = useTimetableStore.getState()
    expect(structure.grades).toHaveLength(1)
    expect(structure.grades[0].classes).toHaveLength(1)
    expect(structure.grades[0].classes[0].name).toBe('1組')
  })

  it('removeClass でクラスを削除できる', () => {
    const store = useTimetableStore.getState()
    store.addGrade(1)
    store.addClass(1, '1組', false)
    store.addClass(1, '2組', false)
    store.removeClass(1, '1組')

    const { structure } = useTimetableStore.getState()
    expect(structure.grades[0].classes).toHaveLength(1)
    expect(structure.grades[0].classes[0].name).toBe('2組')
  })

  it('updateRequiredHours で規定時数を更新できる', () => {
    const store = useTimetableStore.getState()
    store.addGrade(1)
    store.updateRequiredHours(1, '数学', 4)

    const { structure } = useTimetableStore.getState()
    expect(structure.grades[0].required_hours['数学']).toBe(4)
  })
})
