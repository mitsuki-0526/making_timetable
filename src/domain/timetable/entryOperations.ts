import type {
  TimetableEntry,
  Teacher,
  TeacherGroup,
  ClassGroup,
  SchoolStructure,
  Settings,
  SubjectPairing,
  CellPosition,
} from '@/types'
import { toCellKey } from '@/types'
import { autoAssignTeacher } from './teacherAssignment'
import { applySpecialClassMapping } from './specialClassMapping'
import { applySubjectPairing } from './subjectPairing'

export type ApplyTimetableEntryInput = {
  readonly timetable: readonly TimetableEntry[]
  readonly teachers: readonly Teacher[]
  readonly structure: SchoolStructure
  readonly settings: Settings
  readonly pairings: readonly SubjectPairing[]
  readonly teacherGroups: readonly TeacherGroup[]
  readonly classGroups: readonly ClassGroup[]
  readonly target: CellPosition
  readonly subject: string | null
  readonly teacherId: string | null
}

/**
 * コマを配置し、全副作用（特支マッピング・抱き合わせ・教員自動割当）を適用した
 * 新しいtimetable配列を返す。
 */
export function applyTimetableEntry(input: ApplyTimetableEntryInput): TimetableEntry[] {
  const {
    timetable, teachers, structure, settings, pairings,
    teacherGroups, classGroups, target, subject, teacherId,
  } = input

  const targetKey = toCellKey(target)
  let result = [...timetable]

  // Step 1: 対象セルを更新（cell_group_id を保持）
  const existingIndex = result.findIndex((e) => toCellKey(e) === targetKey)
  const existingEntry = existingIndex >= 0 ? result[existingIndex] : null

  // 教員自動割り当て
  const resolvedTeacherId = teacherId ?? (
    subject !== null
      ? autoAssignTeacher({
          teachers,
          timetable: result,
          teacherGroups,
          classGroups,
          slot: target,
          subject,
        })
      : null
  )

  const newEntry: TimetableEntry = {
    day_of_week: target.day_of_week,
    period: target.period,
    grade: target.grade,
    class_name: target.class_name,
    subject,
    teacher_id: resolvedTeacherId,
    alt_subject: existingEntry?.alt_subject ?? null,
    alt_teacher_id: existingEntry?.alt_teacher_id ?? null,
    teacher_group_id: existingEntry?.teacher_group_id ?? null,
    cell_group_id: existingEntry?.cell_group_id ?? null,
    is_locked: existingEntry?.is_locked ?? false,
  }

  if (existingIndex >= 0) {
    result[existingIndex] = newEntry
  } else {
    result.push(newEntry)
  }

  // Step 2: 特支マッピング
  const mappingResults = applySpecialClassMapping({
    timetable: result,
    structure,
    settings,
    target,
    subject,
  })
  for (const mappedEntry of mappingResults) {
    const key = toCellKey(mappedEntry)
    const idx = result.findIndex((e) => toCellKey(e) === key)
    if (idx >= 0) {
      result[idx] = mappedEntry
    } else {
      result.push(mappedEntry)
    }
  }

  // Step 3: 抱き合わせ教科
  const pairingResults = applySubjectPairing({
    timetable: result,
    pairings,
    target,
    subject,
  })
  for (const pairedEntry of pairingResults) {
    const key = toCellKey(pairedEntry)
    const idx = result.findIndex((e) => toCellKey(e) === key)
    if (idx >= 0) {
      result[idx] = pairedEntry
    } else {
      result.push(pairedEntry)
    }
  }

  return result
}
