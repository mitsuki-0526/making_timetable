// ═══════════════════════════════════════════════════════════
// 時間割作成ツール — ドメインモデル型定義
// ═══════════════════════════════════════════════════════════
// any型は絶対に使用しないこと（biome + tsconfig で禁止済み）

// ── リテラル型 ──────────────────────────────────────────────

/** 曜日 */
export type DayOfWeek = "月" | "火" | "水" | "木" | "金";

/** 時限 */
export type Period = 1 | 2 | 3 | 4 | 5 | 6;

/** 固定コマのスコープ */
export type FixedSlotScope = "all" | "grade" | "class";

// ── 配置不可時間 ────────────────────────────────────────────

export interface UnavailableTime {
  day_of_week: DayOfWeek;
  period: Period;
}

// ── 教員 ────────────────────────────────────────────────────

export interface Teacher {
  id: string;
  name: string;
  subjects: string[];
  target_grades: number[];
  unavailable_times: UnavailableTime[];
}

/** 新規教員の追加データ（id はストアが自動生成） */
export interface TeacherInput {
  name: string;
  subjects: string[];
  target_grades: number[];
  unavailable_times: UnavailableTime[];
}

// ── 教員グループ ────────────────────────────────────────────

export interface TeacherGroup {
  id: string;
  name: string;
  teacher_ids: string[];
  subjects?: string[];
  target_grades?: number[];
}

// ── 学年・クラス構造 ────────────────────────────────────────

export interface GradeStructure {
  grade: number;
  classes: string[];
  special_classes?: string[];
}

export interface SchoolStructure {
  grades: GradeStructure[];
  /** 規定授業時数: キーは主に "学年_通常" 形式 */
  required_hours: Record<string, Record<string, number>>;
}

// ── 時間割エントリ ──────────────────────────────────────────

export interface TimetableEntry {
  day_of_week: DayOfWeek;
  period: Period;
  grade: number;
  class_name: string;
  subject: string;
  teacher_id: string | null;
  /** B週教科（隔週授業用） */
  alt_subject?: string | null;
  /** B週教員（隔週授業用） */
  alt_teacher_id?: string | null;
  /** 教員グループID */
  teacher_group_id?: string | null;
  /** セルグループID（合同コマ） */
  cell_group_id?: string | null;
}

// ── セルの位置情報 ──────────────────────────────────────────

export interface CellPosition {
  grade: number;
  class_name: string;
  day_of_week: DayOfWeek;
  period: Period;
}

// ── セルグループ ────────────────────────────────────────────

export interface CellGroup {
  id: string;
}

// ── 教科制約 ────────────────────────────────────────────────

export interface SubjectConstraint {
  max_consecutive_days: number | null;
}

// ── 教科配置制約 ────────────────────────────────────────────

export interface SubjectPlacement {
  allowed_periods?: Period[];
  allowed_days?: DayOfWeek[];
  max_daily?: number;
  max_afternoon_daily?: number | null;
  afternoon_spread?: boolean;
  spread_days?: boolean;
  requires_double?: boolean;
}

// ── 教員制約 ────────────────────────────────────────────────

export interface TeacherConstraintSettings {
  max_daily?: number;
  max_consecutive?: number;
  max_weekly?: number;
  homeroom_grade?: number;
  homeroom_class?: string;
  consolidate_free?: boolean;
}

// ── 固定コマ ────────────────────────────────────────────────

export interface FixedSlot {
  id: string;
  scope: FixedSlotScope;
  grade?: number;
  class_name?: string;
  day_of_week: DayOfWeek;
  period: Period;
  subject: string;
  label?: string;
}

export interface FixedSlotInput {
  scope: FixedSlotScope;
  grade?: number;
  class_name?: string;
  day_of_week: DayOfWeek;
  period: Period;
  subject: string;
  label?: string;
}

// ── 施設 ────────────────────────────────────────────────────

export interface Facility {
  id: string;
  name: string;
}

// ── 抱き合わせ教科 ──────────────────────────────────────────

export interface SubjectPairing {
  id: string;
  grade: number;
  classA: string;
  subjectA: string;
  classB: string;
  subjectB: string;
}

export interface SubjectPairingInput {
  grade: number;
  classA: string;
  subjectA: string;
  classB: string;
  subjectB: string;
}

// ── 合同クラス ──────────────────────────────────────────────

export interface ClassGroup {
  id: string;
  grade: number;
  classes: string[];
  split_subjects: string[];
}

// ── 隔週授業ペア ────────────────────────────────────────────

export interface AltWeekPair {
  id: string;
  class_key: string;
  subject_a: string;
  subject_b: string;
  count: number;
}

// ── 連続配置ペア ────────────────────────────────────────────

export interface SubjectSequence {
  id: string;
  grade: number;
  class_name: string | null;
  subject_a: string;
  subject_b: string;
}

// ── 複数学年合同授業 ────────────────────────────────────────

export interface CrossGradeParticipant {
  grade: number;
  class_name: string;
}

export interface CrossGradeGroup {
  id: string;
  name: string;
  participants: CrossGradeParticipant[];
  subject: string;
  count: number;
}

