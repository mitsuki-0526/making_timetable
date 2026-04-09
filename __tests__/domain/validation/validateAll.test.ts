import { describe, it, expect } from 'vitest'
import { validateAll } from '@/domain/validation'
import {
  createTeacher,
  createEntry,
  createStructure,
  createGradeConfig,
  createFixedSlot,
  createTeacherConstraintSettings,
} from '../../helpers/fixtures'

describe('validateAll', () => {
  it('全バリデータを統合してValidationResultを返す', () => {
    const teachers = [createTeacher({ id: 't1', name: '鈴木', subjects: ['数学'], target_grades: [1] })]
    const structure = createStructure({
      grades: [createGradeConfig({ grade: 1, required_hours: { 数学: 4 } })],
    })
    const timetable = [
      createEntry({ day_of_week: '月', period: 1, grade: 1, class_name: '1組', subject: '数学', teacher_id: 't1' }),
    ]
    const fixedSlots = [
      createFixedSlot({ scope: 'school', day_of_week: '月', period: 1, subject: '朝礼' }),
    ]

    const result = validateAll({
      timetable,
      teachers,
      structure,
      fixedSlots,
      teacherConstraints: new Map([['t1', createTeacherConstraintSettings()]]),
      subjectPlacements: [],
      facilities: [],
      subjectFacilities: [],
    })

    // fixedSlot違反（朝礼に数学が入っている）+ hours_shortage
    expect(result.fixedSlots.length).toBeGreaterThanOrEqual(1)
    expect(result.subjects.some((v) => v.type === 'hours_shortage')).toBe(true)
  })

  it('違反がない場合は全て空配列', () => {
    const result = validateAll({
      timetable: [],
      teachers: [],
      structure: createStructure({ grades: [] }),
      fixedSlots: [],
      teacherConstraints: new Map(),
      subjectPlacements: [],
      facilities: [],
      subjectFacilities: [],
    })

    expect(result.fixedSlots).toHaveLength(0)
    expect(result.teachers).toHaveLength(0)
    expect(result.subjects).toHaveLength(0)
    expect(result.facilities).toHaveLength(0)
  })
})
