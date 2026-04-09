import type { Day } from './timetable'

/** 勤務形態 */
export type EmploymentType = 'full_time' | 'part_time' | 'temporary' | 'substitute'

/** 教員データ */
export type Teacher = {
  readonly id: string
  readonly name: string
  readonly subjects: readonly string[]
  readonly target_grades: readonly number[]
  readonly unavailable_times: readonly { readonly day: Day; readonly period: number }[]
  readonly employment_type: EmploymentType
  readonly available_days: readonly Day[] | null
  readonly min_hours: number | null
  readonly max_hours: number | null
  readonly contract_end_date: string | null
  readonly is_homeroom: boolean
  readonly homeroom_class: { readonly grade: number; readonly class_name: string } | null
}

/** 教員グループ（道徳・総合等、複数教員で担当する教科用） */
export type TeacherGroup = {
  readonly id: string
  readonly name: string
  readonly teacher_ids: readonly string[]
  readonly subjects: readonly string[]
  readonly target_grades: readonly number[]
}

/** 合同クラス */
export type ClassGroup = {
  readonly id: string
  readonly grade: number
  readonly class_names: readonly string[]
  readonly split_subjects: readonly string[]
}

/** 施設 */
export type Facility = {
  readonly id: string
  readonly name: string
  readonly capacity: number
}
