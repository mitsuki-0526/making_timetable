import { create } from 'zustand'
import { createSchoolStructureSlice, type SchoolStructureSlice } from './slices/schoolStructureSlice'
import { createTeacherSlice, type TeacherSlice } from './slices/teacherSlice'
import { createTimetableSlice, type TimetableSlice } from './slices/timetableSlice'
import { createConstraintSlice, type ConstraintSlice } from './slices/constraintSlice'
import { createSettingsSlice, type SettingsSlice } from './slices/settingsSlice'
import { createMasterDataSlice, type MasterDataSlice } from './slices/masterDataSlice'
import { DEFAULT_LUNCH_AFTER_PERIOD } from '@/constants/school'

export type TimetableStore =
  SchoolStructureSlice &
  TeacherSlice &
  TimetableSlice &
  ConstraintSlice &
  SettingsSlice &
  MasterDataSlice & {
    reset: () => void
  }

export const useTimetableStore = create<TimetableStore>()((set, get) => ({
  ...createSchoolStructureSlice(set as never, get as never),
  ...createTeacherSlice(set as never),
  ...createTimetableSlice(set as never, get as never),
  ...createConstraintSlice(set as never),
  ...createSettingsSlice(set as never),
  ...createMasterDataSlice(set as never),

  reset: () => {
    set({
      structure: { grades: [] },
      teachers: [],
      teacher_groups: [],
      timetable: [],
      cell_groups: [],
      settings: { mapping_rules: [], lunch_after_period: DEFAULT_LUNCH_AFTER_PERIOD },
      fixed_slots: [],
      subject_placements: [],
      subject_constraints: [],
      alt_week_pairs: [],
      subject_sequences: [],
      teacher_constraints: {},
      facilities: [],
      subject_facilities: [],
      subject_pairings: [],
      class_groups: [],
      cross_grade_groups: [],
    })
  },
}))
