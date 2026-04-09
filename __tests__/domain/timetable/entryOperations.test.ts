import { describe, it, expect, beforeEach } from 'vitest'
import { applyTimetableEntry } from '@/domain/timetable/entryOperations'
import {
  resetIdCounter,
  createTeacher,
  createEntry,
  createSettings,
  createMappingRule,
  createSubjectPairing,
} from '../../helpers/fixtures'
import type { Teacher, TimetableEntry, Settings, SchoolStructure, SubjectPairing, TeacherGroup, ClassGroup } from '@/types'

let teachers: Teacher[]
let timetable: TimetableEntry[]
let settings: Settings
let structure: SchoolStructure
let pairings: SubjectPairing[]
let teacherGroups: TeacherGroup[]
let classGroups: ClassGroup[]

beforeEach(() => {
  resetIdCounter()

  teachers = [
    createTeacher({ id: 't1', name: '鈴木', subjects: ['数学', '国語'], target_grades: [1] }),
    createTeacher({ id: 't2', name: '田中', subjects: ['国語'], target_grades: [1] }),
  ]

  structure = {
    grades: [{
      grade: 1,
      classes: [
        { name: '1組', is_special_needs: false },
        { name: '2組', is_special_needs: false },
        { name: '特支A', is_special_needs: true },
      ],
      required_hours: { 数学: 4, 国語: 4 },
    }],
  }

  settings = createSettings({
    mapping_rules: [
      createMappingRule({ grade: 1, from_subject: '国語', to_subject: '自立活動' }),
    ],
  })

  pairings = []
  timetable = []
  teacherGroups = []
  classGroups = []
})

describe('applyTimetableEntry', () => {
  it('コマ配置で特支マッピングが連鎖実行されること', () => {
    const result = applyTimetableEntry({
      timetable,
      teachers,
      structure,
      settings,
      pairings,
      teacherGroups,
      classGroups,
      target: { day_of_week: '月', period: 1, grade: 1, class_name: '1組' },
      subject: '国語',
      teacherId: null,
    })

    // 1組に国語が配置される
    const mainEntry = result.find((e) => e.class_name === '1組' && e.day_of_week === '月' && e.period === 1)
    expect(mainEntry!.subject).toBe('国語')

    // 特支Aに自立活動が連動配置される
    const specialEntry = result.find((e) => e.class_name === '特支A' && e.day_of_week === '月' && e.period === 1)
    expect(specialEntry!.subject).toBe('自立活動')
  })

  it('コマ配置で抱き合わせ教科が連鎖実行されること', () => {
    pairings = [
      createSubjectPairing({
        grade: 1, class_a: '1組', subject_a: '技術',
        class_b: '2組', subject_b: '家庭科',
      }),
    ]
    teachers = [
      createTeacher({ id: 't1', subjects: ['技術'], target_grades: [1] }),
      createTeacher({ id: 't2', subjects: ['家庭科'], target_grades: [1] }),
    ]

    const result = applyTimetableEntry({
      timetable,
      teachers,
      structure,
      settings,
      pairings,
      teacherGroups,
      classGroups,
      target: { day_of_week: '月', period: 1, grade: 1, class_name: '1組' },
      subject: '技術',
      teacherId: null,
    })

    const paired = result.find((e) => e.class_name === '2組' && e.day_of_week === '月' && e.period === 1)
    expect(paired!.subject).toBe('家庭科')
  })

  it('cell_group_idが保持されること', () => {
    timetable = [
      createEntry({
        day_of_week: '月', period: 1, grade: 1, class_name: '1組',
        subject: '数学', cell_group_id: 'g1',
      }),
    ]
    const result = applyTimetableEntry({
      timetable,
      teachers,
      structure,
      settings,
      pairings,
      teacherGroups,
      classGroups,
      target: { day_of_week: '月', period: 1, grade: 1, class_name: '1組' },
      subject: '国語',
      teacherId: null,
    })

    const entry = result.find((e) => e.class_name === '1組' && e.day_of_week === '月' && e.period === 1)
    expect(entry!.cell_group_id).toBe('g1')
  })

  it('教員自動割り当てが実行されること', () => {
    const result = applyTimetableEntry({
      timetable,
      teachers,
      structure,
      settings,
      pairings,
      teacherGroups,
      classGroups,
      target: { day_of_week: '月', period: 1, grade: 1, class_name: '1組' },
      subject: '数学',
      teacherId: null,
    })

    const entry = result.find((e) => e.class_name === '1組' && e.day_of_week === '月' && e.period === 1)
    // t1が数学を担当できる
    expect(entry!.teacher_id).toBe('t1')
  })

  it('teacherIdを明示指定した場合はそれが使われること', () => {
    const result = applyTimetableEntry({
      timetable,
      teachers,
      structure,
      settings,
      pairings,
      teacherGroups,
      classGroups,
      target: { day_of_week: '月', period: 1, grade: 1, class_name: '1組' },
      subject: '国語',
      teacherId: 't2',
    })

    const entry = result.find((e) => e.class_name === '1組' && e.day_of_week === '月' && e.period === 1)
    expect(entry!.teacher_id).toBe('t2')
  })

  it('教科クリア時に関連エントリも適切にクリアされること', () => {
    timetable = [
      createEntry({ day_of_week: '月', period: 1, grade: 1, class_name: '1組', subject: '国語', teacher_id: 't1' }),
      createEntry({ day_of_week: '月', period: 1, grade: 1, class_name: '特支A', subject: '自立活動' }),
    ]
    const result = applyTimetableEntry({
      timetable,
      teachers,
      structure,
      settings,
      pairings,
      teacherGroups,
      classGroups,
      target: { day_of_week: '月', period: 1, grade: 1, class_name: '1組' },
      subject: null,
      teacherId: null,
    })

    const mainEntry = result.find((e) => e.class_name === '1組' && e.day_of_week === '月' && e.period === 1)
    expect(mainEntry!.subject).toBeNull()

    const specialEntry = result.find((e) => e.class_name === '特支A' && e.day_of_week === '月' && e.period === 1)
    if (specialEntry) {
      expect(specialEntry.subject).toBeNull()
    }
  })
})
