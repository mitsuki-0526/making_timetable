import { useRef, useEffect, useState, useLayoutEffect } from 'react'
import { useTimetableStore } from '@/store/useTimetableStore'
import { getAvailableTeachers } from '@/domain/timetable/teacherAssignment'
import { AltWeekForm } from './AltWeekForm'
import type { CellPosition, TimetableEntry } from '@/types'

type Props = {
  position: CellPosition
  entry: TimetableEntry | null
  onClose: () => void
}

export function CellDropdown({ position, entry, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const structure = useTimetableStore((s) => s.structure)
  const teachers = useTimetableStore((s) => s.teachers)
  const timetable = useTimetableStore((s) => s.timetable)
  const teacherGroups = useTimetableStore((s) => s.teacher_groups)
  const classGroups = useTimetableStore((s) => s.class_groups)
  const setEntry = useTimetableStore((s) => s.setEntry)

  const [showAltWeek, setShowAltWeek] = useState(false)
  const [openUpward, setOpenUpward] = useState(false)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  // マウント後にドロップダウンがスクロールコンテナ内に収まるか判定
  useLayoutEffect(() => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()

    // 最も近いスクロール可能な親要素（.grid-container）を探す
    let scrollParent = ref.current.parentElement
    while (scrollParent) {
      const style = getComputedStyle(scrollParent)
      if (style.overflow === 'auto' || style.overflow === 'scroll' ||
          style.overflowY === 'auto' || style.overflowY === 'scroll') {
        break
      }
      scrollParent = scrollParent.parentElement
    }

    // スクロールコンテナの表示領域下端（clientHeightはスクロールバーを除いた高さ）
    const containerBottom = scrollParent
      ? scrollParent.getBoundingClientRect().top + scrollParent.clientHeight
      : window.innerHeight

    if (rect.bottom > containerBottom - 4) {
      setOpenUpward(true)
    } else {
      setOpenUpward(false)
    }
  }, [showAltWeek])

  const gradeConfig = structure.grades.find((g) => g.grade === position.grade)
  const subjects = gradeConfig ? Object.keys(gradeConfig.required_hours) : []

  const handleSubjectSelect = (subject: string | null) => {
    setEntry(position, subject, null)
    if (!subject) onClose()
  }

  const handleTeacherSelect = (teacherId: string) => {
    setEntry(position, entry?.subject ?? null, teacherId)
  }

  const availableTeachers = entry?.subject
    ? getAvailableTeachers({
        teachers, timetable, teacherGroups, classGroups,
        slot: position, subject: entry.subject,
      })
    : []

  const getTeacherName = (id: string | null) => {
    if (!id) return null
    return teachers.find((t) => t.id === id)?.name ?? id
  }

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        ...(openUpward ? { bottom: '100%' } : { top: '100%' }),
        left: 0, zIndex: 100,
        backgroundColor: '#fff', border: '1px solid #d1d5db', borderRadius: 6,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)', padding: 8,
        minWidth: 200, fontSize: 12,
      }}
    >
      <div style={{ marginBottom: 6, fontWeight: 600, color: '#374151' }}>
        {position.grade}年{position.class_name} {position.day_of_week}{position.period}限
      </div>

      {/* 教科選択 */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 2 }}>教科</div>
        <select
          value={entry?.subject ?? ''}
          onChange={(e) => handleSubjectSelect(e.target.value || null)}
          className="form-select"
          style={{ width: '100%' }}
        >
          <option value="">-- 教科を選択 --</option>
          {subjects.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* 教員選択 */}
      {entry?.subject && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 2 }}>
            担当教員: {getTeacherName(entry.teacher_id) ?? <span style={{ color: '#dc2626' }}>空きなし</span>}
          </div>
          {availableTeachers.length > 0 && (
            <select
              value={entry.teacher_id ?? ''}
              onChange={(e) => handleTeacherSelect(e.target.value)}
              className="form-select"
              style={{ width: '100%' }}
            >
              <option value="">-- 教員を選択 --</option>
              {availableTeachers.map((t) => (
                <option key={t.id} value={t.id}>{t.name}（{t.subjects.join('・')}）</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* アクションボタン */}
      {entry?.subject && (
        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
          <button
            className="btn btn-secondary"
            onClick={() => setShowAltWeek(!showAltWeek)}
            style={{ flex: 1, fontSize: 11 }}
          >
            {showAltWeek ? '閉じる' : entry.alt_subject ? 'B週編集' : 'B週設定'}
          </button>
          <button
            className="btn btn-danger"
            onClick={() => handleSubjectSelect(null)}
            style={{ fontSize: 11 }}
          >
            クリア
          </button>
        </div>
      )}

      {/* B週設定フォーム */}
      {showAltWeek && entry?.subject && (
        <AltWeekForm
          position={position}
          entry={entry}
          onClose={() => setShowAltWeek(false)}
        />
      )}
    </div>
  )
}
