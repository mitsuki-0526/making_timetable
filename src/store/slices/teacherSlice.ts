import type { StateCreator } from "zustand";
import type {
  Teacher,
  TeacherGroup,
  TeacherInput,
  TimetableStore,
} from "@/types";

export interface TeacherSlice {
  teachers: Teacher[];
  teacher_groups: TeacherGroup[];
  addTeacher: (teacherData: TeacherInput) => void;
  updateTeacher: (id: string, teacherData: Partial<Teacher>) => void;
  removeTeacher: (id: string) => void;
  addTeacherGroup: (data: {
    name: string;
    teacher_ids: string[];
    subjects?: string[];
    target_grades?: number[];
  }) => void;
  updateTeacherGroup: (id: string, data: Partial<TeacherGroup>) => void;
  removeTeacherGroup: (id: string) => void;
  moveTeacherGroup: (id: string, direction: "up" | "down") => void;
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

export const createTeacherSlice: StateCreator<
  TimetableStore,
  [],
  [],
  TeacherSlice
> = (set) => ({
  teachers: dummyTeachers,
  teacher_groups: [],

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
      const newTimetable = state.timetable.map((e) => ({
        ...e,
        teacher_id: e.teacher_id === id ? null : e.teacher_id,
        alt_teacher_id:
          e.alt_teacher_id === id ? null : (e.alt_teacher_id ?? null),
      }));
      const newGroups = state.teacher_groups.map((g) => ({
        ...g,
        teacher_ids: g.teacher_ids.filter((tid) => tid !== id),
      }));
      return {
        teachers: state.teachers.filter((t) => t.id !== id),
        teacher_groups: newGroups,
        timetable: newTimetable,
      };
    });
  },

  addTeacherGroup: ({ name, teacher_ids, subjects, target_grades }) => {
    set((state) => ({
      teacher_groups: [
        ...state.teacher_groups,
        {
          id: `TG${Date.now()}`,
          name: name.trim(),
          teacher_ids,
          subjects,
          target_grades,
        },
      ],
    }));
  },

  updateTeacherGroup: (id, data) => {
    set((state) => ({
      teacher_groups: state.teacher_groups.map((g) =>
        g.id === id ? { ...g, ...data } : g,
      ),
    }));
  },

  removeTeacherGroup: (id) => {
    set((state) => ({
      teacher_groups: state.teacher_groups.filter((g) => g.id !== id),
      timetable: state.timetable.map((e) =>
        e.teacher_group_id === id ? { ...e, teacher_group_id: null } : e,
      ),
    }));
  },

  moveTeacherGroup: (id, direction) => {
    set((state) => {
      const groups = [...state.teacher_groups];
      const idx = groups.findIndex((g) => g.id === id);
      if (idx < 0) return {};
      if (direction === "up" && idx === 0) return {};
      if (direction === "down" && idx === groups.length - 1) return {};
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      [groups[idx], groups[newIdx]] = [groups[newIdx], groups[idx]];
      return { teacher_groups: groups };
    });
  },
});
