import type { TimetableEntry, CellGroup, CellPosition, CellKey } from '@/types'
import { applyTimetableEntry } from '@/domain/timetable/entryOperations'
import { groupCells as domainGroupCells, ungroupCells as domainUngroupCells } from '@/domain/timetable/cellGrouping'

export type TimetableSlice = {
  timetable: TimetableEntry[]
  cell_groups: CellGroup[]
  setEntry: (target: CellPosition, subject: string | null, teacherId: string | null) => void
  groupCells: (cellKeys: CellKey[], groupId: string) => void
  ungroupCells: (groupId: string) => void
  setTimetable: (timetable: TimetableEntry[]) => void
}

type StoreState = {
  timetable: TimetableEntry[]
  cell_groups: CellGroup[]
  teachers: import('@/types').Teacher[]
  teacher_groups: import('@/types').TeacherGroup[]
  structure: import('@/types').SchoolStructure
  settings: import('@/types').Settings
  subject_pairings: import('@/types').SubjectPairing[]
  class_groups: import('@/types').ClassGroup[]
}

export const createTimetableSlice = (
  set: (fn: (state: StoreState) => Partial<StoreState>) => void,
  _get: () => StoreState,
): TimetableSlice => ({
  timetable: [],
  cell_groups: [],

  setEntry: (target, subject, teacherId) => {
    set((state) => {
      const newTimetable = applyTimetableEntry({
        timetable: state.timetable,
        teachers: state.teachers,
        structure: state.structure,
        settings: state.settings,
        pairings: state.subject_pairings,
        teacherGroups: state.teacher_groups,
        classGroups: state.class_groups,
        target,
        subject,
        teacherId,
      })
      return { timetable: newTimetable }
    })
  },

  groupCells: (cellKeys, groupId) => {
    set((state) => {
      const result = domainGroupCells({
        timetable: state.timetable,
        cellGroups: state.cell_groups,
        cellKeys,
        groupId,
      })
      return { timetable: result.timetable, cell_groups: result.cellGroups }
    })
  },

  ungroupCells: (groupId) => {
    set((state) => {
      const result = domainUngroupCells({
        timetable: state.timetable,
        cellGroups: state.cell_groups,
        groupId,
      })
      return { timetable: result.timetable, cell_groups: result.cellGroups }
    })
  },

  setTimetable: (timetable) => {
    set(() => ({ timetable }))
  },
})
