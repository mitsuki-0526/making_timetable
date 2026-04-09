import type { TimetableEntry, SubjectPairing, CellPosition } from '@/types'

export type SubjectPairingInput = {
  readonly timetable: readonly TimetableEntry[]
  readonly pairings: readonly SubjectPairing[]
  readonly target: CellPosition
  readonly subject: string | null
}

/**
 * 抱き合わせ教科の自動配置を適用する。
 *
 * - 双方向: A→BでもB→Aでも動作
 * - 同一学年内のクラス間のみ
 * - subjectがnullの場合（クリア）は、ペア先もクリア
 *
 * 返り値: 追加・更新されるエントリの配列
 */
export function applySubjectPairing(input: SubjectPairingInput): TimetableEntry[] {
  const { timetable, pairings, target, subject } = input
  const results: TimetableEntry[] = []

  for (const pairing of pairings) {
    if (pairing.grade !== target.grade) continue

    let targetClassName: string | null = null
    let targetSubject: string | null = null

    // A方向: class_aのsubject_a → class_bにsubject_b
    if (pairing.class_a === target.class_name && (subject === pairing.subject_a || subject === null)) {
      targetClassName = pairing.class_b
      targetSubject = subject === null ? null : pairing.subject_b
    }
    // B方向: class_bのsubject_b → class_aにsubject_a
    else if (pairing.class_b === target.class_name && (subject === pairing.subject_b || subject === null)) {
      targetClassName = pairing.class_a
      targetSubject = subject === null ? null : pairing.subject_a
    }

    if (targetClassName === null) continue

    // クリアの場合: ペア先に対応する教科があるか確認
    if (subject === null) {
      const existing = timetable.find(
        (e) =>
          e.grade === target.grade &&
          e.class_name === targetClassName &&
          e.day_of_week === target.day_of_week &&
          e.period === target.period &&
          (e.subject === pairing.subject_a || e.subject === pairing.subject_b),
      )
      if (existing) {
        results.push({ ...existing, subject: null, teacher_id: null })
      }
      continue
    }

    // 配置の場合
    const existing = timetable.find(
      (e) =>
        e.grade === target.grade &&
        e.class_name === targetClassName &&
        e.day_of_week === target.day_of_week &&
        e.period === target.period,
    )

    const baseEntry: TimetableEntry = existing ?? {
      day_of_week: target.day_of_week,
      period: target.period,
      grade: target.grade,
      class_name: targetClassName,
      subject: null,
      teacher_id: null,
      alt_subject: null,
      alt_teacher_id: null,
      teacher_group_id: null,
      cell_group_id: null,
      is_locked: false,
    }

    results.push({ ...baseEntry, subject: targetSubject })
  }

  return results
}
