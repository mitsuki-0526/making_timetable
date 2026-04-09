import { useState } from 'react'
import { useTimetableStore } from '@/store/useTimetableStore'
import { getAvailableTeachers } from '@/domain/timetable/teacherAssignment'
import type { CellPosition, TimetableEntry } from '@/types'

type Props = {
  position: CellPosition
  entry: TimetableEntry
  onClose: () => void
}

export function AltWeekForm({ position, entry, onClose }: Props) {
  const structure = useTimetableStore((s) => s.structure)
  const teachers = useTimetableStore((s) => s.teachers)
  const timetable = useTimetableStore((s) => s.timetable)
  const teacherGroups = useTimetableStore((s) => s.teacher_groups)
  const classGroups = useTimetableStore((s) => s.class_groups)
  const setTimetable = useTimetableStore((s) => s.setTimetable)

  const gradeConfig = structure.grades.find((g) => g.grade === position.grade)
  const subjects = gradeConfig ? Object.keys(gradeConfig.required_hours) : []

  const [altSubject, setAltSubject] = useState(entry.alt_subject ?? '')
  const [altTeacherId, setAltTeacherId] = useState(entry.alt_teacher_id ?? '')

  const availableTeachers = altSubject
    ? getAvailableTeachers({
        teachers, timetable, teacherGroups, classGroups,
        slot: position, subject: altSubject,
      })
    : []

  const handleSave = () => {
    const updatedTimetable = timetable.map((e) =>
      e.day_of_week === position.day_of_week &&
      e.period === position.period &&
      e.grade === position.grade &&
      e.class_name === position.class_name
        ? { ...e, alt_subject: altSubject || null, alt_teacher_id: altTeacherId || null }
        : e,
    )
    setTimetable(updatedTimetable)
    onClose()
  }

  const handleClear = () => {
    const updatedTimetable = timetable.map((e) =>
      e.day_of_week === position.day_of_week &&
      e.period === position.period &&
      e.grade === position.grade &&
      e.class_name === position.class_name
        ? { ...e, alt_subject: null, alt_teacher_id: null }
        : e,
    )
    setTimetable(updatedTimetable)
    onClose()
  }

  return (
    <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 8, marginTop: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#8b5cf6', marginBottom: 6 }}>
        B週（隔週）設定
      </div>
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 2 }}>B週の教科</div>
        <select
          className="form-select"
          value={altSubject}
          onChange={(e) => { setAltSubject(e.target.value); setAltTeacherId('') }}
          style={{ width: '100%' }}
        >
          <option value="">-- 選択 --</option>
          {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {altSubject && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 2 }}>B週の教員</div>
          <select
            className="form-select"
            value={altTeacherId}
            onChange={(e) => setAltTeacherId(e.target.value)}
            style={{ width: '100%' }}
          >
            <option value="">自動割当</option>
            {availableTeachers.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
        <button className="btn btn-primary" onClick={handleSave} style={{ flex: 1 }}>
          保存
        </button>
        {entry.alt_subject && (
          <button className="btn btn-danger" onClick={handleClear}>
            B週削除
          </button>
        )}
      </div>
    </div>
  )
}
