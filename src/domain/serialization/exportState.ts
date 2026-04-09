import type {
  Teacher, TeacherGroup, TimetableEntry, SchoolStructure, Settings,
  CellGroup, FixedSlot, SubjectConstraint, SubjectPlacement, SubjectPairing,
  ClassGroup, Facility, SubjectFacility, TeacherConstraintSettings,
  AltWeekPair, SubjectSequence, CrossGradeGroup,
} from '@/types'

const CURRENT_VERSION = 2

export type SerializableState = {
  readonly teachers: readonly Teacher[]
  readonly teacher_groups: readonly TeacherGroup[]
  readonly timetable: readonly TimetableEntry[]
  readonly structure: SchoolStructure
  readonly settings: Settings
  readonly cell_groups: readonly CellGroup[]
  readonly fixed_slots: readonly FixedSlot[]
  readonly subject_constraints: readonly SubjectConstraint[]
  readonly subject_placements: readonly SubjectPlacement[]
  readonly subject_pairings: readonly SubjectPairing[]
  readonly class_groups: readonly ClassGroup[]
  readonly facilities: readonly Facility[]
  readonly subject_facilities: readonly SubjectFacility[]
  readonly teacher_constraints: Readonly<Record<string, TeacherConstraintSettings>>
  readonly alt_week_pairs: readonly AltWeekPair[]
  readonly subject_sequences: readonly SubjectSequence[]
  readonly cross_grade_groups: readonly CrossGradeGroup[]
}

export type ExportedState = SerializableState & {
  readonly version: number
}

/**
 * ストア状態をJSON化可能なオブジェクトに変換する
 */
export function exportState(state: SerializableState): ExportedState {
  return {
    version: CURRENT_VERSION,
    ...state,
  }
}
