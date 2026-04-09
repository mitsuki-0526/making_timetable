import { useTimetableStore } from '@/store/useTimetableStore'
import { getAvailableTeachers } from '@/domain/timetable/teacherAssignment'
import type { CellPosition } from '@/types'

type Props = {
  position: CellPosition
  subject: string
  currentTeacherId: string | null
  onSelect: (teacherId: string) => void
}

export function TeacherPicker({ position, subject, currentTeacherId, onSelect }: Props) {
  const teachers = useTimetableStore((s) => s.teachers)
  const timetable = useTimetableStore((s) => s.timetable)
  const teacherGroups = useTimetableStore((s) => s.teacher_groups)
  const classGroups = useTimetableStore((s) => s.class_groups)

  const available = getAvailableTeachers({
    teachers, timetable, teacherGroups, classGroups,
    slot: position, subject,
  })

  const currentName = currentTeacherId
    ? teachers.find((t) => t.id === currentTeacherId)?.name ?? '不明'
    : null

  return (
    <div>
      <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 2 }}>
        担当教員: {currentName ?? <span style={{ color: '#dc2626' }}>空きなし</span>}
      </div>
      {available.length > 0 ? (
        <select
          className="form-select"
          value={currentTeacherId ?? ''}
          onChange={(e) => onSelect(e.target.value)}
          style={{ width: '100%' }}
        >
          <option value="">-- 教員を選択 --</option>
          {available.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}（{t.subjects.join('・')}）
            </option>
          ))}
        </select>
      ) : (
        <div style={{ fontSize: 11, color: '#dc2626', padding: '2px 0' }}>
          この時間帯に配置可能な教員がいません
        </div>
      )}
    </div>
  )
}
