import { describe, it, expect, beforeEach } from 'vitest'
import { applySolverResult } from '@/domain/solver/applySolverResult'
import { createEntry, resetIdCounter } from '../../helpers/fixtures'
import type { SolverResult } from '@/domain/solver/types'

describe('applySolverResult', () => {
  beforeEach(() => resetIdCounter())

  it('空のtimetableに結果を追加する', () => {
    const result: SolverResult = {
      assignments: [
        { grade: 1, class_name: '1組', day: '月', period: 1, subject: '数学', teacher_id: 't1' },
        { grade: 1, class_name: '1組', day: '月', period: 2, subject: '国語', teacher_id: 't2' },
      ],
      stats: { totalSlots: 30, filledSlots: 2, iterations: 10, elapsedMs: 100 },
    }

    const updated = applySolverResult([], result, 'full')
    expect(updated.length).toBe(2)
    expect(updated[0].subject).toBe('数学')
    expect(updated[0].teacher_id).toBe('t1')
  })

  it('full モードで既存エントリを上書きする', () => {
    const existing = [
      createEntry({ grade: 1, class_name: '1組', day_of_week: '月', period: 1, subject: '英語', teacher_id: 't3' }),
    ]
    const result: SolverResult = {
      assignments: [
        { grade: 1, class_name: '1組', day: '月', period: 1, subject: '数学', teacher_id: 't1' },
      ],
      stats: { totalSlots: 1, filledSlots: 1, iterations: 10, elapsedMs: 50 },
    }

    const updated = applySolverResult(existing, result, 'full')
    expect(updated.length).toBe(1)
    expect(updated[0].subject).toBe('数学')
    expect(updated[0].teacher_id).toBe('t1')
  })

  it('empty_only モードで既存配置をスキップする', () => {
    const existing = [
      createEntry({ grade: 1, class_name: '1組', day_of_week: '月', period: 1, subject: '英語', teacher_id: 't3' }),
    ]
    const result: SolverResult = {
      assignments: [
        { grade: 1, class_name: '1組', day: '月', period: 1, subject: '数学', teacher_id: 't1' },
      ],
      stats: { totalSlots: 1, filledSlots: 1, iterations: 10, elapsedMs: 50 },
    }

    const updated = applySolverResult(existing, result, 'empty_only')
    expect(updated.length).toBe(1)
    expect(updated[0].subject).toBe('英語') // 元の教科が保持される
  })

  it('empty_only モードで空きコマにのみ配置する', () => {
    const existing = [
      createEntry({ grade: 1, class_name: '1組', day_of_week: '月', period: 1, subject: '英語', teacher_id: 't3' }),
      createEntry({ grade: 1, class_name: '1組', day_of_week: '月', period: 2, subject: null }),
    ]
    const result: SolverResult = {
      assignments: [
        { grade: 1, class_name: '1組', day: '月', period: 1, subject: '数学', teacher_id: 't1' },
        { grade: 1, class_name: '1組', day: '月', period: 2, subject: '国語', teacher_id: 't2' },
      ],
      stats: { totalSlots: 2, filledSlots: 2, iterations: 10, elapsedMs: 50 },
    }

    const updated = applySolverResult(existing, result, 'empty_only')
    expect(updated[0].subject).toBe('英語') // 既存は保持
    expect(updated[1].subject).toBe('国語') // 空きに配置
  })

  it('alt_subjectなどの付随フィールドを保持する', () => {
    const existing = [
      createEntry({
        grade: 1, class_name: '1組', day_of_week: '月', period: 1,
        subject: null, alt_subject: '美術', alt_teacher_id: 't5',
      }),
    ]
    const result: SolverResult = {
      assignments: [
        { grade: 1, class_name: '1組', day: '月', period: 1, subject: '数学', teacher_id: 't1' },
      ],
      stats: { totalSlots: 1, filledSlots: 1, iterations: 10, elapsedMs: 50 },
    }

    const updated = applySolverResult(existing, result, 'full')
    expect(updated[0].subject).toBe('数学')
    expect(updated[0].alt_subject).toBe('美術') // 保持される
  })
})
