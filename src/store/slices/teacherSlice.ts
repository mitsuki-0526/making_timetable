import type { StateCreator } from "zustand";
import { snapshotTimetableEntryTeacherTeams } from "@/lib/teamTeaching";
import type {
  Teacher,
  TeacherInput,
  TimetableStore,
  TtAssignment,
} from "@/types";

export interface TeacherSlice {
  teachers: Teacher[];
  tt_assignments: TtAssignment[];
  addTeacher: (teacherData: TeacherInput) => void;
  updateTeacher: (id: string, teacherData: Partial<Teacher>) => void;
  removeTeacher: (id: string) => void;
  addTtAssignment: (data: {
    name: string;
    subjects: string[];
    grades: number[];
    class_names?: string[];
    target_classes?: Record<number, string[]>;
    teacher_ids: string[];
    enabled?: boolean;
  }) => void;
  updateTtAssignment: (id: string, data: Partial<TtAssignment>) => void;
  removeTtAssignment: (id: string) => void;
}

const dummyTeachers: Teacher[] = [
  {
    id: "T01",
    name: "山田 (国語)",
    subjects: ["国語"],
    target_grades: [1, 2],
    unavailable_times: [{ day_of_week: "月", period: 1 }],
  },
  {
    id: "T02",
    name: "佐藤 (数学)",
    subjects: ["数学"],
    target_grades: [1, 3],
    unavailable_times: [{ day_of_week: "火", period: 2 }],
  },
  {
    id: "T03",
    name: "鈴木 (英語)",
    subjects: ["英語"],
    target_grades: [1, 2, 3],
    unavailable_times: [],
  },
  {
    id: "T04",
    name: "高橋 (理科)",
    subjects: ["理科"],
    target_grades: [2, 3],
    unavailable_times: [
      { day_of_week: "水", period: 3 },
      { day_of_week: "水", period: 4 },
    ],
  },
];

function normalizeTargetClasses(
  targetClasses?: Record<number, string[]>,
): Record<number, string[]> {
  if (!targetClasses) return {};

  return Object.entries(targetClasses).reduce<Record<number, string[]>>(
    (result, [grade, classNames]) => {
      const normalizedClassNames = [...new Set(classNames.filter(Boolean))];
      if (normalizedClassNames.length > 0) {
        result[Number(grade)] = normalizedClassNames;
      }
      return result;
    },
    {},
  );
}

function flattenTargetClasses(
  targetClasses: Record<number, string[]>,
): string[] {
  return [...new Set(Object.values(targetClasses).flat())];
}

export const createTeacherSlice: StateCreator<
  TimetableStore,
  [],
  [],
  TeacherSlice
> = (set) => ({
  teachers: dummyTeachers,
  tt_assignments: [],

  addTeacher: (teacherData) => {
    set((state) => {
      const newId = `T${Date.now()}`;
      return {
        teachers: [...state.teachers, { id: newId, ...teacherData }],
      };
    });
  },

  updateTeacher: (id, teacherData) => {
    set((state) => ({
      teachers: state.teachers.map((t) =>
        t.id === id ? { ...t, ...teacherData } : t,
      ),
    }));
  },

  removeTeacher: (id) => {
    set((state) => {
      const newTimetable = state.timetable.map((entry) =>
        snapshotTimetableEntryTeacherTeams({
          ...entry,
          teacher_id: entry.teacher_id === id ? null : entry.teacher_id,
          teacher_ids: (entry.teacher_ids ?? []).filter(
            (teacherId) => teacherId !== id,
          ),
          alt_teacher_id:
            entry.alt_teacher_id === id ? null : (entry.alt_teacher_id ?? null),
          alt_teacher_ids: (entry.alt_teacher_ids ?? []).filter(
            (teacherId) => teacherId !== id,
          ),
        }),
      );
      return {
        teachers: state.teachers.filter((t) => t.id !== id),
        tt_assignments: state.tt_assignments.map((assignment) => ({
          ...assignment,
          teacher_ids: assignment.teacher_ids.filter(
            (teacherId) => teacherId !== id,
          ),
        })),
        timetable: newTimetable,
      };
    });
  },

  addTtAssignment: ({
    name,
    subjects,
    grades,
    class_names,
    target_classes,
    teacher_ids,
    enabled = true,
  }) => {
    const normalizedTargetClasses = Object.keys(target_classes ?? {}).length
      ? normalizeTargetClasses(target_classes)
      : Object.fromEntries(
          grades.map((grade) => [grade, [...new Set(class_names ?? [])]]),
        );

    set((state) => ({
      tt_assignments: [
        ...state.tt_assignments,
        {
          id: `TT${Date.now()}`,
          name: name.trim(),
          subjects: [...new Set(subjects.filter(Boolean))],
          grades: [...new Set(grades)],
          class_names: flattenTargetClasses(normalizedTargetClasses),
          target_classes: normalizedTargetClasses,
          teacher_ids,
          enabled,
        },
      ],
    }));
  },

  updateTtAssignment: (id, data) => {
    set((state) => ({
      tt_assignments: state.tt_assignments.map((assignment) =>
        assignment.id === id
          ? (() => {
              const nextTargetClasses = data.target_classes
                ? normalizeTargetClasses(data.target_classes)
                : assignment.target_classes;
              return {
                ...assignment,
                ...data,
                class_names: nextTargetClasses
                  ? flattenTargetClasses(nextTargetClasses)
                  : (data.class_names ?? assignment.class_names),
                target_classes: nextTargetClasses,
              };
            })()
          : assignment,
      ),
    }));
  },

  removeTtAssignment: (id) => {
    set((state) => ({
      tt_assignments: state.tt_assignments.filter(
        (assignment) => assignment.id !== id,
      ),
    }));
  },
});
