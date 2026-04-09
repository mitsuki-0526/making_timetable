import { useTimetableStore } from '@/store/useTimetableStore'
import { DAYS, PERIODS } from '@/constants/school'
import type { Day } from '@/types'

const ROLE_COLORS = {
  main: '#EFF6FF',
  altWeek: '#F5F3FF',
  group: '#D1FAE5',
  special: '#FEF9C3',
}

export function TeacherScheduleGrid() {
  const teachers = useTimetableStore((s) => s.teachers)
  const timetable = useTimetableStore((s) => s.timetable)

  const getEntries = (teacherId: string, day: Day, period: number) => {
    return timetable.filter(
      (e) => e.day_of_week === day && e.period === period &&
        (e.teacher_id === teacherId || e.alt_teacher_id === teacherId),
    )
  }

  const getWeeklyCount = (teacherId: string) => {
    return timetable.filter(
      (e) => e.teacher_id === teacherId && e.subject !== null,
    ).length
  }

  if (teachers.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>
        教員が登録されていません
      </div>
    )
  }

  return (
    <div style={{ overflow: 'auto' }}>
      <table className="timetable-grid">
        <thead>
          <tr>
            <th className="row-header">教員</th>
            <th>週計</th>
            {DAYS.map((day, di) =>
              PERIODS.map((period, pi) => (
                <th
                  key={`${day}-${period}`}
                  className={pi === PERIODS.length - 1 && di < DAYS.length - 1 ? 'day-separator' : ''}
                >
                  {period === 1 ? day : ''}{period}
                </th>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          {teachers.map((teacher) => (
            <tr key={teacher.id}>
              <td className="row-header">{teacher.name}</td>
              <td style={{ fontWeight: 600 }}>{getWeeklyCount(teacher.id)}</td>
              {DAYS.map((day, di) =>
                PERIODS.map((period, pi) => {
                  const entries = getEntries(teacher.id, day, period)
                  const isMain = entries.some((e) => e.teacher_id === teacher.id)
                  const isAlt = entries.some((e) => e.alt_teacher_id === teacher.id)
                  const bgColor = isMain
                    ? ROLE_COLORS.main
                    : isAlt
                      ? ROLE_COLORS.altWeek
                      : undefined

                  return (
                    <td
                      key={`${day}-${period}`}
                      className={pi === PERIODS.length - 1 && di < DAYS.length - 1 ? 'day-separator' : ''}
                      style={{ backgroundColor: bgColor, fontSize: 10 }}
                    >
                      {entries.map((e, i) => (
                        <div key={i}>
                          {e.subject}{e.grade}年{e.class_name}
                        </div>
                      ))}
                    </td>
                  )
                }),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
