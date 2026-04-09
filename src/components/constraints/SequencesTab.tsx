import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useTimetableStore } from '@/store/useTimetableStore'
import type { SubjectSequence } from '@/types'

export function SequencesTab() {
  const structure = useTimetableStore((s) => s.structure)
  const sequences = useTimetableStore((s) => s.subject_sequences)
  const addSubjectSequence = useTimetableStore((s) => s.addSubjectSequence)
  const removeSubjectSequence = useTimetableStore((s) => s.removeSubjectSequence)

  const [grade, setGrade] = useState<number>(structure.grades[0]?.grade ?? 1)
  const [className, setClassName] = useState('')
  const [subjectA, setSubjectA] = useState('')
  const [subjectB, setSubjectB] = useState('')

  const gradeConfig = structure.grades.find((g) => g.grade === grade)
  const subjectList = gradeConfig ? Object.keys(gradeConfig.required_hours) : []

  const handleAdd = () => {
    if (!className || !subjectA || !subjectB) return
    const seq: SubjectSequence = {
      id: crypto.randomUUID(),
      grade,
      class_name: className,
      subject_a: subjectA,
      subject_b: subjectB,
    }
    addSubjectSequence(seq)
    setSubjectA('')
    setSubjectB('')
  }

  return (
    <div>
      <h3 className="section-title">連続配置ペア</h3>
      <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>
        2時間連続で配置する教科ペアを定義します（例: 数学→数学の2時間連続授業）
      </p>

      {structure.grades.length === 0 ? (
        <p className="empty-state">先にクラスと教科を登録してください</p>
      ) : (
        <div style={{ background: '#f9fafb', padding: 12, borderRadius: 6, marginBottom: 12 }}>
          <div className="form-row">
            <div className="form-field">
              <label>学年</label>
              <select className="form-select" value={grade} onChange={(e) => { setGrade(Number(e.target.value)); setClassName('') }}>
                {structure.grades.map((g) => <option key={g.grade} value={g.grade}>{g.grade}年</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>クラス</label>
              <select className="form-select" value={className} onChange={(e) => setClassName(e.target.value)}>
                <option value="">選択...</option>
                {gradeConfig?.classes.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>1時限目の教科</label>
              <select className="form-select" value={subjectA} onChange={(e) => setSubjectA(e.target.value)}>
                <option value="">選択...</option>
                {subjectList.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <span style={{ fontSize: 14, color: '#6b7280', alignSelf: 'end', marginBottom: 4 }}>→</span>
            <div className="form-field">
              <label>2時限目の教科</label>
              <select className="form-select" value={subjectB} onChange={(e) => setSubjectB(e.target.value)}>
                <option value="">選択...</option>
                {subjectList.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" onClick={handleAdd}>
              <Plus size={12} /> 追加
            </button>
          </div>
        </div>
      )}

      {sequences.length === 0 ? (
        <p className="empty-state">連続配置ペアが登録されていません</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>対象</th>
              <th>1時限目</th>
              <th></th>
              <th>2時限目</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {sequences.map((s) => (
              <tr key={s.id}>
                <td>{s.grade}年 {s.class_name}</td>
                <td><span className="tag">{s.subject_a}</span></td>
                <td style={{ textAlign: 'center' }}>→</td>
                <td><span className="tag">{s.subject_b}</span></td>
                <td>
                  <button className="btn btn-danger" onClick={() => removeSubjectSequence(s.id)}>
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
