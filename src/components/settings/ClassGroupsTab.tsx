import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useTimetableStore } from '@/store/useTimetableStore'
import type { ClassGroup } from '@/types'

export function ClassGroupsTab() {
  const structure = useTimetableStore((s) => s.structure)
  const classGroups = useTimetableStore((s) => s.class_groups)
  const addClassGroup = useTimetableStore((s) => s.addClassGroup)
  const removeClassGroup = useTimetableStore((s) => s.removeClassGroup)

  const [grade, setGrade] = useState<number>(structure.grades[0]?.grade ?? 1)
  const [selectedClasses, setSelectedClasses] = useState<string[]>([])
  const [splitSubjects, setSplitSubjects] = useState('')

  const gradeConfig = structure.grades.find((g) => g.grade === grade)
  const normalClasses = gradeConfig?.classes.filter((c) => !c.is_special_needs) ?? []

  const handleAdd = () => {
    if (selectedClasses.length < 2) return
    const group: ClassGroup = {
      id: crypto.randomUUID(),
      grade,
      class_names: selectedClasses,
      split_subjects: splitSubjects.split(/[,、]/).map((s) => s.trim()).filter(Boolean),
    }
    addClassGroup(group)
    setSelectedClasses([])
    setSplitSubjects('')
  }

  const toggleClass = (name: string) => {
    setSelectedClasses((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name],
    )
  }

  return (
    <div>
      <h3 className="section-title">合同クラス設定</h3>
      <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>
        複数クラスが合同で授業を行う設定。分割教科は各クラスに別々の教員を配置します。
      </p>

      {structure.grades.length === 0 ? (
        <p className="empty-state">先にクラスを登録してください</p>
      ) : (
        <>
          <div className="form-row">
            <div className="form-field">
              <label>学年</label>
              <select className="form-select" value={grade} onChange={(e) => { setGrade(Number(e.target.value)); setSelectedClasses([]) }}>
                {structure.grades.map((g) => (
                  <option key={g.grade} value={g.grade}>{g.grade}年</option>
                ))}
              </select>
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label>分割教科（カンマ区切り）</label>
              <input className="form-input" value={splitSubjects} onChange={(e) => setSplitSubjects(e.target.value)} placeholder="例: 体育、技術" />
            </div>
            <button className="btn btn-primary" onClick={handleAdd} disabled={selectedClasses.length < 2}>
              <Plus size={12} /> 追加
            </button>
          </div>
          <div className="form-field" style={{ marginBottom: 12 }}>
            <label>合同にするクラス（2つ以上選択）</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              {normalClasses.map((c) => (
                <label key={c.name} className="form-checkbox" style={{ padding: '2px 6px', background: selectedClasses.includes(c.name) ? '#dbeafe' : '#f3f4f6', borderRadius: 4 }}>
                  <input type="checkbox" checked={selectedClasses.includes(c.name)} onChange={() => toggleClass(c.name)} />
                  {c.name}
                </label>
              ))}
              {normalClasses.length === 0 && <span style={{ fontSize: 11, color: '#9ca3af' }}>この学年にクラスがありません</span>}
            </div>
          </div>
        </>
      )}

      {classGroups.length === 0 ? (
        <p className="empty-state">合同クラスが登録されていません</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>学年</th>
              <th>クラス</th>
              <th>分割教科</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {classGroups.map((g) => (
              <tr key={g.id}>
                <td>{g.grade}年</td>
                <td>{g.class_names.map((n) => <span key={n} className="tag">{n}</span>)}</td>
                <td>{g.split_subjects.length > 0 ? g.split_subjects.map((s) => <span key={s} className="tag">{s}</span>) : '—'}</td>
                <td>
                  <button className="btn btn-danger" onClick={() => removeClassGroup(g.id)}>
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
