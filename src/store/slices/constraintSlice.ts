import type { StateCreator } from "zustand";
import type {
  AltWeekPair,
  CellGroup,
  ClassGroup,
  CrossGradeGroup,
  CrossGradeGroupInput,
  Facility,
  FixedSlot,
  FixedSlotInput,
  SubjectPairing,
  SubjectPairingInput,
  SubjectPlacement,
  SubjectSequence,
  TeacherConstraintSettings,
  TimetableStore,
} from "@/types";

export interface ConstraintSlice {
  subject_pairings: SubjectPairing[];
  cell_groups: CellGroup[];
  fixed_slots: FixedSlot[];
  teacher_constraints: Record<string, TeacherConstraintSettings>;
  subject_placement: Record<string, SubjectPlacement>;
  facilities: Facility[];
  subject_facility: Record<string, string | null>;
  alt_week_pairs: AltWeekPair[];
  subject_sequences: SubjectSequence[];
  cross_grade_groups: CrossGradeGroup[];
  class_groups: ClassGroup[];

  // 抱き合わせ教科
  addSubjectPairing: (pairing: SubjectPairingInput) => void;
  removeSubjectPairing: (id: string) => void;

  // 合同クラス
  addClassGroup: (data: {
    grade: number;
    classes: string[];
    split_subjects?: string[];
  }) => void;
  removeClassGroup: (id: string) => void;
  addSplitSubject: (groupId: string, subject: string) => void;
  removeSplitSubject: (groupId: string, subject: string) => void;

  // 固定コマ
  addFixedSlot: (slot: FixedSlotInput) => void;
  removeFixedSlot: (id: string) => void;

  // 教員制約
  updateTeacherConstraintSettings: (
    teacher_id: string,
    constraints: Partial<TeacherConstraintSettings>,
  ) => void;

  // 教科配置制約
  updateSubjectPlacement: (
    subject: string,
    placement: Partial<SubjectPlacement>,
  ) => void;

  // 施設
  addFacility: (name: string) => void;
  removeFacility: (id: string) => void;
  updateSubjectFacility: (subject: string, facilityId: string | null) => void;

  // 隔週授業
  addAltWeekPair: (pair: Omit<AltWeekPair, "id">) => void;
  removeAltWeekPair: (id: string) => void;
  updateAltWeekPair: (id: string, data: Partial<AltWeekPair>) => void;

  // 連続配置
  addSubjectSequence: (seq: Omit<SubjectSequence, "id">) => void;
  removeSubjectSequence: (id: string) => void;

  // 複数学年合同
  addCrossGradeGroup: (data: CrossGradeGroupInput) => void;
  removeCrossGradeGroup: (id: string) => void;
  updateCrossGradeGroup: (id: string, data: Partial<CrossGradeGroup>) => void;
}

export const createConstraintSlice: StateCreator<
  TimetableStore,
  [],
  [],
  ConstraintSlice
