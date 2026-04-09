import type { Day } from './timetable'

/** 制約の硬さ */
export type ConstraintHardness = 'hard' | 'soft'

/** 固定コマのスコープ */
export type FixedSlotScope = 'school' | 'grade' | 'class'

/** 固定コマ */
export type FixedSlot = {
  readonly id: string
  readonly scope: FixedSlotScope
  readonly grade: number | null
  readonly class_name: string | null
  readonly day_of_week: Day
  readonly period: number
  readonly subject: string
  readonly teacher_id: string | null
}

/** 教員制約 */
export type TeacherConstraintSettings = {
  readonly max_daily_periods: number | null
  readonly max_daily_hardness: ConstraintHardness
  readonly max_consecutive_periods: number | null
  readonly max_consecutive_hardness: ConstraintHardness
  readonly max_weekly_periods: number | null
  readonly max_weekly_hardness: ConstraintHardness
}

/** 教科配置制約 */
export type SubjectPlacement = {
  readonly subject: string
  readonly allowed_periods: readonly number[] | null
  readonly allowed_periods_hardness: ConstraintHardness
  readonly max_consecutive_days: number | null
  readonly max_consecutive_days_hardness: ConstraintHardness
  readonly max_afternoon_daily: number | null
  readonly max_afternoon_daily_hardness: ConstraintHardness
  readonly allow_double_period: boolean
}

/** 教科別連続授業日数制約 */
export type SubjectConstraint = {
  readonly subject: string
  readonly max_consecutive_days: number
  readonly hardness: ConstraintHardness
}

/** 隔週授業ペア */
export type AltWeekPair = {
  readonly id: string
  readonly grade: number
  readonly class_name: string
  readonly day_of_week: Day
  readonly period: number
  readonly subject_a: string
  readonly teacher_id_a: string | null
  readonly subject_b: string
  readonly teacher_id_b: string | null
}

/** 連続配置ペア */
export type SubjectSequence = {
  readonly id: string
  readonly grade: number
  readonly class_name: string
  readonly subject_a: string
  readonly subject_b: string
}

/** 教科↔施設マッピング */
export type SubjectFacility = {
  readonly subject: string
  readonly facility_id: string
}

/** 抱き合わせ教科 */
export type SubjectPairing = {
  readonly id: string
  readonly grade: number
  readonly class_a: string
  readonly subject_a: string
  readonly class_b: string
  readonly subject_b: string
}

/** 複数学年合同授業 */
export type CrossGradeGroup = {
  readonly id: string
  readonly name: string
  readonly subject: string
  readonly periods_per_week: number
  readonly participants: readonly { readonly grade: number; readonly class_names: readonly string[] }[]
}

/** 特支連動マッピングルール */
export type MappingRule = {
  readonly grade: number
  readonly from_subject: string
  readonly to_subject: string
}

/** 設定 */
export type Settings = {
  readonly mapping_rules: readonly MappingRule[]
  readonly lunch_after_period: number
}
