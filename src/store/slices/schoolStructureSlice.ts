import type { SchoolStructure, GradeConfig } from '@/types'

export type SchoolStructureSlice = {
  structure: SchoolStructure
  addGrade: (grade: number) => void
  addClass: (grade: number, className: string, isSpecialNeeds: boolean) => void
  removeClass: (grade: number, className: string) => void
  updateRequiredHours: (grade: number, subject: string, hours: number) => void
}

export const createSchoolStructureSlice = (
  set: (fn: (state: { structure: SchoolStructure }) => { structure: SchoolStructure }) => void,
  _get: () => { structure: SchoolStructure },
): SchoolStructureSlice => ({
  structure: { grades: [] },

  addGrade: (grade) => {
    set((state) => {
      if (state.structure.grades.some((g) => g.grade === grade)) return state
      const newGrade: GradeConfig = { grade, classes: [], required_hours: {} }
      return { structure: { grades: [...state.structure.grades, newGrade] } }
    })
  },

  addClass: (grade, className, isSpecialNeeds) => {
    set((state) => ({
      structure: {
        grades: state.structure.grades.map((g) =>
          g.grade === grade
            ? { ...g, classes: [...g.classes, { name: className, is_special_needs: isSpecialNeeds }] }
            : g,
        ),
      },
    }))
  },

  removeClass: (grade, className) => {
    set((state) => ({
      structure: {
        grades: state.structure.grades.map((g) =>
          g.grade === grade
            ? { ...g, classes: g.classes.filter((c) => c.name !== className) }
            : g,
        ),
      },
    }))
  },

  updateRequiredHours: (grade, subject, hours) => {
    set((state) => ({
      structure: {
        grades: state.structure.grades.map((g) =>
          g.grade === grade
            ? { ...g, required_hours: { ...g.required_hours, [subject]: hours } }
            : g,
        ),
      },
    }))
  },
})
