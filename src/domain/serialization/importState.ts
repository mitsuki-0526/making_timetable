import type { SerializableState } from './exportState'

const SUPPORTED_VERSIONS = [2]

export type ImportResult =
  | { readonly success: true; readonly data: SerializableState }
  | { readonly success: false; readonly error: string }

/** 必須フィールド一覧 */
const REQUIRED_FIELDS: (keyof SerializableState)[] = [
  'teachers', 'teacher_groups', 'timetable', 'structure', 'settings',
  'cell_groups', 'fixed_slots', 'subject_constraints', 'subject_placements',
  'subject_pairings', 'class_groups', 'facilities', 'subject_facilities',
  'teacher_constraints', 'alt_week_pairs', 'subject_sequences', 'cross_grade_groups',
]

/**
 * JSONオブジェクトからストア状態を復元する。
 * バリデーション付き。不正なデータは拒否する。
 */
export function importState(json: unknown): ImportResult {
  if (typeof json !== 'object' || json === null) {
    return { success: false, error: 'JSONオブジェクトではありません' }
  }

  const obj = json as Record<string, unknown>

  // バージョンチェック
  if (!('version' in obj) || typeof obj.version !== 'number') {
    return { success: false, error: 'versionフィールドがありません' }
  }
  if (!SUPPORTED_VERSIONS.includes(obj.version)) {
    return { success: false, error: `未対応のバージョンです: ${obj.version}（対応: ${SUPPORTED_VERSIONS.join(', ')}）` }
  }

  // 必須フィールドチェック
  for (const field of REQUIRED_FIELDS) {
    if (!(field in obj)) {
      return { success: false, error: `必須フィールドがありません: ${field}` }
    }
  }

  // 基本的な型チェック
  if (!Array.isArray(obj.teachers)) {
    return { success: false, error: 'teachersは配列である必要があります' }
  }
  if (!Array.isArray(obj.timetable)) {
    return { success: false, error: 'timetableは配列である必要があります' }
  }
  if (typeof obj.structure !== 'object' || obj.structure === null) {
    return { success: false, error: 'structureはオブジェクトである必要があります' }
  }

  // 型アサーション（詳細なバリデーションは将来Zodで強化）
  const data: SerializableState = {
    teachers: obj.teachers as SerializableState['teachers'],
    teacher_groups: obj.teacher_groups as SerializableState['teacher_groups'],
    timetable: obj.timetable as SerializableState['timetable'],
    structure: obj.structure as SerializableState['structure'],
    settings: obj.settings as SerializableState['settings'],
    cell_groups: obj.cell_groups as SerializableState['cell_groups'],
    fixed_slots: obj.fixed_slots as SerializableState['fixed_slots'],
    subject_constraints: obj.subject_constraints as SerializableState['subject_constraints'],
    subject_placements: obj.subject_placements as SerializableState['subject_placements'],
    subject_pairings: obj.subject_pairings as SerializableState['subject_pairings'],
    class_groups: obj.class_groups as SerializableState['class_groups'],
    facilities: obj.facilities as SerializableState['facilities'],
    subject_facilities: obj.subject_facilities as SerializableState['subject_facilities'],
    teacher_constraints: obj.teacher_constraints as SerializableState['teacher_constraints'],
    alt_week_pairs: obj.alt_week_pairs as SerializableState['alt_week_pairs'],
    subject_sequences: obj.subject_sequences as SerializableState['subject_sequences'],
    cross_grade_groups: obj.cross_grade_groups as SerializableState['cross_grade_groups'],
  }

  return { success: true, data }
}
