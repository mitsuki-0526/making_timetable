/**
 * 旧版(v1) JSON → 新版(v2) JSON 変換ユーティリティ
 *
 * 旧版のデータ構造:
 * - structure.grades[].classes: string[] (クラス名だけの配列)
 * - structure.grades[].special_classes: string[]
 * - structure.required_hours: {"1_通常": {...}, "1_特支": {...}}
 * - settings.mappingRules: {"1": {"国語": "自立活動"}} (学年→教科マッピング)
 * - teacher: employment_type等のフィールドが存在しない
 * - subject_constraints: {"国語": {max_consecutive_days: null}} (オブジェクト形式)
 * - fixed_slots[].scope: "all" | "grade" | "class"
 *
 * 新版のデータ構造:
 * - structure.grades[].classes: ClassInfo[] ({name, is_special_needs})
 * - structure.grades[].required_hours: Record<string, number>
 * - settings.mapping_rules: MappingRule[] ({grade, from_subject, to_subject})
 * - teacher: 全フィールド完備（employment_type, available_days等）
 * - subject_constraints: SubjectConstraint[] ({subject, max_consecutive_days, hardness})
 * - fixed_slots[].scope: "school" | "grade" | "class"
 */

import type { SerializableState } from './exportState'
import type {
  Teacher, TimetableEntry, FixedSlot, MappingRule,
  SubjectConstraint, Settings,
} from '@/types'

type V1Teacher = {
  id: string
  name: string
  subjects: string[]
  target_grades: number[]
  unavailable_times: { day_of_week: string; period: number }[]
  employment_type?: string
  available_days?: string[] | null
  min_hours?: number | null
  max_hours?: number | null
  is_homeroom?: boolean
  homeroom_class?: { grade: number; class_name: string } | null
}

type V1Structure = {
  grades: {
    grade: number
    classes: string[]
    special_classes: string[]
  }[]
  required_hours: Record<string, Record<string, number>>
}

type V1FixedSlot = {
  id: string
  scope: 'all' | 'grade' | 'class'
  grade: number | null
  class_name: string | null
  day_of_week: string
  period: number
  subject: string
  teacher_id?: string | null
}

type V1Settings = {
  mappingRules: Record<string, Record<string, string>>
  lunch_after_period: number
}

type V1Data = {
  teachers: V1Teacher[]
  teacher_groups: unknown[]
  structure: V1Structure
  timetable: unknown[]
  subject_constraints: Record<string, { max_consecutive_days: number | null }>
  subject_pairings: unknown[]
  cell_groups: unknown[]
  fixed_slots: V1FixedSlot[]
  teacher_constraints: Record<string, unknown>
  subject_placement: Record<string, unknown>
  facilities: unknown[]
  subject_facility: Record<string, string | null>
  alt_week_pairs: unknown[]
  subject_sequences: unknown[]
  cross_grade_groups: unknown[]
  class_groups: unknown[]
  settings: V1Settings
}

export type ConvertResult =
  | { success: true; data: SerializableState }
  | { success: false; error: string }

