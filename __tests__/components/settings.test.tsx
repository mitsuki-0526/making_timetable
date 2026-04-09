import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useTimetableStore } from '@/store/useTimetableStore'
import { ClassesTab } from '@/components/settings/ClassesTab'
import { SubjectsTab } from '@/components/settings/SubjectsTab'

describe('ClassesTab', () => {
  beforeEach(() => {
    useTimetableStore.getState().reset()
  })

  it('学年追加ができる', () => {
    render(<ClassesTab />)

    const addBtn = screen.getByText('学年追加')
    fireEvent.click(addBtn)

    expect(useTimetableStore.getState().structure.grades.length).toBe(1)
    expect(useTimetableStore.getState().structure.grades[0].grade).toBe(1)
  })

  it('学年追加後にクラス追加ができる', () => {
    // 先に学年を追加
    useTimetableStore.getState().addGrade(1)

    render(<ClassesTab />)

    const classInput = screen.getByPlaceholderText('例: 1組')
    fireEvent.change(classInput, { target: { value: '1組' } })

    const addBtn = screen.getByText('追加')
    fireEvent.click(addBtn)

    const state = useTimetableStore.getState()
    expect(state.structure.grades[0].classes.length).toBe(1)
    expect(state.structure.grades[0].classes[0].name).toBe('1組')
  })

  it('クラスがない場合は空状態メッセージが表示される', () => {
    render(<ClassesTab />)
    expect(screen.getByText('学年が登録されていません')).toBeTruthy()
  })
})

describe('SubjectsTab', () => {
  beforeEach(() => {
    useTimetableStore.getState().reset()
  })

  it('学年がない場合は案内メッセージが表示される', () => {
    render(<SubjectsTab />)
    expect(screen.getByText(/先に「クラス設定」タブ/)).toBeTruthy()
  })

  it('教科と時数を追加できる', () => {
    useTimetableStore.getState().addGrade(1)
    render(<SubjectsTab />)

    const subjectInput = screen.getByPlaceholderText('例: 国語')
    fireEvent.change(subjectInput, { target: { value: '国語' } })

    // 「追加」ボタンが複数あるので最初のものを使用
    const addBtns = screen.getAllByText('追加')
    fireEvent.click(addBtns[0])

    const state = useTimetableStore.getState()
    expect(state.structure.grades[0].required_hours['国語']).toBe(1)
  })
})
