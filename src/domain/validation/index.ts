import type {
  TimetableEntry,
  Teacher,
  SchoolStructure,
  FixedSlot,
  TeacherConstraintSettings,
  SubjectPlacement,
  Facility,
  SubjectFacility,
} from '@/types'
import { type FixedSlotViolation, validateFixedSlots } from './fixedSlotValidator'
import {
  type TeacherViolation,
  validateTeacherDuplicate,
  validateTeacherDailyLimit,
  validateTeacherConsecutiveLimit,
  validateTeacherWeeklyLimit,
  validatePartTimeAvailability,
} from './teacherValidator'
import {
  type SubjectViolation,
  validateRequiredHours,
  validateConsecutiveDays,
  validateAllowedPeriods,
} from './subjectValidator'
import { type FacilityViolation, validateFacilityConflict } from './facilityValidator'

export type ValidationResult = {
  readonly fixedSlots: readonly FixedSlotViolation[]
  readonly teachers: readonly TeacherViolation[]
  readonly subjects: readonly SubjectViolation[]
  readonly facilities: readonly FacilityViolation[]
}

export type ValidateAllInput = {
  readonly timetable: readonly TimetableEntry[]
  readonly teachers: readonly Teacher[]
  readonly structure: SchoolStructure
  readonly fixedSlots: readonly FixedSlot[]
  readonly teacherConstraints: ReadonlyMap<string, TeacherConstraintSettings>
  readonly subjectPlacements: readonly SubjectPlacement[]
  readonly facilities: readonly Facility[]
  readonly subjectFacilities: readonly SubjectFacility[]
}

/**
 * 全バリデーションを統合実行して結果を返す
 */
export function validateAll(input: ValidateAllInput): ValidationResult {
  const {
    timetable, teachers, structure, fixedSlots,
    teacherConstraints, subjectPlacements, facilities, subjectFacilities,
  } = input

  // 固定コマ
  const fixedSlotViolations = validateFixedSlots({ timetable, fixedSlots })

  // 教員系
  const teacherViolations: TeacherViolation[] = [
    ...validateTeacherDuplicate({ timetable, teachers }),
  ]
  for (const teacher of teachers) {
    const constraints = teacherConstraints.get(teacher.id)
    if (constraints) {
      teacherViolations.push(
        ...validateTeacherDailyLimit({ timetable, teacherId: teacher.id, teacherName: teacher.name, constraints }),
        ...validateTeacherConsecutiveLimit({ timetable, teacherId: teacher.id, teacherName: teacher.name, constraints }),
        ...validateTeacherWeeklyLimit({ timetable, teacherId: teacher.id, teacherName: teacher.name, constraints }),
      )
    }
    teacherViolations.push(...validatePartTimeAvailability({ timetable, teacher }))
  }

  // 教科系
  const subjectViolations: SubjectViolation[] = [
    ...validateRequiredHours({ timetable, structure }),
    ...validateAllowedPeriods({ timetable, placements: subjectPlacements }),
  ]
  for (const gradeConfig of structure.grades) {
    for (const cls of gradeConfig.classes) {
      subjectViolations.push(
        ...validateConsecutiveDays({
          timetable,
          placements: subjectPlacements,
          grade: gradeConfig.grade,
          className: cls.name,
        }),
      )
    }
  }

  // 施設系
  const facilityViolations = validateFacilityConflict({ timetable, facilities, subjectFacilities })

  return {
    fixedSlots: fixedSlotViolations,
    teachers: teacherViolations,
    subjects: subjectViolations,
    facilities: facilityViolations,
  }
}
