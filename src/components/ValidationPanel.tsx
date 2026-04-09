import { useMemo } from 'react'
import { useTimetableStore } from '@/store/useTimetableStore'
import { validateAll } from '@/domain/validation'
import { AlertTriangle, XCircle, Info } from 'lucide-react'

export function ValidationPanel() {
  const timetable = useTimetableStore((s) => s.timetable)
  const teachers = useTimetableStore((s) => s.teachers)
  const structure = useTimetableStore((s) => s.structure)
  const fixedSlots = useTimetableStore((s) => s.fixed_slots)
  const teacherConstraints = useTimetableStore((s) => s.teacher_constraints)
  const subjectPlacements = useTimetableStore((s) => s.subject_placements)
  const facilities = useTimetableStore((s) => s.facilities)
  const subjectFacilities = useTimetableStore((s) => s.subject_facilities)

  const result = useMemo(() => {
    return validateAll({
      timetable,
      teachers,
      structure,
      fixedSlots,
      teacherConstraints: new Map(Object.entries(teacherConstraints)),
      subjectPlacements,
      facilities,
      subjectFacilities,
    })
  }, [timetable, teachers, structure, fixedSlots, teacherConstraints, subjectPlacements, facilities, subjectFacilities])

  const allViolations = [
    ...result.fixedSlots.map((v) => ({ severity: v.severity, message: v.message })),
    ...result.teachers.map((v) => ({ severity: v.severity, message: v.message })),
    ...result.subjects.map((v) => ({ severity: v.severity, message: v.message })),
    ...result.facilities.map((v) => ({ severity: v.severity, message: v.message })),
  ]

  const errors = allViolations.filter((v) => v.severity === 'error')
  const warnings = allViolations.filter((v) => v.severity === 'warning')

  return (
    <div style={{ marginTop: 12 }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
        <AlertTriangle size={14} /> バリデーション
      </h3>

      {allViolations.length === 0 && (
        <div style={{ fontSize: 12, color: '#059669', display: 'flex', alignItems: 'center', gap: 4, padding: '8px 0' }}>
          <Info size={12} /> 問題はありません
        </div>
      )}

      {errors.map((v, i) => (
        <div key={`err-${i}`} className="validation-error" style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
          <XCircle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
          {v.message}
        </div>
      ))}

      {warnings.map((v, i) => (
        <div key={`warn-${i}`} className="validation-warning" style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
          <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
          {v.message}
        </div>
      ))}
    </div>
  )
}
