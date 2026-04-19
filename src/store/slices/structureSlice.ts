import type { StateCreator } from "zustand";
import type {
  SchoolStructure,
  SubjectConstraint,
  TimetableStore,
} from "@/types";

export interface StructureSlice {
  structure: SchoolStructure;
  subject_constraints: Record<string, SubjectConstraint>;
  addClass: (grade: number, className: string) => void;
  removeClass: (grade: number, className: string) => void;
  addSubject: (newSubject: string) => void;
  removeSubject: (subjectToDelete: string) => void;
  updateSubjectConstraint: (
    subject: string,
    maxConsecutiveDays: number | null,
  ) => void;
  updateRequiredHours: (
    keyString: string,
    subject: string,
    hours: string,
  ) => void;
}

const dummyStructure: SchoolStructure = {
  grades: [
    { grade: 1, classes: ["1組", "2組"] },
    { grade: 2, classes: ["1組"] },
    { grade: 3, classes: [] },
  ],
  required_hours: {
    "1_通常": { 国語: 4, 数学: 4, 英語: 4, 理科: 3 },
    "2_通常": { 国語: 4, 数学: 3, 英語: 4, 理科: 4 },
    "3_通常": { 国語: 4, 数学: 4, 英語: 4, 理科: 4 },
  },
};

const dummySubjectConstraints: Record<string, SubjectConstraint> = {
  国語: { max_consecutive_days: null },
  数学: { max_consecutive_days: null },
  英語: { max_consecutive_days: null },
  理科: { max_consecutive_days: null },
};

export const createStructureSlice: StateCreator<
  TimetableStore,
  [],
  [],
  StructureSlice
> = (set) => ({
  structure: dummyStructure,
  subject_constraints: dummySubjectConstraints,

  addClass: (grade, className) => {
    set((state) => {
      const newGrades = state.structure.grades.map((g) => {
        if (g.grade !== grade) return g;
        if (g.classes.includes(className)) return g;
        return { ...g, classes: [...g.classes, className] };
      });
      return { structure: { ...state.structure, grades: newGrades } };
    });
  },

  removeClass: (grade, className) => {
    set((state) => {
      const newGrades = state.structure.grades.map((g) => {
        if (g.grade !== grade) return g;
        return { ...g, classes: g.classes.filter((c) => c !== className) };
      });
      const newTimetable = state.timetable.filter(
        (e) => !(e.grade === grade && e.class_name === className),
      );
      return {
        structure: { ...state.structure, grades: newGrades },
        timetable: newTimetable,
      };
    });
  },

  addSubject: (newSubject) => {
    set((state) => {
      const newStruct = { ...state.structure };
      const newReqHours = { ...newStruct.required_hours };
      for (const key of Object.keys(newReqHours)) {
        if (newReqHours[key][newSubject] === undefined) {
          newReqHours[key] = { ...newReqHours[key], [newSubject]: 0 };
        }
      }
      const newConstraints = { ...state.subject_constraints };
      if (newConstraints[newSubject] === undefined) {
        newConstraints[newSubject] = { max_consecutive_days: null };
      }
      return {
        structure: { ...newStruct, required_hours: newReqHours },
        subject_constraints: newConstraints,
      };
    });
  },

  removeSubject: (subjectToDelete) => {
    set((state) => {
      const newReqHours = { ...state.structure.required_hours };
      for (const key of Object.keys(newReqHours)) {
        if (newReqHours[key]) {
          const { [subjectToDelete]: _, ...rest } = newReqHours[key];
          newReqHours[key] = rest;
        }
      }
      const newTimetable = state.timetable.filter(
        (e) => e.subject !== subjectToDelete,
      );
      const { [subjectToDelete]: _, ...newConstraints } =
        state.subject_constraints;
      return {
        structure: {
          ...state.structure,
          required_hours: newReqHours,
        },
        timetable: newTimetable,
        subject_constraints: newConstraints,
      };
    });
  },

  updateSubjectConstraint: (subject, maxConsecutiveDays) => {
    set((state) => ({
      subject_constraints: {
        ...state.subject_constraints,
        [subject]: { max_consecutive_days: maxConsecutiveDays },
      },
    }));
  },

  updateRequiredHours: (keyString, subject, hours) => {
    set((state) => {
      const newReqHours = { ...state.structure.required_hours };
      if (!newReqHours[keyString]) {
        newReqHours[keyString] = {};
      }
      newReqHours[keyString] = {
        ...newReqHours[keyString],
        [subject]: parseInt(hours, 10) || 0,
      };
      return {
        structure: { ...state.structure, required_hours: newReqHours },
      };
    });
  },
});