export function convertV1toV2(json: unknown): ConvertResult {
  if (typeof json !== 'object' || json === null) {
    return { success: false, error: 'JSONオブジェクトではありません' }
  }

  const v1 = json as Partial<V1Data>

  // 最低限のフィールドチェック
  if (!v1.structure || !v1.teachers) {
    return { success: false, error: 'structure または teachers フィールドがありません' }
  }

  try {
    // 学校構造の変換
    const grades = v1.structure.grades.map((g) => {
      const normalClasses = (g.classes ?? []).map((name) => ({
        name,
        is_special_needs: false as const,
      }))
      const specialClasses = (g.special_classes ?? []).map((name) => ({
        name,
        is_special_needs: true as const,
      }))

      // 規定時数: "1_通常" → 通常クラス用
      const reqKey = `${g.grade}_通常`
      const requiredHours = v1.structure!.required_hours?.[reqKey] ?? {}

      return {
        grade: g.grade,
        classes: [...normalClasses, ...specialClasses],
        required_hours: requiredHours,
      }
    })

    // 教員の変換
    const teachers: Teacher[] = v1.teachers.map((t) => ({
      id: t.id,
      name: t.name,
      subjects: t.subjects ?? [],
      target_grades: t.target_grades ?? [],
      unavailable_times: (t.unavailable_times ?? []).map((u) => ({
        day: u.day_of_week as Teacher['unavailable_times'][0]['day'],
        period: u.period,
      })),
      employment_type: (t.employment_type as Teacher['employment_type']) ?? 'full_time',
      available_days: t.available_days ?? null,
      min_hours: t.min_hours ?? null,
      max_hours: t.max_hours ?? null,
      contract_end_date: null,
      is_homeroom: t.is_homeroom ?? false,
      homeroom_class: t.homeroom_class ?? null,
    }))

    // 特支連動ルールの変換
    const mappingRules: MappingRule[] = []
    if (v1.settings?.mappingRules) {
      for (const [gradeStr, mappings] of Object.entries(v1.settings.mappingRules)) {
        const grade = Number(gradeStr)
        for (const [fromSubject, toSubject] of Object.entries(mappings)) {
          mappingRules.push({ grade, from_subject: fromSubject, to_subject: toSubject })
        }
      }
    }

    const settings: Settings = {
      mapping_rules: mappingRules,
      lunch_after_period: v1.settings?.lunch_after_period ?? 4,
    }

    // 固定コマの変換
    const fixedSlots: FixedSlot[] = (v1.fixed_slots ?? []).map((f) => ({
      id: f.id,
      scope: f.scope === 'all' ? 'school' as const : f.scope as 'grade' | 'class',
      grade: f.grade,
      class_name: f.class_name,
      day_of_week: f.day_of_week as FixedSlot['day_of_week'],
      period: f.period,
      subject: f.subject,
      teacher_id: f.teacher_id ?? null,
    }))

    // 教科制約の変換
    const subjectConstraints: SubjectConstraint[] = []
    if (v1.subject_constraints) {
      for (const [subject, constraint] of Object.entries(v1.subject_constraints)) {
        if (constraint.max_consecutive_days !== null) {
          subjectConstraints.push({
            subject,
            max_consecutive_days: constraint.max_consecutive_days,
            hardness: 'soft',
          })
        }
      }
    }

    // timetableの変換（フィールド補完）
    const timetable: TimetableEntry[] = ((v1.timetable ?? []) as Record<string, unknown>[]).map((e) => ({
      day_of_week: (e.day_of_week as string) as TimetableEntry['day_of_week'],
      period: e.period as number,
      grade: e.grade as number,
      class_name: e.class_name as string,
      subject: (e.subject as string) ?? null,
      teacher_id: (e.teacher_id as string) ?? null,
      alt_subject: (e.alt_subject as string) ?? null,
      alt_teacher_id: (e.alt_teacher_id as string) ?? null,
      teacher_group_id: (e.teacher_group_id as string) ?? null,
      cell_group_id: (e.cell_group_id as string) ?? null,
      is_locked: (e.is_locked as boolean) ?? false,
    }))

    const data: SerializableState = {
      teachers,
      teacher_groups: (v1.teacher_groups ?? []) as SerializableState['teacher_groups'],
      timetable,
      structure: { grades },
      settings,
      cell_groups: (v1.cell_groups ?? []) as SerializableState['cell_groups'],
      fixed_slots: fixedSlots,
      subject_constraints: subjectConstraints,
      subject_placements: [],
      subject_pairings: (v1.subject_pairings ?? []) as SerializableState['subject_pairings'],
      class_groups: (v1.class_groups ?? []) as SerializableState['class_groups'],
      facilities: (v1.facilities ?? []) as SerializableState['facilities'],
      subject_facilities: [],
      teacher_constraints: {},
      alt_week_pairs: (v1.alt_week_pairs ?? []) as SerializableState['alt_week_pairs'],
      subject_sequences: (v1.subject_sequences ?? []) as SerializableState['subject_sequences'],
      cross_grade_groups: (v1.cross_grade_groups ?? []) as SerializableState['cross_grade_groups'],
    }

    return { success: true, data }
  } catch (e) {
    return { success: false, error: `変換エラー: ${e instanceof Error ? e.message : '不明'}` }
  }
}
