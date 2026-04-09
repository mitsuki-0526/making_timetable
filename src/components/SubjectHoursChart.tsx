import { useMemo, useState } from 'react'
import { useTimetableStore } from '@/store/useTimetableStore'

export function SubjectHoursChart() {
  const structure = useTimetableStore((s) => s.structure)
  const timetable = useTimetableStore((s) => s.timetable)
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null)

  const grade = selectedGrade ?? structure.grades[0]?.grade ?? null

  const chartData = useMemo(() => {
    if (grade === null) return []
    const gradeConfig = structure.grades.find((g) => g.grade === grade)
    if (!gradeConfig) return []

    const normalClasses = gradeConfig.classes.filter((c) => !c.is_special_needs)

    return Object.entries(gradeConfig.required_hours).map(([subject, required]) => {
      const counts = normalClasses.map((cls) => {
        const count = timetable.filter(
          (e) => e.grade === grade && e.class_name === cls.name && e.subject === subject,
        ).length
        return { className: cls.name, count }
      })
      const avg = normalClasses.length > 0
        ? counts.reduce((sum, c) => sum + c.count, 0) / normalClasses.length
        : 0
      return { subject, required, avg, counts }
    })
  }, [grade, structure, timetable])

  if (structure.grades.length === 0) return null

  return (
    <div>
      <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>教科時数</h3>

      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {structure.grades.map((g) => (
          <button
            key={g.grade}
            onClick={() => setSelectedGrade(g.grade)}
            style={{
              padding: '3px 10px', border: '1px solid #d1d5db', borderRadius: 4,
              backgroundColor: g.grade === grade ? '#3b82f6' : '#fff',
              color: g.grade === grade ? '#fff' : '#374151',
              cursor: 'pointer', fontSize: 11,
            }}
          >
            {g.grade}年
          </button>
        ))}
      </div>

      {chartData.map(({ subject, required, avg }) => {
        const ratio = required > 0 ? avg / required : 0
        const barColor = ratio < 1 ? '#f59e0b' : ratio > 1 ? '#ef4444' : '#10b981'
        return (
          <div key={subject} style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
              <span>{subject}</span>
              <span style={{ color: barColor }}>{avg.toFixed(1)} / {required}</span>
            </div>
            <div style={{
              height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', width: `${Math.min(ratio * 100, 100)}%`,
                backgroundColor: barColor, borderRadius: 3,
              }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
