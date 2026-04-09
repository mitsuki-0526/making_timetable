import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useTimetableStore } from '@/store/useTimetableStore'
import type { SubjectPairing } from '@/types'

export function PairingsTab() {
  const structure = useTimetableStore((s) => s.structure)
  const pairings = useTimetableStore((s) => s.subject_pairings)
  const addSubjectPairing = useTimetableStore((s) => s.addSubjectPairing)
  const removeSubjectPairing = useTimetableStore((s) => s.removeSubjectPairing)

  const [grade, setGrade] = useState<number>(structure.grades[0]?.grade ?? 1)
  const [classA, setClassA] = useState('')
  const [subjectA, setSubjectA] = useState('')
  const [classB, setClassB] = useState('')
  const [subjectB, setSubjectB] = useState('')

  const gradeConfig = structure.grades.find((g) => g.grade === grade)
  const normalClasses = gradeConfig?.classes.filter((c) => !c.is_special_needs) ?? []
  const subjectList = gradeConfig ? Object.keys(gradeConfig.required_hours) : []

  const handleAdd = () => {
    if (!classA || !subjectA || !classB || !subjectB) return
    if (classA === classB && subjectA === subjectB) return
    const pairing: SubjectPairing = {
      id: crypto.randomUUID(),
      grade,
      class_a: classA,
      subject_a: subjectA,
      class_b: classB,
      subject_b: subjectB,
    }
    addSubjectPairing(pairing)
    setSubjectA('')
    setSubjectB('')
  }

  return (
    <div>
      <h3 className="section-title">抱き合わせ教科</h3>
      <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>
        2クラス間で同日同時限に特定の教科ペアを配置するルール。例: A組「技術」↔ B組「家庭科」
      </p>

      {structure.grades.length === 0 ? (
        <p className="empty-state">先にクラスと教科を登録してください</p>
      ) : (
        <div style={{ background: '#f9fafb', padding: 12, borderRadius: 6, marginBottom: 12 }}>
          <div className="form-row">
            <div className="form-field">
              <label>学年</label>
              <select className="form-select" value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
                {structure.grades.map((g) => (
                  <option key={g.grade} value={g.grade}>{g.grade}年</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'end' }}>
            <div style={{ flex: 1 }}>
              <div className="form-row">
                <div className="form-field" style={{ flex: 1 }}>
                  <label>クラスA</label>
                  <select className="form-select" value={classA} onChange={(e) => setClassA(e.target.value)}>
                    <option value="">選択...</option>
                    {normalClasses.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-field" style={{ flex: 1 }}>
                  <label>教科A</label>
                  <select className="form-select" value={subjectA} onChange={(e) => setSubjectA(e.target.value)}>
                    <option value="">選択...</option>
                    {subjectList.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <span style={{ fontSize: 14, color: '#6b7280', marginBottom: 12 }}>↔</span>
            <div style={{ flex: 1 }}>
              <div className="form-row">
                <div className="form-field" style={{ flex: 1 }}>
                  <label>クラスB</label>
                  <select className="form-select" value={classB} onChange={(e) => setClassB(e.target.value)}>
                    <option value="">選択...</option>
                    {normalClasses.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-field" style={{ flex: 1 }}>
                  <label>教科B</label>
                  <select className="form-select" value={subjectB} onChange={(e) => setSubjectB(e.target.value)}>
                    <option value="">選択...</option>
                    {subjectList.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <button className="btn btn-primary" onClick={handleAdd} style={{ marginBottom: 8 }}>
              <Plus size={12} /> 追加
            </button>
          </div>
        </div>
      )}

      {pairings.length === 0 ? (
        <p className="empty-state">抱き合わせ教科が登録されていません</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>学年</th>
              <th>クラスA</th>
              <th>教科A</th>
              <th></th>
              <th>クラスB</th>
              <th>教科B</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {pairings.map((p) => (
              <tr key={p.id}>
                <td>{p.grade}年</td>
                <td>{p.class_a}</td>
                <td><span className="tag">{p.subject_a}</span></td>
                <td style={{ textAlign: 'center' }}>↔</td>
                <td>{p.class_b}</td>
                <td><span className="tag">{p.subject_b}</span></td>
                <td>
                  <button className="btn btn-danger" onClick={() => removeSubjectPairing(p.id)}>
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
