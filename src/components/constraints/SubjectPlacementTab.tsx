import { useState } from 'react'
import { Save, Trash2 } from 'lucide-react'
import { useTimetableStore } from '@/store/useTimetableStore'
import { PERIODS } from '@/constants/school'
import type { SubjectPlacement, ConstraintHardness } from '@/types'

const HARDNESS_LABELS: Record<ConstraintHardness, string> = { hard: '必須', soft: '推奨' }

const DEFAULT_PLACEMENT: Omit<SubjectPlacement, 'subject'> = {
  allowed_periods: null,
  allowed_periods_hardness: 'soft',
  max_consecutive_days: null,
  max_consecutive_days_hardness: 'soft',
  max_afternoon_daily: null,
  max_afternoon_daily_hardness: 'soft',
  allow_double_period: false,
}

function HardnessSelect({ value, onChange }: { value: ConstraintHardness; onChange: (v: ConstraintHardness) => void }) {
  return (
    <select className="form-select" value={value} onChange={(e) => onChange(e.target.value as ConstraintHardness)} style={{ width: 70 }}>
      <option value="hard">{HARDNESS_LABELS.hard}</option>
      <option value="soft">{HARDNESS_LABELS.soft}</option>
    </select>
  )
}

export function SubjectPlacementTab() {
  const structure = useTimetableStore((s) => s.structure)
  const placements = useTimetableStore((s) => s.subject_placements)
  const updateSubjectPlacement = useTimetableStore((s) => s.updateSubjectPlacement)
  const removeSubjectPlacement = useTimetableStore((s) => s.removeSubjectPlacement)
  const settings = useTimetableStore((s) => s.settings)

  // 全学年の教科を収集
  const allSubjects = [...new Set(structure.grades.flatMap((g) => Object.keys(g.required_hours)))]

  const [selectedSubject, setSelectedSubject] = useState(allSubjects[0] ?? '')
  const current = placements.find((p) => p.subject === selectedSubject)
  const [form, setForm] = useState<Omit<SubjectPlacement, 'subject'>>(
    current ? { ...current } : { ...DEFAULT_PLACEMENT },
  )

  const handleSelectSubject = (subject: string) => {
    setSelectedSubject(subject)
    const found = placements.find((p) => p.subject === subject)
    setForm(found ? { ...found } : { ...DEFAULT_PLACEMENT })
  }

  const handleSave = () => {
    if (!selectedSubject) return
    updateSubjectPlacement({ subject: selectedSubject, ...form })
  }

  const togglePeriod = (p: number) => {
    const current = form.allowed_periods ?? []
    const updated = current.includes(p)
      ? current.filter((x) => x !== p)
      : [...current, p].sort()
    setForm((prev) => ({ ...prev, allowed_periods: updated.length > 0 ? updated : null }))
  }

  const updateField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const lunchPeriod = settings.lunch_after_period

  return (
    <div>
      <h3 className="section-title">教科配置制約</h3>

      {allSubjects.length === 0 ? (
        <p className="empty-state">先に教科を登録してください</p>
      ) : (
        <>
          <div className="form-row" style={{ marginBottom: 16 }}>
            <div className="form-field">
              <label>教科を選択</label>
              <select className="form-select" value={selectedSubject} onChange={(e) => handleSelectSubject(e.target.value)}>
                {allSubjects.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {placements.some((p) => p.subject === selectedSubject) && (
              <span className="tag" style={{ background: '#d1fae5', color: '#065f46' }}>設定済み</span>
            )}
          </div>

          <div style={{ background: '#f9fafb', padding: 12, borderRadius: 6 }}>
            <div className="form-field" style={{ marginBottom: 12 }}>
              <label>配置許可時限</label>
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                {PERIODS.map((p) => (
                  <label key={p} className="form-checkbox" style={{
                    padding: '2px 8px',
                    background: (form.allowed_periods ?? []).includes(p) ? '#dbeafe' : '#f3f4f6',
                    borderRadius: 4,
                  }}>
                    <input
                      type="checkbox"
                      checked={(form.allowed_periods ?? []).includes(p)}
                      onChange={() => togglePeriod(p)}
                    />
                    {p}限{p > lunchPeriod ? '(午後)' : ''}
                  </label>
                ))}
                <HardnessSelect value={form.allowed_periods_hardness} onChange={(v) => updateField('allowed_periods_hardness', v)} />
              </div>
              <span style={{ fontSize: 10, color: '#9ca3af' }}>未選択=全時限OK</span>
            </div>

            <table className="data-table" style={{ marginTop: 0 }}>
              <thead>
                <tr>
                  <th>制約項目</th>
                  <th style={{ width: 100 }}>値</th>
                  <th style={{ width: 80 }}>硬さ</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>連続授業日数上限</td>
                  <td>
                    <input className="form-input" type="number" min={0} max={5}
                      value={form.max_consecutive_days ?? ''} placeholder="--"
                      onChange={(e) => updateField('max_consecutive_days', e.target.value ? Number(e.target.value) : null)}
                      style={{ width: 60 }} />
                  </td>
                  <td><HardnessSelect value={form.max_consecutive_days_hardness} onChange={(v) => updateField('max_consecutive_days_hardness', v)} /></td>
                </tr>
                <tr>
                  <td>1日の午後コマ上限</td>
                  <td>
                    <input className="form-input" type="number" min={0} max={6}
                      value={form.max_afternoon_daily ?? ''} placeholder="--"
                      onChange={(e) => updateField('max_afternoon_daily', e.target.value ? Number(e.target.value) : null)}
                      style={{ width: 60 }} />
                  </td>
                  <td><HardnessSelect value={form.max_afternoon_daily_hardness} onChange={(v) => updateField('max_afternoon_daily_hardness', v)} /></td>
                </tr>
              </tbody>
            </table>

            <label className="form-checkbox" style={{ marginTop: 8 }}>
              <input type="checkbox" checked={form.allow_double_period} onChange={(e) => updateField('allow_double_period', e.target.checked)} />
              2時間連続授業を許可
            </label>

            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between' }}>
              <button className="btn btn-danger" onClick={() => { removeSubjectPlacement(selectedSubject); setForm({ ...DEFAULT_PLACEMENT }) }}>
                <Trash2 size={12} /> 設定削除
              </button>
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
