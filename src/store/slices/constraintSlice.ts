import type {
  FixedSlot,
  SubjectPlacement,
  SubjectConstraint,
  AltWeekPair,
  SubjectSequence,
  TeacherConstraintSettings,
} from '@/types'

export type ConstraintSlice = {
  fixed_slots: FixedSlot[]
  subject_placements: SubjectPlacement[]
  subject_constraints: SubjectConstraint[]
  alt_week_pairs: AltWeekPair[]
  subject_sequences: SubjectSequence[]
  teacher_constraints: Record<string, TeacherConstraintSettings>
  addFixedSlot: (slot: FixedSlot) => void
  removeFixedSlot: (id: string) => void
  updateSubjectPlacement: (placement: SubjectPlacement) => void
  removeSubjectPlacement: (subject: string) => void
  updateTeacherConstraints: (teacherId: string, settings: TeacherConstraintSettings) => void
  addAltWeekPair: (pair: AltWeekPair) => void
  removeAltWeekPair: (id: string) => void
  addSubjectSequence: (seq: SubjectSequence) => void
  removeSubjectSequence: (id: string) => void
}

type ConstraintState = Pick<ConstraintSlice,
  'fixed_slots' | 'subject_placements' | 'subject_constraints' |
  'alt_week_pairs' | 'subject_sequences' | 'teacher_constraints'
>

export const createConstraintSlice = (
  set: (fn: (state: ConstraintState) => Partial<ConstraintState>) => void,
): ConstraintSlice => ({
  fixed_slots: [],
  subject_placements: [],
  subject_constraints: [],
  alt_week_pairs: [],
  subject_sequences: [],
  teacher_constraints: {},

  addFixedSlot: (slot) => {
    set((state) => ({ fixed_slots: [...state.fixed_slots, slot] }))
  },
  removeFixedSlot: (id) => {
    set((state) => ({ fixed_slots: state.fixed_slots.filter((s) => s.id !== id) }))
  },

  updateSubjectPlacement: (placement) => {
    set((state) => ({
      subject_placements: [
        ...state.subject_placements.filter((p) => p.subject !== placement.subject),
        placement,
      ],
    }))
  },
  removeSubjectPlacement: (subject) => {
    set((state) => ({
      subject_placements: state.subject_placements.filter((p) => p.subject !== subject),
    }))
  },

  updateTeacherConstraints: (teacherId, settings) => {
    set((state) => ({
      teacher_constraints: { ...state.teacher_constraints, [teacherId]: settings },
    }))
  },

  addAltWeekPair: (pair) => {
    set((state) => ({ alt_week_pairs: [...state.alt_week_pairs, pair] }))
  },
  removeAltWeekPair: (id) => {
    set((state) => ({ alt_week_pairs: state.alt_week_pairs.filter((p) => p.id !== id) }))
  },

  addSubjectSequence: (seq) => {
    set((state) => ({ subject_sequences: [...state.subject_sequences, seq] }))
  },
  removeSubjectSequence: (id) => {
    set((state) => ({ subject_sequences: state.subject_sequences.filter((s) => s.id !== id) }))
  },
})
