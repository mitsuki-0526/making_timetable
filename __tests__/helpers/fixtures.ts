import type {
  Teacher,
  TeacherGroup,
  TimetableEntry,
  SchoolStructure,
  GradeConfig,
  ClassInfo,
  Settings,
  MappingRule,
  FixedSlot,
  SubjectPairing,
  ClassGroup,
  Facility,
  TeacherConstraintSettings,
  SubjectPlacement,
  CellGroup,
  Day,
} from '@/types'

let idCounter = 0
function nextId(prefix = 'id'): string {
  idCounter++
  return `${prefix}_${idCounter}`
}

/** テスト間でIDカウンタをリセット */
export function resetIdCounter(): void {
  idCounter = 0
}

/** 教員ファクトリ */
export function createTeacher(overrides: Partial<Teacher> = {}): Teacher {
  return {
    id: nextId('teacher'),
    name: '山田太郎',
    subjects: ['数学'],
    target_grades: [1],
    unavailable_times: [],
    employment_type: 'full_time',
    available_days: null,
    min_hours: null,
    max_hours: null,
    contract_end_date: null,
    is_homeroom: false,
    homeroom_class: null,
    ...overrides,
  }
}

/** 時間割エントリファクトリ */
export function createEntry(overrides: Partial<TimetableEntry> = {}): TimetableEntry {
  return {
    day_of_week: '月',
    period: 1,
    grade: 1,
    class_name: '1組',
    subject: null,
    teacher_id: null,
    alt_subject: null,
    alt_teacher_id: null,
    teacher_group_id: null,
    cell_group_id: null,
    is_locked: false,
    ...overrides,
  }
}

/** クラス情報ファクトリ */
export function createClassInfo(overrides: Partial<ClassInfo> = {}): ClassInfo {
  return {
    name: '1組',
    is_special_needs: false,
    ...overrides,
  }
}

/** 学年設定ファクトリ */
export function createGradeConfig(overrides: Partial<GradeConfig> = {}): GradeConfig {
  return {
    grade: 1,
    classes: [
      createClassInfo({ name: '1組' }),
      createClassInfo({ name: '2組' }),
    ],
    required_hours: { 数学: 4, 国語: 4, 英語: 4 },
    ...overrides,
  }
}

/** 学校構造ファクトリ */
export function createStructure(overrides: Partial<SchoolStructure> = {}): SchoolStructure {
  return {
    grades: [
      createGradeConfig({ grade: 1 }),
    ],
    ...overrides,
  }
}

/** 設定ファクトリ */
export function createSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    mapping_rules: [],
    lunch_after_period: 4,
    ...overrides,
  }
}

/** マッピングルールファクトリ */
export function createMappingRule(overrides: Partial<MappingRule> = {}): MappingRule {
  return {
    grade: 1,
    from_subject: '国語',
    to_subject: '自立活動',
    ...overrides,
  }
}

/** 固定コマファクトリ */
export function createFixedSlot(overrides: Partial<FixedSlot> = {}): FixedSlot {
  return {
    id: nextId('fixed'),
    scope: 'school',
    grade: null,
    class_name: null,
    day_of_week: '月',
    period: 1,
    subject: '朝礼',
    teacher_id: null,
    ...overrides,
  }
}

/** 抱き合わせ教科ファクトリ */
export function createSubjectPairing(overrides: Partial<SubjectPairing> = {}): SubjectPairing {
  return {
    id: nextId('pairing'),
    grade: 1,
    class_a: '1組',
    subject_a: '技術',
    class_b: '2組',
    subject_b: '家庭科',
    ...overrides,
  }
}

/** 合同クラスファクトリ */
export function createClassGroup(overrides: Partial<ClassGroup> = {}): ClassGroup {
  return {
    id: nextId('cg'),
    grade: 1,
    class_names: ['1組', '2組'],
    split_subjects: [],
    ...overrides,
  }
}

/** 施設ファクトリ */
export function createFacility(overrides: Partial<Facility> = {}): Facility {
  return {
    id: nextId('fac'),
    name: '体育館',
    capacity: 1,
    ...overrides,
  }
}

/** 教員グループファクトリ */
export function createTeacherGroup(overrides: Partial<TeacherGroup> = {}): TeacherGroup {
  return {
    id: nextId('tg'),
    name: '1年道徳',
    teacher_ids: [],
    subjects: ['道徳'],
    target_grades: [1],
    ...overrides,
  }
}

/** 教員制約設定ファクトリ */
export function createTeacherConstraintSettings(
  overrides: Partial<TeacherConstraintSettings> = {},
): TeacherConstraintSettings {
  return {
    max_daily_periods: null,
    max_daily_hardness: 'soft',
    max_consecutive_periods: null,
    max_consecutive_hardness: 'soft',
    max_weekly_periods: null,
    max_weekly_hardness: 'soft',
    ...overrides,
  }
}

/** 教科配置制約ファクトリ */
export function createSubjectPlacement(overrides: Partial<SubjectPlacement> = {}): SubjectPlacement {
  return {
    subject: '数学',
    allowed_periods: null,
    allowed_periods_hardness: 'soft',
    max_consecutive_days: null,
    max_consecutive_days_hardness: 'soft',
    max_afternoon_daily: null,
    max_afternoon_daily_hardness: 'soft',
    allow_double_period: false,
    ...overrides,
  }
}

/** 合同コマグループファクトリ */
export function createCellGroup(overrides: Partial<CellGroup> = {}): CellGroup {
  return {
    id: nextId('cellgroup'),
    cell_keys: [],
    ...overrides,
  }
}

/**
 * 標準的な3学年・各2クラス+特支の学校構造を生成
 */
export function createStandardSchool(): {
  structure: SchoolStructure
  teachers: Teacher[]
} {
  const structure: SchoolStructure = {
    grades: [1, 2, 3].map((grade) => ({
      grade,
      classes: [
        { name: '1組', is_special_needs: false },
        { name: '2組', is_special_needs: false },
        { name: '特支A', is_special_needs: true },
      ],
      required_hours: { 数学: 4, 国語: 4, 英語: 4, 理科: 3, 社会: 3 },
    })),
  }

  const teachers: Teacher[] = [
    createTeacher({ id: 't1', name: '鈴木', subjects: ['数学'], target_grades: [1, 2, 3] }),
    createTeacher({ id: 't2', name: '田中', subjects: ['国語'], target_grades: [1, 2, 3] }),
    createTeacher({ id: 't3', name: '佐藤', subjects: ['英語'], target_grades: [1, 2, 3] }),
    createTeacher({ id: 't4', name: '高橋', subjects: ['理科'], target_grades: [1, 2, 3] }),
    createTeacher({ id: 't5', name: '渡辺', subjects: ['社会'], target_grades: [1, 2, 3] }),
    createTeacher({ id: 't6', name: '伊藤', subjects: ['数学', '理科'], target_grades: [1, 2] }),
  ]

  return { structure, teachers }
}
