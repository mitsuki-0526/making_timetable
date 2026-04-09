import type {
  Facility,
  SubjectFacility,
  SubjectPairing,
  ClassGroup,
  CrossGradeGroup,
} from '@/types'

export type MasterDataSlice = {
  facilities: Facility[]
  subject_facilities: SubjectFacility[]
  subject_pairings: SubjectPairing[]
  class_groups: ClassGroup[]
  cross_grade_groups: CrossGradeGroup[]
  addFacility: (facility: Facility) => void
  removeFacility: (id: string) => void
  updateSubjectFacility: (sf: SubjectFacility) => void
  addSubjectPairing: (pairing: SubjectPairing) => void
  removeSubjectPairing: (id: string) => void
  addClassGroup: (group: ClassGroup) => void
  removeClassGroup: (id: string) => void
  addCrossGradeGroup: (group: CrossGradeGroup) => void
  removeCrossGradeGroup: (id: string) => void
}

type MasterState = Pick<MasterDataSlice,
  'facilities' | 'subject_facilities' | 'subject_pairings' |
  'class_groups' | 'cross_grade_groups'
>

export const createMasterDataSlice = (
  set: (fn: (state: MasterState) => Partial<MasterState>) => void,
): MasterDataSlice => ({
  facilities: [],
  subject_facilities: [],
  subject_pairings: [],
  class_groups: [],
  cross_grade_groups: [],

  addFacility: (facility) => {
    set((state) => ({ facilities: [...state.facilities, facility] }))
  },
  removeFacility: (id) => {
    set((state) => ({ facilities: state.facilities.filter((f) => f.id !== id) }))
  },

  updateSubjectFacility: (sf) => {
    set((state) => ({
      subject_facilities: [
        ...state.subject_facilities.filter((s) => s.subject !== sf.subject),
        sf,
      ],
    }))
  },

  addSubjectPairing: (pairing) => {
    set((state) => ({ subject_pairings: [...state.subject_pairings, pairing] }))
  },
  removeSubjectPairing: (id) => {
    set((state) => ({ subject_pairings: state.subject_pairings.filter((p) => p.id !== id) }))
  },

  addClassGroup: (group) => {
    set((state) => ({ class_groups: [...state.class_groups, group] }))
  },
  removeClassGroup: (id) => {
    set((state) => ({ class_groups: state.class_groups.filter((g) => g.id !== id) }))
  },

  addCrossGradeGroup: (group) => {
    set((state) => ({ cross_grade_groups: [...state.cross_grade_groups, group] }))
  },
  removeCrossGradeGroup: (id) => {
    set((state) => ({ cross_grade_groups: state.cross_grade_groups.filter((g) => g.id !== id) }))
  },
})
