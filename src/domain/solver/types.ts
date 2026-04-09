import type { Day } from '@/types'

/** ソルバーへの入力 */
export type SolverInput = {
  /** 配置すべきスロット（空きコマ） */
  readonly slots: readonly SolverSlot[]
  /** 教員情報 */
  readonly teachers: readonly SolverTeacher[]
  /** 教科別の必要コマ数（gradeごと） */
  readonly requirements: readonly SubjectRequirement[]
  /** 固定コマ（変更不可） */
  readonly fixedSlots: readonly SolverFixedSlot[]
  /** ハード制約 */
  readonly hardConstraints: SolverHardConstraints
}

export type SolverSlot = {
  readonly grade: number
  readonly class_name: string
  readonly day: Day
  readonly period: number
  readonly isFixed: boolean
  readonly currentSubject: string | null
  readonly currentTeacherId: string | null
}

export type SolverTeacher = {
  readonly id: string
  readonly name: string
  readonly subjects: readonly string[]
  readonly targetGrades: readonly number[]
  readonly unavailableTimes: readonly { readonly day: Day; readonly period: number }[]
  readonly availableDays: readonly Day[] | null
  readonly maxWeekly: number | null
}

export type SubjectRequirement = {
  readonly grade: number
  readonly class_name: string
  readonly subject: string
  readonly required: number
  readonly current: number
}

export type SolverFixedSlot = {
  readonly grade: number | null
  readonly class_name: string | null
  readonly day: Day
  readonly period: number
  readonly subject: string
}

export type SolverHardConstraints = {
  readonly maxDailyPerTeacher: Record<string, number | null>
  readonly maxConsecutivePerTeacher: Record<string, number | null>
}

/** ソルバーの結果 */
export type SolverResult = {
  readonly assignments: readonly SolverAssignment[]
  readonly stats: SolverStats
}

export type SolverAssignment = {
  readonly grade: number
  readonly class_name: string
  readonly day: Day
  readonly period: number
  readonly subject: string
  readonly teacher_id: string | null
}

export type SolverStats = {
  readonly totalSlots: number
  readonly filledSlots: number
  readonly iterations: number
  readonly elapsedMs: number
}

/** Worker間メッセージ */
export type SolverWorkerMessage =
  | { type: 'start'; input: SolverInput; mode: 'full' | 'empty_only'; maxIterations: number }
  | { type: 'cancel' }

export type SolverWorkerResponse =
  | { type: 'progress'; iteration: number; bestScore: number }
  | { type: 'done'; result: SolverResult }
  | { type: 'error'; message: string }
