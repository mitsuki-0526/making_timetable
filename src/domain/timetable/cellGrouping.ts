import type { TimetableEntry, CellGroup, CellKey } from '@/types'
import { toCellKey } from '@/types'

export type GroupCellsInput = {
  readonly timetable: readonly TimetableEntry[]
  readonly cellGroups: readonly CellGroup[]
  readonly cellKeys: readonly CellKey[]
  readonly groupId: string
}

export type UngroupCellsInput = {
  readonly timetable: readonly TimetableEntry[]
  readonly cellGroups: readonly CellGroup[]
  readonly groupId: string
}

/**
 * 複数セルをグループ化する
 */
export function groupCells(input: GroupCellsInput): {
  timetable: TimetableEntry[]
  cellGroups: CellGroup[]
} {
  const { timetable, cellGroups, cellKeys, groupId } = input
  const keySet = new Set(cellKeys)

  const newTimetable = timetable.map((entry) => {
    const key = toCellKey(entry)
    if (keySet.has(key)) {
      return { ...entry, cell_group_id: groupId }
    }
    return entry
  })

  const newCellGroups = [
    ...cellGroups,
    { id: groupId, cell_keys: cellKeys },
  ]

  return { timetable: newTimetable, cellGroups: newCellGroups }
}

/**
 * グループ解除: 全セルのcell_group_idをnullにし、グループを削除
 */
export function ungroupCells(input: UngroupCellsInput): {
  timetable: TimetableEntry[]
  cellGroups: CellGroup[]
} {
  const { timetable, cellGroups, groupId } = input

  const newTimetable = timetable.map((entry) => {
    if (entry.cell_group_id === groupId) {
      return { ...entry, cell_group_id: null }
    }
    return entry
  })

  const newCellGroups = cellGroups.filter((g) => g.id !== groupId)

  return { timetable: newTimetable, cellGroups: newCellGroups }
}
