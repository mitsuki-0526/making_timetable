import type { Teacher, TeacherGroup, ClassGroup, TimetableEntry, CellPosition } from '@/types'

export type TeacherAssignmentInput = {
  readonly teachers: readonly Teacher[]
  readonly timetable: readonly TimetableEntry[]
  readonly teacherGroups: readonly TeacherGroup[]
  readonly classGroups: readonly ClassGroup[]
  readonly slot: CellPosition
  readonly subject: string | null
}

/**
 * 指定コマに配置可能な教員リストを返す
 *
 * フィルタ条件:
 * 1. 教科を担当できる（subject指定時）
 * 2. 学年を担当している
 * 3. 配置不可時間に該当しない
 * 4. 非常勤で出勤不可曜日でない
 * 5. 同日同時限に他クラスで配置済みでない
 */
export function getAvailableTeachers(input: TeacherAssignmentInput): Teacher[] {
  const { teachers, timetable, slot, subject } = input

  return teachers.filter((teacher) => {
    // 1. 教科フィルタ
    if (subject !== null && !teacher.subjects.includes(subject)) {
      return false
    }

    // 2. 学年フィルタ
    if (!teacher.target_grades.includes(slot.grade)) {
      return false
    }

    // 3. 配置不可時間フィルタ
    if (teacher.unavailable_times.some(
      (ut) => ut.day === slot.day_of_week && ut.period === slot.period,
    )) {
      return false
    }

    // 4. 非常勤の出勤可能曜日フィルタ
    if (teacher.available_days !== null && !teacher.available_days.includes(slot.day_of_week)) {
      return false
    }

    // 5. 同日同時限の重複配置フィルタ
    const isAlreadyAssigned = timetable.some(
      (entry) =>
        entry.day_of_week === slot.day_of_week &&
        entry.period === slot.period &&
        entry.teacher_id === teacher.id &&
        !(entry.grade === slot.grade && entry.class_name === slot.class_name),
    )
    if (isAlreadyAssigned) {
      return false
    }

    return true
  })
}

/**
 * 教科に最適な教員を自動選択して返す
 * 優先順位: その週のコマ数が少ない教員を優先（ロードバランス）
 * 候補がいない場合はnullを返す
 */
export function autoAssignTeacher(input: TeacherAssignmentInput): string | null {
  const available = getAvailableTeachers(input)
  if (available.length === 0) return null

  const { timetable } = input

  // 各候補のコマ数を集計
  const teacherWithCount = available.map((teacher) => {
    const count = timetable.filter((e) => e.teacher_id === teacher.id).length
    return { teacher, count }
  })

  // コマ数少ない順にソート
  teacherWithCount.sort((a, b) => a.count - b.count)

  return teacherWithCount[0].teacher.id
}
