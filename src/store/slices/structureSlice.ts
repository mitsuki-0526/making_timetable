import type { StateCreator } from "zustand";
import type {
  SchoolStructure,
  SubjectConstraint,
  TimetableStore,
} from "@/types";

export interface StructureSlice {
  structure: SchoolStructure;
  subject_constraints: Record<string, SubjectConstraint>;
  addClass: (grade: number, className: string, isSpecial: boolean) => void;
  removeClass: (grade: number, className: string, isSpecial: boolean) => void;
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
    { grade: 1, classes: ["1組", "2組"], special_classes: ["特支1"] },
    { grade: 2, classes: ["1組"], special_classes: ["特支2"] },
    { grade: 3, classes: [], special_classes: [] },
  ],
  required_hours: {
    "1_通常": { 国語: 4, 数学: 4, 英語: 4, 理科: 3 },
    "1_特支": { 国語: 3, 数学: 3, 自立活動: 4 },
    "2_通常": { 国語: 4, 数学: 3, 英語: 4, 理科: 4 },
    "2_特支": { 国語: 2, 数学: 2, 自立活動: 5 },
  },
};

const dummySubjectConstraints: Record<string, SubjectConstraint> = {
  国語: { max_consecutive_days: null },
  数学: { max_consecutive_days: null },
  英語: { max_consecutive_days: null },
  理科: { max_consecutive_days: null },
  自立活動: { max_consecutive_days: null },
};

export const createStructureSlice: StateCreator<
  TimetableStore,
  [],
  [],
  StructureSlice
> = (set) => ({
  structure: dummyStructure,
  subject_constraints: dummySubjectConstraints,

  addClass: (grade, className, isSpecial) => {
    set((state) => {
      const newGrades = state.structure.grades.map((g) => {
        if (g.grade !== grade) return g;
        if (isSpecial) {
          const sc = g.special_classes || [];
          if (sc.includes(className)) return g;
          return { ...g, special_classes: [...sc, className] };
        }
        if (g.classes.includes(className)) return g;
        return { ...g, classes: [...g.classes, className] };
      });
      return { structure: { ...state.structure, grades: newGrades } };
    });
  },

  removeClass: (grade, className, isSpecial) => {
    set((state) => {
      const newGrades = state.structure.grades.map((g) => {
        if (g.grade !== grade) return g;
        if (isSpecial) {
          return {
            ...g,
            special_classes: (g.special_classes || []).filter(
              (c) => c !== className,
            ),
          };
        }
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
      const newMappingRules = { ...state.settings.mappingRules };
      for (const g of Object.keys(newMappingRules)) {
        const gradeKey = Number(g);
        if (newMappingRules[gradeKey]?.[subjectToDelete]) {
          const { [subjectToDelete]: _, ...rest } = newMappingRules[gradeKey];
          newMappingRules[gradeKey] = rest;
        }
      }
      const { [subjectToDelete]: _, ...newConstraints } =
        state.subject_constraints;
      return {
        structure: {
          ...state.structure,
          required_hours: newReqHours,
        },
        timetable: newTimetable,
        settings: {
          ...state.settings,
          mappingRules: newMappingRules,
        },
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
