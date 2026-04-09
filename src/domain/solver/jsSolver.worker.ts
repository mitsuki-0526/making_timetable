import type {
  SolverWorkerMessage, SolverWorkerResponse,
  SolverInput, SolverAssignment, SolverSlot, SolverTeacher,
  SolverResult,
} from './types'
import type { Day } from '@/types'

let cancelled = false

self.onmessage = (e: MessageEvent<SolverWorkerMessage>) => {
  if (e.data.type === 'cancel') {
    cancelled = true
    return
  }

  if (e.data.type === 'start') {
    cancelled = false
    try {
      const result = solve(e.data.input, e.data.maxIterations)
      const response: SolverWorkerResponse = { type: 'done', result }
      self.postMessage(response)
    } catch (err) {
      const response: SolverWorkerResponse = {
        type: 'error',
        message: err instanceof Error ? err.message : '不明なエラー',
      }
      self.postMessage(response)
    }
  }
}

function solve(input: SolverInput, maxIterations: number): SolverResult {
  const startTime = Date.now()
  let bestAssignments: SolverAssignment[] = []
  let bestScore = -Infinity

  for (let iter = 0; iter < maxIterations; iter++) {
    if (cancelled) break

    const { assignments, score } = runGreedy(input)
    if (score > bestScore) {
      bestScore = score
      bestAssignments = assignments
    }

    // 進捗報告（10回ごと）
    if (iter % 10 === 0) {
      const response: SolverWorkerResponse = { type: 'progress', iteration: iter, bestScore }
      self.postMessage(response)
    }

    // 全充足なら早期終了
    if (score === input.requirements.reduce((sum, r) => sum + (r.required - r.current), 0)) break
  }

  return {
    assignments: bestAssignments,
    stats: {
      totalSlots: input.slots.filter((s) => !s.isFixed).length,
      filledSlots: bestAssignments.length,
      iterations: maxIterations,
      elapsedMs: Date.now() - startTime,
    },
  }
}

function runGreedy(input: SolverInput): { assignments: SolverAssignment[]; score: number } {
  const assignments: SolverAssignment[] = []
  // 教員の使用状況追跡
  const teacherSlotUsed: Map<string, Set<string>> = new Map() // teacherId -> Set<"day|period">
  const teacherDailyCount: Map<string, Map<string, number>> = new Map() // teacherId -> Map<day, count>
  const teacherWeeklyCount: Map<string, number> = new Map()

  // 既に固定されたスロットの教員をトラッキング
  for (const slot of input.slots) {
    if (slot.isFixed && slot.currentTeacherId) {
      markTeacherUsed(teacherSlotUsed, teacherDailyCount, teacherWeeklyCount, slot.currentTeacherId, slot.day, slot.period)
    }
  }

  // 残り要件をコピー（ミュータブル）
  const remaining: Map<string, number> = new Map()
  for (const req of input.requirements) {
    const key = `${req.grade}|${req.class_name}|${req.subject}`
    remaining.set(key, req.required - req.current)
  }

  // 空きスロットをシャッフル
  const emptySlots = input.slots.filter((s) => !s.isFixed).slice()
  shuffle(emptySlots)

  for (const slot of emptySlots) {
    if (cancelled) break

    // この学年・クラスで不足している教科を優先度順に取得
    const needs = getNeeds(remaining, slot.grade, slot.class_name)
    if (needs.length === 0) continue

    // シャッフルして多様性を出す（ただし不足数が多い教科を優先）
    needs.sort((a, b) => b.count - a.count)

    let placed = false
    for (const need of needs) {
      // 教員を探す
      const teacher = findTeacher(
        input, slot, need.subject,
        teacherSlotUsed, teacherDailyCount, teacherWeeklyCount,
      )

      if (teacher) {
        assignments.push({
          grade: slot.grade, class_name: slot.class_name,
          day: slot.day, period: slot.period,
          subject: need.subject, teacher_id: teacher.id,
        })
        markTeacherUsed(teacherSlotUsed, teacherDailyCount, teacherWeeklyCount, teacher.id, slot.day, slot.period)
        remaining.set(`${slot.grade}|${slot.class_name}|${need.subject}`, need.count - 1)
        placed = true
        break
      }
    }

    // 教員なしでも仮置き可能な場合
    if (!placed && needs.length > 0) {
      const topNeed = needs[0]
      if (topNeed.count > 0) {
        assignments.push({
          grade: slot.grade, class_name: slot.class_name,
          day: slot.day, period: slot.period,
          subject: topNeed.subject, teacher_id: null,
        })
        remaining.set(`${slot.grade}|${slot.class_name}|${topNeed.subject}`, topNeed.count - 1)
      }
    }
  }

  const score = assignments.filter((a) => a.teacher_id !== null).length
  return { assignments, score }
}

