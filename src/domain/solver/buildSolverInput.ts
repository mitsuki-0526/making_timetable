import type { TimetableStore } from '@/store/useTimetableStore'
import type { SolverInput, SolverSlot, SolverTeacher, SubjectRequirement, SolverFixedSlot } from './types'
import { DAYS, PERIODS } from '@/constants/school'

/**
 * ストア状態からソルバー入力を構築する
 */
export function buildSolverInput(state: TimetableStore, mode: 'full' | 'empty_only'): SolverInput {
  const slots: SolverSlot[] = []
  const requirements: SubjectRequirement[] = []

  for (const gradeConfig of state.structure.grades) {
    for (const cls of gradeConfig.classes) {
      // スロット生成
      for (const day of DAYS) {
        for (const period of PERIODS) {
          const entry = state.timetable.find(
            (e) => e.grade === gradeConfig.grade && e.class_name === cls.name && e.day_of_week === day && e.period === period,
          )
          const isFixed = state.fixed_slots.some(
            (f) =>
              f.day_of_week === day && f.period === period &&
              (f.scope === 'school' ||
               (f.scope === 'grade' && f.grade === gradeConfig.grade) ||
               (f.scope === 'class' && f.grade === gradeConfig.grade && f.class_name === cls.name)),
          )

          const hasSubject = entry?.subject != null

          // full: 固定以外を全てクリアして再配置
          // empty_only: 既存配置を保持、空きのみ配置
          if (mode === 'full') {
            slots.push({
              grade: gradeConfig.grade, class_name: cls.name, day, period,
              isFixed: isFixed || (entry?.is_locked ?? false),
              currentSubject: isFixed ? (entry?.subject ?? null) : null,
              currentTeacherId: isFixed ? (entry?.teacher_id ?? null) : null,
            })
          } else {
            slots.push({
              grade: gradeConfig.grade, class_name: cls.name, day, period,
              isFixed: isFixed || hasSubject,
              currentSubject: entry?.subject ?? null,
              currentTeacherId: entry?.teacher_id ?? null,
            })
          }
        }
      }

      // 教科要件
      for (const [subject, required] of Object.entries(gradeConfig.required_hours)) {
        const current = state.timetable.filter(
          (e) => e.grade === gradeConfig.grade && e.class_name === cls.name && e.subject === subject,
        ).length

        // full: 固定コマ分のみcurrent、empty_only: 現配置をcurrent
        const effectiveCurrent = mode === 'full'
          ? state.timetable.filter(
              (e) => e.grade === gradeConfig.grade && e.class_name === cls.name && e.subject === subject &&
                (e.is_locked || state.fixed_slots.some(
                  (f) => f.day_of_week === e.day_of_week && f.period === e.period &&
                    (f.scope === 'school' || (f.scope === 'grade' && f.grade === gradeConfig.grade) || (f.scope === 'class' && f.grade === gradeConfig.grade && f.class_name === cls.name)),
                )),
            ).length
          : current

        if (required > effectiveCurrent) {
          requirements.push({
            grade: gradeConfig.grade, class_name: cls.name,
            subject, required, current: effectiveCurrent,
          })
        }
      }
    }
  }

  const solverTeachers: SolverTeacher[] = state.teachers.map((t) => ({
    id: t.id,
    name: t.name,
    subjects: [...t.subjects],
    targetGrades: [...t.target_grades],
    unavailableTimes: t.unavailable_times.map((u) => ({ ...u })),
    availableDays: t.available_days ? [...t.available_days] : null,
    maxWeekly: t.max_hours,
  }))

  const fixedSlots: SolverFixedSlot[] = state.fixed_slots.map((f) => ({
    grade: f.grade, class_name: f.class_name,
    day: f.day_of_week, period: f.period, subject: f.subject,
  }))

  const hardConstraints = {
    maxDailyPerTeacher: Object.fromEntries(
      Object.entries(state.teacher_constraints)
        .filter(([, c]) => c.max_daily_hardness === 'hard')
        .map(([id, c]) => [id, c.max_daily_periods]),
    ),
    maxConsecutivePerTeacher: Object.fromEntries(
      Object.entries(state.teacher_constraints)
        .filter(([, c]) => c.max_consecutive_hardness === 'hard')
        .map(([id, c]) => [id, c.max_consecutive_periods]),
    ),
  }

  return { slots, teachers: solverTeachers, requirements, fixedSlots, hardConstraints }
}
