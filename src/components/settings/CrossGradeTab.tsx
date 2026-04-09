import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useTimetableStore } from '@/store/useTimetableStore'
import type { CrossGradeGroup } from '@/types'

export function CrossGradeTab() {
  const structure = useTimetableStore((s) => s.structure)
  const crossGradeGroups = useTimetableStore((s) => s.cross_grade_groups)
  const addCrossGradeGroup = useTimetableStore((s) => s.addCrossGradeGroup)
  const removeCrossGradeGroup = useTimetableStore((s) => s.removeCrossGradeGroup)

  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [periodsPerWeek, setPeriodsPerWeek] = useState(1)
  const [selectedGrades, setSelectedGrades] = useState<Record<number, string[]>>({})

  const toggleClass = (grade: number, className: string) => {
    setSelectedGrades((prev) => {
      const current = prev[grade] ?? []
      const updated = current.includes(className)
        ? current.filter((c) => c !== className)
        : [...current, className]
      return { ...prev, [grade]: updated }
    })
  }

  const handleAdd = () => {
    if (!name.trim() || !subject.trim()) return
    const participants = Object.entries(selectedGrades)
      .filter(([, classes]) => classes.length > 0)
      .map(([grade, class_names]) => ({ grade: Number(grade), class_names }))
    if (participants.length < 2) return

    const group: CrossGradeGroup = {
      id: crypto.randomUUID(),
      name: name.trim(),
      subject: subject.trim(),
      periods_per_week: periodsPerWeek,
      participants,
    }
    addCrossGradeGroup(group)
    setName('')
    setSubject('')
    setPeriodsPerWeek(1)
    setSelectedGrades({})
  }

  return (
    <div>
      <h3 className="section-title">複数学年合同授業</h3>
      <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>
        異なる学年のクラスが同じ時間に合同で授業を行う設定
      </p>

      {structure.grades.length < 2 ? (
        <p className="empty-state">2つ以上の学年を登録してください</p>
      ) : (
        <div style={{ background: '#f9fafb', padding: 12, borderRadius: 6, marginBottom: 12 }}>
          <div className="form-row">
            <div className="form-field" style={{ flex: 1 }}>
              <label>名称 *</label>
              <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 1-2年 総合" />
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label>教科 *</label>
              <input className="form-input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="例: 総合的な学習の時間" />
            </div>
            <div className="form-field">
              <label>週時数</label>
              <input className="form-input" type="number" min={1} max={6} value={periodsPerWeek} onChange={(e) => setPeriodsPerWeek(Number(e.target.value))} style={{ width: 50 }} />
            </div>
          </div>
          <div className="form-field" style={{ marginBottom: 8 }}>
            <label>参加クラス（2学年以上から選択）*</label>
            {structure.grades.map((g) => (
              <div key={g.grade} style={{ marginTop: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{g.grade}年: </span>
                {g.classes.map((c) => (
                  <label key={c.name} className="form-checkbox" style={{ display: 'inline-flex', padding: '1px 6px', background: (selectedGrades[g.grade] ?? []).includes(c.name) ? '#dbeafe' : '#f3f4f6', borderRadius: 4, marginRight: 4 }}>
                    <input type="checkbox" checked={(selectedGrades[g.grade] ?? []).includes(c.name)} onChange={() => toggleClass(g.grade, c.name)} />
                    {c.name}
                  </label>
                ))}
              </div>
            ))}
          </div>
          <button className="btn btn-primary" onClick={handleAdd}>
            <Plus size={12} /> 追加
          </button>
        </div>
      )}

      {crossGradeGroups.length === 0 ? (
        <p className="empty-state">複数学年合同授業が登録されていません</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>教科</th>
              <th>週時数</th>
              <th>参加クラス</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {crossGradeGroups.map((g) => (
              <tr key={g.id}>
                <td style={{ fontWeight: 500 }}>{g.name}</td>
                <td><span className="tag">{g.subject}</span></td>
                <td>{g.periods_per_week}</td>
                <td>
                  {g.participants.map((p) => (
                    <span key={p.grade} style={{ marginRight: 8 }}>
                      {p.grade}年: {p.class_names.map((n) => <span key={n} className="tag">{n}</span>)}
                    </span>
                  ))}
                </td>
                <td>
                  <button className="btn btn-danger" onClick={() => removeCrossGradeGroup(g.id)}>
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
