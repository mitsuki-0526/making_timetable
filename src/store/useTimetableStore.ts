import { create } from "zustand";
import type { TimetableFileData, TimetableStore } from "@/types";
import { createConstraintSlice } from "./slices/constraintSlice";
import { createSettingsSlice } from "./slices/settingsSlice";
import { createStructureSlice } from "./slices/structureSlice";
import { createTeacherSlice } from "./slices/teacherSlice";
import { createTimetableSlice } from "./slices/timetableSlice";

export const useTimetableStore = create<TimetableStore>()((...a) => ({
  ...createTimetableSlice(...a),
  ...createTeacherSlice(...a),
  ...createStructureSlice(...a),
  ...createConstraintSlice(...a),
  ...createSettingsSlice(...a),

  importState: (newState: Partial<TimetableFileData>) => {
    const [set] = a;
    set((state) => ({
      teachers: newState.teachers ?? state.teachers,
      teacher_groups: newState.teacher_groups ?? state.teacher_groups,
      class_groups: newState.class_groups ?? state.class_groups,
      structure: newState.structure ?? state.structure,
      timetable: newState.timetable ?? state.timetable,
      subject_constraints:
        newState.subject_constraints ?? state.subject_constraints,
      subject_pairings: newState.subject_pairings ?? state.subject_pairings,
      cell_groups: newState.cell_groups ?? state.cell_groups,
      fixed_slots: newState.fixed_slots ?? state.fixed_slots,
      teacher_constraints:
        newState.teacher_constraints ?? state.teacher_constraints,
      subject_placement: newState.subject_placement ?? state.subject_placement,
      facilities: newState.facilities ?? state.facilities,
      subject_facility: newState.subject_facility ?? state.subject_facility,
      alt_week_pairs: newState.alt_week_pairs ?? state.alt_week_pairs,
      cross_grade_groups:
        newState.cross_grade_groups ?? state.cross_grade_groups,
      subject_sequences: newState.subject_sequences ?? state.subject_sequences,
      settings: newState.settings
        ? {
            ...state.settings,
            ...newState.settings,
            mappingRules:
              newState.settings.mappingRules ?? state.settings.mappingRules,
          }
        : state.settings,
    }));
  },
}));