> = (set) => ({
  subject_pairings: [],
  cell_groups: [],
  fixed_slots: [],
  teacher_constraints: {},
  subject_placement: {},
  facilities: [],
  subject_facility: {},
  alt_week_pairs: [],
  subject_sequences: [],
  cross_grade_groups: [],
  class_groups: [],

  // ── 抱き合わせ教科 ──
  addSubjectPairing: (pairing) => {
    set((state) => ({
      subject_pairings: state.subject_pairings.some((existing) => {
        const leftMatches =
          existing.grade === pairing.grade &&
          existing.classA === pairing.classA &&
          existing.subjectA === pairing.subjectA &&
          existing.classB === pairing.classB &&
          existing.subjectB === pairing.subjectB;
        const rightMatches =
          existing.grade === pairing.grade &&
          existing.classA === pairing.classB &&
          existing.subjectA === pairing.subjectB &&
          existing.classB === pairing.classA &&
          existing.subjectB === pairing.subjectA;
        return leftMatches || rightMatches;
      })
        ? state.subject_pairings
        : [...state.subject_pairings, { id: `SP${Date.now()}`, ...pairing }],
    }));
  },
  removeSubjectPairing: (id) => {
    set((state) => ({
      subject_pairings: state.subject_pairings.filter((p) => p.id !== id),
    }));
  },

  // ── 合同クラス ──
  addClassGroup: ({ grade, classes, split_subjects }) => {
    set((state) => ({
      class_groups: [
        ...state.class_groups,
        {
          id: `CG${Date.now()}`,
          grade,
          classes,
          split_subjects: split_subjects || [],
        },
      ],
    }));
  },
  removeClassGroup: (id) => {
    set((state) => ({
      class_groups: state.class_groups.filter((g) => g.id !== id),
    }));
  },
  addSplitSubject: (groupId, subject) => {
    set((state) => ({
      class_groups: state.class_groups.map((g) =>
        g.id === groupId && !g.split_subjects.includes(subject)
          ? { ...g, split_subjects: [...g.split_subjects, subject] }
          : g,
      ),
    }));
  },
  removeSplitSubject: (groupId, subject) => {
    set((state) => ({
      class_groups: state.class_groups.map((g) =>
        g.id === groupId
          ? {
              ...g,
              split_subjects: g.split_subjects.filter((s) => s !== subject),
            }
          : g,
      ),
    }));
  },

  // ── 固定コマ ──
  addFixedSlot: (slot) => {
    set((state) => ({
      fixed_slots: [...state.fixed_slots, { id: `FS${Date.now()}`, ...slot }],
    }));
  },
  removeFixedSlot: (id) => {
    set((state) => ({
      fixed_slots: state.fixed_slots.filter((s) => s.id !== id),
    }));
  },

  // ── 教員制約 ──
  updateTeacherConstraintSettings: (teacher_id, constraints) => {
    set((state) => ({
      teacher_constraints: {
        ...state.teacher_constraints,
        [teacher_id]: {
          ...(state.teacher_constraints[teacher_id] || {}),
          ...constraints,
        },
      },
    }));
  },

  // ── 教科配置制約 ──
  updateSubjectPlacement: (subject, placement) => {
    set((state) => ({
      subject_placement: {
        ...state.subject_placement,
        [subject]: {
          ...(state.subject_placement[subject] || {}),
          ...placement,
        },
      },
    }));
  },

  // ── 施設 ──
  addFacility: (name) => {
    set((state) => ({
      facilities: [
        ...state.facilities,
        { id: `FAC${Date.now()}`, name: name.trim() },
      ],
    }));
  },
  removeFacility: (id) => {
    set((state) => ({
      facilities: state.facilities.filter((f) => f.id !== id),
      subject_facility: Object.fromEntries(
        Object.entries(state.subject_facility).filter(([, v]) => v !== id),
      ),
    }));
  },
  updateSubjectFacility: (subject, facilityId) => {
    set((state) => ({
      subject_facility: {
        ...state.subject_facility,
        [subject]: facilityId,
      },
    }));
  },

  // ── 隔週授業ペア ──
  addAltWeekPair: (pair) => {
    set((state) => ({
      alt_week_pairs: [
        ...state.alt_week_pairs,
        { id: `AWP${Date.now()}`, ...pair },
      ],
    }));
  },
  removeAltWeekPair: (id) => {
    set((state) => ({
      alt_week_pairs: state.alt_week_pairs.filter((p) => p.id !== id),
    }));
  },
  updateAltWeekPair: (id, data) => {
    set((state) => ({
      alt_week_pairs: state.alt_week_pairs.map((p) =>
        p.id === id ? { ...p, ...data } : p,
      ),
    }));
  },

  // ── 連続配置ペア ──
  addSubjectSequence: (seq) => {
    set((state) => ({
      subject_sequences: [
        ...state.subject_sequences,
        { id: `SEQ${Date.now()}`, ...seq },
      ],
    }));
  },
  removeSubjectSequence: (id) => {
    set((state) => ({
      subject_sequences: state.subject_sequences.filter((s) => s.id !== id),
    }));
  },

  // ── 複数学年合同授業 ──
  addCrossGradeGroup: ({ name, participants, subject, count }) => {
    set((state) => ({
      cross_grade_groups: [
        ...state.cross_grade_groups,
        {
          id: `CGX${Date.now()}`,
          name: name || "合同授業",
          participants: participants || [],
          subject: subject || "",
          count: count || 1,
        },
      ],
    }));
  },
  removeCrossGradeGroup: (id) => {
    set((state) => ({
      cross_grade_groups: state.cross_grade_groups.filter((g) => g.id !== id),
    }));
  },
  updateCrossGradeGroup: (id, data) => {
    set((state) => ({
      cross_grade_groups: state.cross_grade_groups.map((g) =>
        g.id === id ? { ...g, ...data } : g,
      ),
    }));
  },
});
