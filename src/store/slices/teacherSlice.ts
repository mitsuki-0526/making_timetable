import type { Teacher, TeacherGroup } from '@/types'

export type TeacherSlice = {
  teachers: Teacher[]
  teacher_groups: TeacherGroup[]
  addTeacher: (teacher: Teacher) => void
  updateTeacher: (id: string, updates: Partial<Teacher>) => void
  removeTeacher: (id: string) => void
  addTeacherGroup: (group: TeacherGroup) => void
  updateTeacherGroup: (id: string, updates: Partial<TeacherGroup>) => void
  removeTeacherGroup: (id: string) => void
}

export const createTeacherSlice = (
  set: (fn: (state: { teachers: Teacher[]; teacher_groups: TeacherGroup[] }) => Partial<{ teachers: Teacher[]; teacher_groups: TeacherGroup[] }>) => void,
): TeacherSlice => ({
  teachers: [],
  teacher_groups: [],

  addTeacher: (teacher) => {
    set((state) => ({ teachers: [...state.teachers, teacher] }))
  },

  updateTeacher: (id, updates) => {
    set((state) => ({
      teachers: state.teachers.map((t) =>
        t.id === id ? { ...t, ...updates } : t,
      ),
    }))
  },

  removeTeacher: (id) => {
    set((state) => ({
      teachers: state.teachers.filter((t) => t.id !== id),
    }))
  },

  addTeacherGroup: (group) => {
    set((state) => ({ teacher_groups: [...state.teacher_groups, group] }))
  },

  updateTeacherGroup: (id, updates) => {
    set((state) => ({
      teacher_groups: state.teacher_groups.map((g) =>
        g.id === id ? { ...g, ...updates } : g,
      ),
    }))
  },

  removeTeacherGroup: (id) => {
    set((state) => ({
      teacher_groups: state.teacher_groups.filter((g) => g.id !== id),
    }))
  },
})