function findTeacher(
  input: SolverInput,
  slot: SolverSlot,
  subject: string,
  slotUsed: Map<string, Set<string>>,
  dailyCount: Map<string, Map<string, number>>,
  weeklyCount: Map<string, number>,
): SolverTeacher | null {
  const candidates = input.teachers.filter((t) => {
    // 教科と学年チェック
    if (!t.subjects.includes(subject)) return false
    if (!t.targetGrades.includes(slot.grade)) return false

    // 配置不可時間チェック
    if (t.unavailableTimes.some((u) => u.day === slot.day && u.period === slot.period)) return false

    // 出勤可能日チェック
    if (t.availableDays && !t.availableDays.includes(slot.day)) return false

    // 同一時限の重複チェック
    const slotKey = `${slot.day}|${slot.period}`
    if (slotUsed.get(t.id)?.has(slotKey)) return false

    // 週上限チェック
    if (t.maxWeekly !== null && (weeklyCount.get(t.id) ?? 0) >= t.maxWeekly) return false

    // ハード制約: 日次上限チェック
    const maxDaily = input.hardConstraints.maxDailyPerTeacher[t.id]
    if (maxDaily !== null && maxDaily !== undefined) {
      const dayCount = dailyCount.get(t.id)?.get(slot.day) ?? 0
      if (dayCount >= maxDaily) return false
    }

    return true
  })

  if (candidates.length === 0) return null

  // 週コマ数が少ない教員を優先（ロードバランス）
  candidates.sort((a, b) => (weeklyCount.get(a.id) ?? 0) - (weeklyCount.get(b.id) ?? 0))

  // 上位3人からランダム選択（多様性のため）
  const top = candidates.slice(0, Math.min(3, candidates.length))
  return top[Math.floor(Math.random() * top.length)]
}

function getNeeds(remaining: Map<string, number>, grade: number, className: string): { subject: string; count: number }[] {
  const needs: { subject: string; count: number }[] = []
  for (const [key, count] of remaining) {
    if (count <= 0) continue
    const [g, c, subject] = key.split('|')
    if (Number(g) === grade && c === className) {
      needs.push({ subject, count })
    }
  }
  return needs
}

function markTeacherUsed(
  slotUsed: Map<string, Set<string>>,
  dailyCount: Map<string, Map<string, number>>,
  weeklyCount: Map<string, number>,
  teacherId: string, day: Day, period: number,
) {
  const slotKey = `${day}|${period}`
  if (!slotUsed.has(teacherId)) slotUsed.set(teacherId, new Set())
  slotUsed.get(teacherId)!.add(slotKey)

  if (!dailyCount.has(teacherId)) dailyCount.set(teacherId, new Map())
  const dayMap = dailyCount.get(teacherId)!
  dayMap.set(day, (dayMap.get(day) ?? 0) + 1)

  weeklyCount.set(teacherId, (weeklyCount.get(teacherId) ?? 0) + 1)
}

function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
}
