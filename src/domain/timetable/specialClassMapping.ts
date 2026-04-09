import type { TimetableEntry, SchoolStructure, Settings, CellPosition } from '@/types'

export type SpecialClassMappingInput = {
  readonly timetable: readonly TimetableEntry[]
  readonly structure: SchoolStructure
  readonly settings: Settings
  readonly target: CellPosition
  readonly subject: string | null
}

/**
 * 通常学級のコマ配置時に、特支クラスへの自動連動エントリを生成する。
 *
 * - 単方向: 通常学級 → 特支学級のみ
 * - 特支クラスからの操作は連動しない
 * - ロック(is_locked)されたコマは変更しない
 * - ルール未設定の教科は連動しない
 * - subjectがnullの場合（クリア）は、ロックされていない特支エントリもクリア
 *
 * 返り値: 追加・更新されるエントリの配列（既存timetableは変更しない）
 */
export function applySpecialClassMapping(input: SpecialClassMappingInput): TimetableEntry[] {
  const { timetable, structure, settings, target, subject } = input

  // 特支クラスからの操作は連動しない
  const gradeConfig = structure.grades.find((g) => g.grade === target.grade)
  if (!gradeConfig) return []

  const sourceClass = gradeConfig.classes.find((c) => c.name === target.class_name)
  if (!sourceClass || sourceClass.is_special_needs) return []

  // 同学年の特支クラスを取得
  const specialClasses = gradeConfig.classes.filter((c) => c.is_special_needs)
  if (specialClasses.length === 0) return []

  // 教科クリアの場合
  if (subject === null) {
    return specialClasses.flatMap((sc) => {
      const existing = timetable.find(
        (e) =>
          e.grade === target.grade &&
          e.class_name === sc.name &&
          e.day_of_week === target.day_of_week &&
          e.period === target.period,
      )
      // ロック済みならスキップ
      if (!existing || existing.is_locked) return []
      // 教科をクリア
      return [{
        ...existing,
        subject: null,
        teacher_id: null,
      }]
    })
  }

  // マッピングルールを検索
  const rule = settings.mapping_rules.find(
    (r) => r.grade === target.grade && r.from_subject === subject,
  )
  // ルール未設定の教科は連動しない
  if (!rule) return []

  return specialClasses.flatMap((sc) => {
    const existing = timetable.find(
      (e) =>
        e.grade === target.grade &&
        e.class_name === sc.name &&
        e.day_of_week === target.day_of_week &&
        e.period === target.period,
    )

    // ロック済みならスキップ
    if (existing?.is_locked) {
      return [existing]
    }

    // 既存エントリがあれば更新、なければ新規作成
    const baseEntry: TimetableEntry = existing ?? {
      day_of_week: target.day_of_week,
      period: target.period,
      grade: target.grade,
      class_name: sc.name,
      subject: null,
      teacher_id: null,
      alt_subject: null,
      alt_teacher_id: null,
      teacher_group_id: null,
      cell_group_id: null,
      is_locked: false,
    }

    return [{
      ...baseEntry,
      subject: rule.to_subject,
    }]
  })
}