export interface CrossGradeGroupInput {
  name?: string;
  participants?: CrossGradeParticipant[];
  subject?: string;
  count?: number;
}

// ── アプリケーション設定 ────────────────────────────────────

export interface AppSettings {
  /** この時限以降が「午後」（例: 4 → 1〜4限が午前、5〜6限が午後） */
  lunch_after_period: number;
}

// ── クラス行設定（表示用） ──────────────────────────────────

export interface ClassRowConfig {
  type: "normal" | "special";
  grade: number;
  class_name: string;
  label: string;
  reqKey?: string;
}

// ── バリデーション違反 ──────────────────────────────────────

export interface FixedSlotViolation {
  label: string;
  grade: number;
  class_name: string;
  day_of_week: DayOfWeek;
  period: Period;
  expected: string;
  actual: string;
}

/** 同一教員が同時刻に複数クラスに割り当てられている */
export interface TeacherTimeConflictViolation {
  teacher_name: string;
  teacher_id: string;
  day: DayOfWeek;
  period: Period;
  grade: number;
  class_name: string;
}

export interface TeacherDailyViolation {
  teacher: string;
  day: DayOfWeek;
  count: number;
  limit: number;
}

export interface TeacherConsecutiveViolation {
  teacher: string;
  day: DayOfWeek;
  maxRun: number;
  limit: number;
}

export interface SubjectPeriodViolation {
  subject: string;
  grade: number;
  class_name: string;
  day: DayOfWeek;
  period: Period;
  allowed: Period[];
}

export interface AfternoonDailyViolation {
  subject: string;
  grade: number;
  class_name: string;
  day: DayOfWeek;
  count: number;
  limit: number;
}

export interface FacilityViolation {
  facility: string;
  day: DayOfWeek;
  period: Period;
  classes: string[];
}

export interface DoublePeriodViolation {
  subject: string;
  grade: number;
  class_name: string;
  day: DayOfWeek;
  count: number;
}

export interface TeacherWeeklyViolation {
  teacher: string;
  count: number;
  limit: number;
}

export interface ConsecutiveDaysViolation {
  grade: number;
  class_name: string;
  subject: string;
  maxConsecutive: number;
  limit: number;
}

// ── ソルバー関連の型 ────────────────────────────────────────

export interface SolverInput {
  teachers: Teacher[];
  teacher_groups: TeacherGroup[];
  structure: SchoolStructure;
  subject_constraints: Record<string, SubjectConstraint>;
  settings: AppSettings;
  fixed_slots: FixedSlot[];
  subject_placement: Record<string, SubjectPlacement>;
  cross_grade_groups: CrossGradeGroup[];
  class_groups: ClassGroup[];
  subject_pairings: SubjectPairing[];
  alt_week_pairs: AltWeekPair[];
  subject_sequences: SubjectSequence[];
  existing_timetable: TimetableEntry[];
  time_limit: number;
}

export interface SolverProgressMessage {
  type: "progress";
  score: number;
  attempts: number;
}

export interface SolverDoneMessage {
  type: "done";
  timetable: TimetableEntry[];
  count: number;
  placed: number;
  required: number;
}

export interface SolverErrorMessage {
  type: "error";
  message: string;
}

export type SolverMessage =
  | SolverProgressMessage
  | SolverDoneMessage
  | SolverErrorMessage;

export interface SolverResult {
  timetable: TimetableEntry[];
  count: number;
  placed: number;
  required: number;
  message: string;
}

// ── JSON保存/読込用のデータ形状 ─────────────────────────────

export interface TimetableFileData {
  teachers: Teacher[];
  teacher_groups: TeacherGroup[];
  class_groups: ClassGroup[];
  structure: SchoolStructure;
  timetable: TimetableEntry[];
  settings: Partial<AppSettings>;
  subject_constraints: Record<string, SubjectConstraint>;
  subject_pairings: SubjectPairing[];
  cell_groups: CellGroup[];
  fixed_slots: FixedSlot[];
  teacher_constraints: Record<string, TeacherConstraintSettings>;
  subject_placement: Record<string, SubjectPlacement>;
  facilities: Facility[];
  subject_facility: Record<string, string | null>;
  alt_week_pairs: AltWeekPair[];
  cross_grade_groups: CrossGradeGroup[];
  subject_sequences: SubjectSequence[];
}

// ── Zustandストア — State & Actions ─────────────────────────

export interface TimetableState {
  teachers: Teacher[];
  teacher_groups: TeacherGroup[];
  class_groups: ClassGroup[];
  structure: SchoolStructure;
  timetable: TimetableEntry[];
  subject_constraints: Record<string, SubjectConstraint>;
  subject_pairings: SubjectPairing[];
  cell_groups: CellGroup[];
  fixed_slots: FixedSlot[];
  teacher_constraints: Record<string, TeacherConstraintSettings>;
  subject_placement: Record<string, SubjectPlacement>;
  facilities: Facility[];
  subject_facility: Record<string, string | null>;
  alt_week_pairs: AltWeekPair[];
  subject_sequences: SubjectSequence[];
  cross_grade_groups: CrossGradeGroup[];
  settings: AppSettings;
}

