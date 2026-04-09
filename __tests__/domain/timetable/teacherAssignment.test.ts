import { describe, it, expect, beforeEach } from 'vitest'
import {
  getAvailableTeachers,
  autoAssignTeacher,
} from '@/domain/timetable/teacherAssignment'
import {
  resetIdCounter,
  createTeacher,
  createEntry,
  createTeacherGroup,
  createClassGroup,
} from '../../helpers/fixtures'
import type { Teacher, TimetableEntry, TeacherGroup, ClassGroup } from '@/types'

let teachers: Teacher[]
let timetable: TimetableEntry[]
let teacherGroups: TeacherGroup[]
let classGroups: ClassGroup[]

beforeEach(() => {
  resetIdCounter()
  teachers = [
    createTeacher({ id: 't1', name: '鈴木', subjects: ['数学'], target_grades: [1, 2] }),
    createTeacher({ id: 't2', name: '田中', subjects: ['国語'], target_grades: [1] }),
    createTeacher({ id: 't3', name: '佐藤', subjects: ['数学', '英語'], target_grades: [1, 2, 3] }),
  ]
  timetable = []
  teacherGroups = []
  classGroups = []
})

describe('getAvailableTeachers', () => {
  it('担当教科でフィルタされること', () => {
    const result = getAvailableTeachers({
      teachers,
      timetable,
      teacherGroups,
      classGroups,
      slot: { day_of_week: '月', period: 1, grade: 1, class_name: '1組' },
      subject: '数学',
    })
    // 数学を担当できるのはt1（鈴木）とt3（佐藤）
    expect(result.map((t) => t.id)).toEqual(expect.arrayContaining(['t1', 't3']))
    expect(result.map((t) => t.id)).not.toContain('t2')
  })

  it('担当学年でフィルタされること', () => {
    const result = getAvailableTeachers({
      teachers,
      timetable,
      teacherGroups,
      classGroups,
      slot: { day_of_week: '月', period: 1, grade: 3, class_name: '1組' },
      subject: '数学',
    })
    // 3年を担当できるのはt3（佐藤）のみ
    expect(result.map((t) => t.id)).toEqual(['t3'])
  })

  it('配置不可時間の教員が除外されること', () => {
    teachers = [
      createTeacher({
        id: 't1', name: '鈴木', subjects: ['数学'], target_grades: [1],
        unavailable_times: [{ day: '月', period: 1 }],
      }),
      createTeacher({ id: 't3', name: '佐藤', subjects: ['数学'], target_grades: [1] }),
    ]
    const result = getAvailableTeachers({
      teachers,
      timetable,
      teacherGroups,
      classGroups,
      slot: { day_of_week: '月', period: 1, grade: 1, class_name: '1組' },
      subject: '数学',
    })
    expect(result.map((t) => t.id)).toEqual(['t3'])
  })

  it('非常勤教員が出勤不可曜日に除外されること', () => {
    teachers = [
      createTeacher({
        id: 't1', name: '鈴木', subjects: ['数学'], target_grades: [1],
        employment_type: 'part_time',
        available_days: ['火', '水', '木'],
      }),
      createTeacher({ id: 't3', name: '佐藤', subjects: ['数学'], target_grades: [1] }),
    ]
    const result = getAvailableTeachers({
      teachers,
      timetable,
      teacherGroups,
      classGroups,
      slot: { day_of_week: '月', period: 1, grade: 1, class_name: '1組' },
      subject: '数学',
    })
    // t1は月曜出勤不可
    expect(result.map((t) => t.id)).toEqual(['t3'])
  })

  it('同日同時限に他クラス配置済みの教員が除外されること', () => {
    timetable = [
      createEntry({ day_of_week: '月', period: 1, grade: 1, class_name: '2組', subject: '数学', teacher_id: 't1' }),
    ]
    const result = getAvailableTeachers({
      teachers,
      timetable,
      teacherGroups,
      classGroups,
      slot: { day_of_week: '月', period: 1, grade: 1, class_name: '1組' },
      subject: '数学',
    })
    // t1は月曜1限に2組で配置済み
    expect(result.map((t) => t.id)).not.toContain('t1')
    expect(result.map((t) => t.id)).toContain('t3')
  })

  it('教科を指定しない場合は全教員（学年+時間フィルタのみ）を返す', () => {
    const result = getAvailableTeachers({
      teachers,
      timetable,
      teacherGroups,
      classGroups,
      slot: { day_of_week: '月', period: 1, grade: 1, class_name: '1組' },
      subject: null,
    })
    // 1年担当のt1, t2, t3
    expect(result).toHaveLength(3)
  })
})

describe('autoAssignTeacher', () => {
  it('複数候補時にコマ数少ない順で選択されること', () => {
    // t1は既に2コマ配置済み、t3は0コマ
    timetable = [
      createEntry({ day_of_week: '月', period: 2, grade: 1, class_name: '1組', subject: '数学', teacher_id: 't1' }),
      createEntry({ day_of_week: '火', period: 1, grade: 1, class_name: '1組', subject: '数学', teacher_id: 't1' }),
    ]
    const result = autoAssignTeacher({
      teachers,
      timetable,
      teacherGroups,
      classGroups,
      slot: { day_of_week: '水', period: 1, grade: 1, class_name: '1組' },
      subject: '数学',
    })
    // t3のほうがコマ数少ないのでt3が選ばれる
    expect(result).toBe('t3')
  })

  it('候補がゼロの場合にnullを返すこと', () => {
    const result = autoAssignTeacher({
      teachers,
      timetable,
      teacherGroups,
      classGroups,
      slot: { day_of_week: '月', period: 1, grade: 1, class_name: '1組' },
      subject: '美術', // 美術を担当できる教員がいない
    })
    expect(result).toBeNull()
  })

  it('全候補が配置済みの場合にnullを返すこと', () => {
    teachers = [
      createTeacher({ id: 't1', name: '鈴木', subjects: ['数学'], target_grades: [1] }),
    ]
    timetable = [
      createEntry({ day_of_week: '月', period: 1, grade: 1, class_name: '2組', subject: '数学', teacher_id: 't1' }),
    ]
    const result = autoAssignTeacher({
      teachers,
      timetable,
      teacherGroups,
      classGroups,
      slot: { day_of_week: '月', period: 1, grade: 1, class_name: '1組' },
      subject: '数学',
    })
    expect(result).toBeNull()
  })
})
