import { create } from 'zustand'
import { persist } from 'zustand/middleware'
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

export const useTimetableStore = create<TimetableStore>()(
  persist(
    (set, get) => ({
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
    }),
    {
      name: 'timetable-store',
      // アクション（関数）は保存しない。データのみ永続化。
      partialize: (state) => ({
        structure: state.structure,
        teachers: state.teachers,
        teacher_groups: state.teacher_groups,
        timetable: state.timetable,
        cell_groups: state.cell_groups,
        settings: state.settings,
        fixed_slots: state.fixed_slots,
        subject_placements: state.subject_placements,
        subject_constraints: state.subject_constraints,
        alt_week_pairs: state.alt_week_pairs,
        subject_sequences: state.subject_sequences,
        teacher_constraints: state.teacher_constraints,
        facilities: state.facilities,
        subject_facilities: state.subject_facilities,
        subject_pairings: state.subject_pairings,
        class_groups: state.class_groups,
        cross_grade_groups: state.cross_grade_groups,
      }),
    },
  ),
)