export interface TimetableActions {
  // 時間割エントリ操作
  setTimetableEntry: (
    day_of_week: DayOfWeek,
    period: Period,
    grade: number,
    class_name: string,
    teacher_id: string | null,
    subject: string | null,
  ) => void;
  setTimetableTeacher: (
    day_of_week: DayOfWeek,
    period: Period,
    grade: number,
    class_name: string,
    teacher_id: string | null,
  ) => void;
  setAltEntry: (
    day_of_week: DayOfWeek,
    period: Period,
    grade: number,
    class_name: string,
    alt_subject: string | null,
    alt_teacher_id: string | null,
  ) => void;
  setEntryGroup: (
    day_of_week: DayOfWeek,
    period: Period,
    grade: number,
    class_name: string,
    teacher_group_id: string | null,
  ) => void;
  setGeneratedTimetable: (entries: TimetableEntry[]) => void;
  swapTimetableEntries: (src: CellPosition, dest: CellPosition) => void;
  clearNonFixed: () => void;

  // セレクタ
  getEntry: (
    day_of_week: DayOfWeek,
    period: Period,
    grade: number,
    class_name: string,
  ) => TimetableEntry | undefined;
  getAvailableTeachers: (
    day_of_week: DayOfWeek,
    period: Period,
    target_grade: number,
    target_class_name: string,
  ) => Teacher[];
  getDailySubjectCount: (
    day_of_week: DayOfWeek,
    grade: number,
    class_name: string,
    subject: string,
  ) => number;
  getClassSubjectTotals: (
    grade: number,
    class_name: string,
  ) => Record<string, number>;
  getConsecutiveDaysViolations: () => ConsecutiveDaysViolation[];

  // 教科管理
  addSubject: (newSubject: string) => void;
  removeSubject: (subjectToDelete: string) => void;
  updateSubjectConstraint: (
    subject: string,
    maxConsecutiveDays: number | null,
  ) => void;
  updateRequiredHours: (
    keyString: string,
    subject: string,
    hours: string,
  ) => void;

  // 教員管理
  addTeacher: (teacherData: TeacherInput) => void;
  updateTeacher: (id: string, teacherData: Partial<Teacher>) => void;
  removeTeacher: (id: string) => void;

  // 教員グループ管理
  addTeacherGroup: (data: {
    name: string;
    teacher_ids: string[];
    subjects?: string[];
    target_grades?: number[];
  }) => void;
  updateTeacherGroup: (id: string, data: Partial<TeacherGroup>) => void;
  removeTeacherGroup: (id: string) => void;
  moveTeacherGroup: (id: string, direction: "up" | "down") => void;

  // クラス管理
  addClass: (grade: number, className: string) => void;
  removeClass: (grade: number, className: string) => void;

  // 合同クラス管理
  addClassGroup: (data: {
    grade: number;
    classes: string[];
    split_subjects?: string[];
  }) => void;
  removeClassGroup: (id: string) => void;
  addSplitSubject: (groupId: string, subject: string) => void;
  removeSplitSubject: (groupId: string, subject: string) => void;

  // 抱き合わせ教科管理
  addSubjectPairing: (pairing: SubjectPairingInput) => void;
  removeSubjectPairing: (id: string) => void;

  // 固定コマ管理
  addFixedSlot: (slot: FixedSlotInput) => void;
  removeFixedSlot: (id: string) => void;

  // 教員制約管理
  updateTeacherConstraintSettings: (
    teacher_id: string,
    constraints: Partial<TeacherConstraintSettings>,
  ) => void;

  // 教科配置制約管理
  updateSubjectPlacement: (
    subject: string,
    placement: Partial<SubjectPlacement>,
  ) => void;

  // 施設管理
  addFacility: (name: string) => void;
  removeFacility: (id: string) => void;
  updateSubjectFacility: (subject: string, facilityId: string | null) => void;

  // 隔週授業ペア管理
  addAltWeekPair: (pair: Omit<AltWeekPair, "id">) => void;
  removeAltWeekPair: (id: string) => void;
  updateAltWeekPair: (id: string, data: Partial<AltWeekPair>) => void;

  // 連続配置ペア管理
  addSubjectSequence: (seq: Omit<SubjectSequence, "id">) => void;
  removeSubjectSequence: (id: string) => void;

  // 複数学年合同授業管理
  addCrossGradeGroup: (data: CrossGradeGroupInput) => void;
  removeCrossGradeGroup: (id: string) => void;
  updateCrossGradeGroup: (id: string, data: Partial<CrossGradeGroup>) => void;

  // 時間帯設定
  updateLunchPeriod: (period: number) => void;

  // セルグループ管理
  groupCells: (cells: CellPosition[]) => void;
  ungroupCells: (groupId: string) => void;

  // インポート/エクスポート
  importState: (newState: Partial<TimetableFileData>) => void;
}

export type TimetableStore = TimetableState & TimetableActions;
