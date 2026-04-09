import { describe, it, expect, beforeEach } from 'vitest'
import { groupCells, ungroupCells } from '@/domain/timetable/cellGrouping'
import { resetIdCounter, createEntry, createCellGroup } from '../../helpers/fixtures'
import type { TimetableEntry, CellGroup } from '@/types'

let timetable: TimetableEntry[]
let cellGroups: CellGroup[]

beforeEach(() => {
  resetIdCounter()
  timetable = [
    createEntry({ day_of_week: '月', period: 1, grade: 1, class_name: '1組', subject: '体育' }),
    createEntry({ day_of_week: '月', period: 1, grade: 1, class_name: '2組', subject: '体育' }),
  ]
  cellGroups = []
})

describe('groupCells', () => {
  it('複数セルをグループ化できること', () => {
    const cellKeys = ['1|1組|月|1', '1|2組|月|1']
    const result = groupCells({ timetable, cellGroups, cellKeys, groupId: 'g1' })

    expect(result.timetable[0].cell_group_id).toBe('g1')
    expect(result.timetable[1].cell_group_id).toBe('g1')
    expect(result.cellGroups).toHaveLength(1)
    expect(result.cellGroups[0].id).toBe('g1')
    expect(result.cellGroups[0].cell_keys).toEqual(cellKeys)
  })
})

describe('ungroupCells', () => {
  it('グループ解除で全セルのcell_group_idがnullになること', () => {
    timetable = [
      createEntry({ day_of_week: '月', period: 1, grade: 1, class_name: '1組', subject: '体育', cell_group_id: 'g1' }),
      createEntry({ day_of_week: '月', period: 1, grade: 1, class_name: '2組', subject: '体育', cell_group_id: 'g1' }),
    ]
    cellGroups = [createCellGroup({ id: 'g1', cell_keys: ['1|1組|月|1', '1|2組|月|1'] })]

    const result = ungroupCells({ timetable, cellGroups, groupId: 'g1' })

    expect(result.timetable[0].cell_group_id).toBeNull()
    expect(result.timetable[1].cell_group_id).toBeNull()
    expect(result.cellGroups).toHaveLength(0)
  })
})
