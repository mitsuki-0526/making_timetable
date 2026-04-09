import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useTimetableStore } from '@/store/useTimetableStore'
import { FixedSlotsTab } from '@/components/constraints/FixedSlotsTab'
import { FacilitiesTab } from '@/components/constraints/FacilitiesTab'

describe('FixedSlotsTab', () => {
  beforeEach(() => {
    useTimetableStore.getState().reset()
  })

  it('固定コマを追加できる', () => {
    render(<FixedSlotsTab />)

    const subjectInput = screen.getByPlaceholderText('例: 学活')
    fireEvent.change(subjectInput, { target: { value: '学活' } })

    const addBtn = screen.getByText('追加')
    fireEvent.click(addBtn)

    expect(useTimetableStore.getState().fixed_slots.length).toBe(1)
    expect(useTimetableStore.getState().fixed_slots[0].subject).toBe('学活')
    expect(useTimetableStore.getState().fixed_slots[0].scope).toBe('school')
  })

  it('固定コマがない場合は空状態メッセージが表示される', () => {
    render(<FixedSlotsTab />)
    expect(screen.getByText('固定コマが登録されていません')).toBeTruthy()
  })

  it('固定コマを削除できる', () => {
    useTimetableStore.getState().addFixedSlot({
      id: 'fs1', scope: 'school', grade: null, class_name: null,
      day_of_week: '月', period: 1, subject: '朝礼', teacher_id: null,
    })

    render(<FixedSlotsTab />)
    expect(screen.getByText('朝礼')).toBeTruthy()

    // テーブル内の削除ボタンをクリック
    const rows = screen.getAllByRole('row')
    const dataRow = rows.find((r) => r.textContent?.includes('朝礼'))
    const trashBtn = dataRow?.querySelector('button')
    if (trashBtn) fireEvent.click(trashBtn)

    expect(useTimetableStore.getState().fixed_slots.length).toBe(0)
  })
})

describe('FacilitiesTab', () => {
  beforeEach(() => {
    useTimetableStore.getState().reset()
  })

  it('施設を追加できる', () => {
    render(<FacilitiesTab />)

    const nameInput = screen.getByPlaceholderText('例: 体育館')
    fireEvent.change(nameInput, { target: { value: '音楽室' } })

    const addBtn = screen.getByText('追加')
    fireEvent.click(addBtn)

    expect(useTimetableStore.getState().facilities.length).toBe(1)
    expect(useTimetableStore.getState().facilities[0].name).toBe('音楽室')
    expect(useTimetableStore.getState().facilities[0].capacity).toBe(1)
  })

  it('施設がない場合は空状態メッセージが表示される', () => {
    render(<FacilitiesTab />)
    expect(screen.getByText('施設が登録されていません')).toBeTruthy()
  })
})
