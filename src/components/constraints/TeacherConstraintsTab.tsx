import { useState } from 'react'
import { Save } from 'lucide-react'
import { useTimetableStore } from '@/store/useTimetableStore'
import type { ConstraintHardness, TeacherConstraintSettings } from '@/types'

const HARDNESS_LABELS: Record<ConstraintHardness, string> = {
  hard: '必須',
  soft: '推奨',
}

const DEFAULT_SETTINGS: TeacherConstraintSettings = {
  max_daily_periods: null,
  max_daily_hardness: 'soft',
  max_consecutive_periods: null,
  max_consecutive_hardness: 'soft',
  max_weekly_periods: null,
  max_weekly_hardness: 'soft',
}

function HardnessSelect({ value, onChange }: { value: ConstraintHardness; onChange: (v: ConstraintHardness) => void }) {
  return (
    <select className="form-select" value={value} onChange={(e) => onChange(e.target.value as ConstraintHardness)} style={{ width: 70 }}>
      <option value="hard">{HARDNESS_LABELS.hard}</option>
      <option value="soft">{HARDNESS_LABELS.soft}</option>
    </select>
  )
}

export function TeacherConstraintsTab() {
  const teachers = useTimetableStore((s) => s.teachers)
  const teacherConstraints = useTimetableStore((s) => s.teacher_constraints)
  const updateTeacherConstraints = useTimetableStore((s) => s.updateTeacherConstraints)

  const [selectedTeacher, setSelectedTeacher] = useState(teachers[0]?.id ?? '')
  const current = teacherConstraints[selectedTeacher] ?? DEFAULT_SETTINGS

  const [form, setForm] = useState<TeacherConstraintSettings>(current)

  const handleSelectTeacher = (id: string) => {
    setSelectedTeacher(id)
    setForm(teacherConstraints[id] ?? DEFAULT_SETTINGS)
  }

  const handleSave = () => {
    if (!selectedTeacher) return
    updateTeacherConstraints(selectedTeacher, form)
  }

  const updateField = <K extends keyof TeacherConstraintSettings>(key: K, value: TeacherConstraintSettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div>
      <h3 className="section-title">教員制約設定</h3>

      {teachers.length === 0 ? (
        <p className="empty-state">先に教員を登録してください</p>
      ) : (
        <>
          <div className="form-row" style={{ marginBottom: 16 }}>
            <div className="form-field">
              <label>教員を選択</label>
              <select className="form-select" value={selectedTeacher} onChange={(e) => handleSelectTeacher(e.target.value)}>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            {teacherConstraints[selectedTeacher] && (
              <span className="tag" style={{ background: '#d1fae5', color: '#065f46' }}>設定済み</span>
            )}
          </div>

          <div style={{ background: '#f9fafb', padding: 12, borderRadius: 6 }}>
            <table className="data-table" style={{ marginTop: 0 }}>
              <thead>
                <tr>
                  <th>制約項目</th>
                  <th style={{ width: 100 }}>上限値</th>
                  <th style={{ width: 80 }}>硬さ</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1日の最大コマ数</td>
                  <td>
                    <input
                      className="form-input"
                      type="number"
                      min={0}
                      max={6}
                      value={form.max_daily_periods ?? ''}
                      onChange={(e) => updateField('max_daily_periods', e.target.value ? Number(e.target.value) : null)}
                      style={{ width: 60 }}
                      placeholder="--"
                    />
                  </td>
                  <td><HardnessSelect value={form.max_daily_hardness} onChange={(v) => updateField('max_daily_hardness', v)} /></td>
                </tr>
                <tr>
                  <td>連続コマ数上限</td>
                  <td>
                    <input
                      className="form-input"
                      type="number"
                      min={0}
                      max={6}
                      value={form.max_consecutive_periods ?? ''}
                      onChange={(e) => updateField('max_consecutive_periods', e.target.value ? Number(e.target.value) : null)}
                      style={{ width: 60 }}
                      placeholder="--"
                    />
                  </td>
                  <td><HardnessSelect value={form.max_consecutive_hardness} onChange={(v) => updateField('max_consecutive_hardness', v)} /></td>
                </tr>
                <tr>
                  <td>週の最大コマ数</td>
                  <td>
                    <input
                      className="form-input"
                      type="number"
                      min={0}
                      max={30}
                      value={form.max_weekly_periods ?? ''}
                      onChange={(e) => updateField('max_weekly_periods', e.target.value ? Number(e.target.value) : null)}
                      style={{ width: 60 }}
                      placeholder="--"
                    />
                  </td>
                  <td><HardnessSelect value={form.max_weekly_hardness} onChange={(v) => updateField('max_weekly_hardness', v)} /></td>
                </tr>
              </tbody>
            </table>

            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={handleSave}>
                <Save size={12} /> 保存
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
