import { useState } from 'react'
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react'
import { useTimetableStore } from '@/store/useTimetableStore'
import type { TeacherGroup } from '@/types'

export function TeacherGroupsTab() {
  const teachers = useTimetableStore((s) => s.teachers)
  const teacherGroups = useTimetableStore((s) => s.teacher_groups)
  const addTeacherGroup = useTimetableStore((s) => s.addTeacherGroup)
  const updateTeacherGroup = useTimetableStore((s) => s.updateTeacherGroup)
  const removeTeacherGroup = useTimetableStore((s) => s.removeTeacherGroup)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([])
  const [subjects, setSubjects] = useState('')
  const [targetGrades, setTargetGrades] = useState('')

  const resetForm = () => {
    setName('')
    setSelectedTeachers([])
    setSubjects('')
    setTargetGrades('')
    setShowForm(false)
  }

  const handleAdd = () => {
    if (!name.trim() || selectedTeachers.length === 0) return
    const group: TeacherGroup = {
      id: crypto.randomUUID(),
      name: name.trim(),
      teacher_ids: selectedTeachers,
      subjects: subjects.split(/[,、]/).map((s) => s.trim()).filter(Boolean),
      target_grades: targetGrades.split(/[,、]/).map((s) => Number(s.trim())).filter((n) => !isNaN(n)),
    }
    addTeacherGroup(group)
    resetForm()
  }

  const [editName, setEditName] = useState('')
  const [editSubjects, setEditSubjects] = useState('')

  const startEdit = (g: TeacherGroup) => {
    setEditingId(g.id)
    setEditName(g.name)
    setEditSubjects(g.subjects.join('、'))
  }

  const saveEdit = () => {
    if (!editingId || !editName.trim()) return
    updateTeacherGroup(editingId, {
      name: editName.trim(),
      subjects: editSubjects.split(/[,、]/).map((s) => s.trim()).filter(Boolean),
    })
    setEditingId(null)
  }

  const toggleTeacher = (id: string) => {
    setSelectedTeachers((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    )
  }

  const teacherName = (id: string) => teachers.find((t) => t.id === id)?.name ?? id

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3 className="section-title" style={{ margin: 0 }}>教員グループ（{teacherGroups.length}件）</h3>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={12} /> グループ追加
        </button>
      </div>

      <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>
        道徳・総合的な学習の時間など、複数教員で担当する教科用のグループ
      </p>

      {showForm && (
        <div style={{ background: '#f9fafb', padding: 12, borderRadius: 6, marginBottom: 12 }}>
          <div className="form-row">
            <div className="form-field" style={{ flex: 1 }}>
              <label>グループ名 *</label>
              <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 1年道徳" />
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label>担当教科（カンマ区切り）</label>
              <input className="form-input" value={subjects} onChange={(e) => setSubjects(e.target.value)} placeholder="例: 道徳" />
            </div>
            <div className="form-field">
              <label>対象学年</label>
              <input className="form-input" value={targetGrades} onChange={(e) => setTargetGrades(e.target.value)} placeholder="例: 1" style={{ width: 60 }} />
            </div>
          </div>
          <div className="form-field" style={{ marginBottom: 8 }}>
            <label>所属教員を選択 *</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              {teachers.length === 0 ? (
                <span style={{ fontSize: 11, color: '#9ca3af' }}>先に教員を登録してください</span>
              ) : (
                teachers.map((t) => (
                  <label key={t.id} className="form-checkbox" style={{ padding: '2px 6px', background: selectedTeachers.includes(t.id) ? '#dbeafe' : '#f3f4f6', borderRadius: 4 }}>
                    <input type="checkbox" checked={selectedTeachers.includes(t.id)} onChange={() => toggleTeacher(t.id)} />
                    {t.name}
                  </label>
                ))
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={handleAdd}>追加</button>
            <button className="btn btn-secondary" onClick={resetForm}>キャンセル</button>
          </div>
        </div>
      )}

      {teacherGroups.length === 0 ? (
        <p className="empty-state">教員グループが登録されていません</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>グループ名</th>
              <th>教科</th>
              <th>学年</th>
              <th>教員</th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {teacherGroups.map((g) => (
              <tr key={g.id}>
                {editingId === g.id ? (
                  <>
                    <td><input className="form-input" value={editName} onChange={(e) => setEditName(e.target.value)} style={{ width: '100%' }} /></td>
                    <td><input className="form-input" value={editSubjects} onChange={(e) => setEditSubjects(e.target.value)} style={{ width: '100%' }} /></td>
                    <td>{g.target_grades.join(', ')}年</td>
                    <td>{g.teacher_ids.map((id) => <span key={id} className="tag">{teacherName(id)}</span>)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-primary" onClick={saveEdit}><Check size={12} /></button>
                        <button className="btn btn-secondary" onClick={() => setEditingId(null)}><X size={12} /></button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{ fontWeight: 500 }}>{g.name}</td>
                    <td>{g.subjects.map((s) => <span key={s} className="tag">{s}</span>)}</td>
                    <td>{g.target_grades.join(', ')}年</td>
                    <td>{g.teacher_ids.map((id) => <span key={id} className="tag">{teacherName(id)}</span>)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-secondary" onClick={() => startEdit(g)}><Edit2 size={12} /></button>
                        <button className="btn btn-danger" onClick={() => removeTeacherGroup(g.id)}><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
