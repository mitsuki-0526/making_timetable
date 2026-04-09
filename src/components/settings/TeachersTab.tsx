import { useState } from 'react'
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react'
import { useTimetableStore } from '@/store/useTimetableStore'
import { DAYS, PERIODS, EMPLOYMENT_TYPES } from '@/constants/school'
import type { Teacher, EmploymentType } from '@/types'
import type { Day } from '@/types'

const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  full_time: '常勤',
  part_time: '非常勤',
  temporary: '講師',
  substitute: '期限付き',
}

function generateId() {
  return crypto.randomUUID()
}

export function TeachersTab() {
  const teachers = useTimetableStore((s) => s.teachers)
  const addTeacher = useTimetableStore((s) => s.addTeacher)
  const updateTeacher = useTimetableStore((s) => s.updateTeacher)
  const removeTeacher = useTimetableStore((s) => s.removeTeacher)
  const structure = useTimetableStore((s) => s.structure)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  // 新規追加フォーム
  const [name, setName] = useState('')
  const [subjects, setSubjects] = useState('')
  const [targetGrades, setTargetGrades] = useState('')
  const [employment, setEmployment] = useState<EmploymentType>('full_time')
  const [availableDays, setAvailableDays] = useState<Day[]>([...DAYS])
  const [maxHours, setMaxHours] = useState<string>('')
  const [isHomeroom, setIsHomeroom] = useState(false)

  const resetForm = () => {
    setName('')
    setSubjects('')
    setTargetGrades('')
    setEmployment('full_time')
    setAvailableDays([...DAYS])
    setMaxHours('')
    setIsHomeroom(false)
    setShowForm(false)
  }

  const handleAdd = () => {
    if (!name.trim()) return
    const teacher: Teacher = {
      id: generateId(),
      name: name.trim(),
      subjects: subjects.split(/[,、]/).map((s) => s.trim()).filter(Boolean),
      target_grades: targetGrades.split(/[,、]/).map((s) => Number(s.trim())).filter((n) => !isNaN(n)),
      unavailable_times: [],
      employment_type: employment,
      available_days: employment === 'full_time' ? null : availableDays,
      min_hours: null,
      max_hours: maxHours ? Number(maxHours) : null,
      contract_end_date: null,
      is_homeroom: isHomeroom,
      homeroom_class: null,
    }
    addTeacher(teacher)
    resetForm()
  }

  // 編集用
  const [editName, setEditName] = useState('')
  const [editSubjects, setEditSubjects] = useState('')
  const [editGrades, setEditGrades] = useState('')
  const [editEmployment, setEditEmployment] = useState<EmploymentType>('full_time')

  const startEdit = (t: Teacher) => {
    setEditingId(t.id)
    setEditName(t.name)
    setEditSubjects(t.subjects.join('、'))
    setEditGrades(t.target_grades.join('、'))
    setEditEmployment(t.employment_type)
  }

  const saveEdit = () => {
    if (!editingId || !editName.trim()) return
    updateTeacher(editingId, {
      name: editName.trim(),
      subjects: editSubjects.split(/[,、]/).map((s) => s.trim()).filter(Boolean),
      target_grades: editGrades.split(/[,、]/).map((s) => Number(s.trim())).filter((n) => !isNaN(n)),
      employment_type: editEmployment,
    })
    setEditingId(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3 className="section-title" style={{ margin: 0 }}>教員一覧（{teachers.length}名）</h3>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={12} /> 教員追加
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#f9fafb', padding: 12, borderRadius: 6, marginBottom: 12 }}>
          <div className="form-row">
            <div className="form-field" style={{ flex: 1 }}>
              <label>氏名 *</label>
              <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 山田太郎" />
            </div>
            <div className="form-field">
              <label>勤務形態</label>
              <select className="form-select" value={employment} onChange={(e) => setEmployment(e.target.value as EmploymentType)}>
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t} value={t}>{EMPLOYMENT_LABELS[t]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-field" style={{ flex: 1 }}>
              <label>担当教科（カンマ区切り）</label>
              <input className="form-input" value={subjects} onChange={(e) => setSubjects(e.target.value)} placeholder="例: 国語、書道" />
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label>担当学年（カンマ区切り）</label>
              <input className="form-input" value={targetGrades} onChange={(e) => setTargetGrades(e.target.value)} placeholder="例: 1、2、3" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label>最大週時数</label>
              <input className="form-input" type="number" min={0} value={maxHours} onChange={(e) => setMaxHours(e.target.value)} style={{ width: 60 }} placeholder="--" />
            </div>
            <label className="form-checkbox">
              <input type="checkbox" checked={isHomeroom} onChange={(e) => setIsHomeroom(e.target.checked)} />
              担任
            </label>
            {employment !== 'full_time' && (
              <div className="form-field">
                <label>出勤可能日</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  {DAYS.map((d) => (
                    <label key={d} className="form-checkbox">
                      <input
                        type="checkbox"
                        checked={availableDays.includes(d)}
                        onChange={(e) => {
                          setAvailableDays(
                            e.target.checked
                              ? [...availableDays, d]
                              : availableDays.filter((day) => day !== d),
                          )
                        }}
                      />
                      {d}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-primary" onClick={handleAdd}>追加</button>
            <button className="btn btn-secondary" onClick={resetForm}>キャンセル</button>
          </div>
        </div>
      )}

      {teachers.length === 0 ? (
        <p className="empty-state">教員が登録されていません</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>氏名</th>
              <th>担当教科</th>
              <th>学年</th>
              <th>形態</th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((t) => (
              <tr key={t.id}>
                {editingId === t.id ? (
                  <>
                    <td><input className="form-input" value={editName} onChange={(e) => setEditName(e.target.value)} style={{ width: '100%' }} /></td>
                    <td><input className="form-input" value={editSubjects} onChange={(e) => setEditSubjects(e.target.value)} style={{ width: '100%' }} /></td>
                    <td><input className="form-input" value={editGrades} onChange={(e) => setEditGrades(e.target.value)} style={{ width: 60 }} /></td>
                    <td>
                      <select className="form-select" value={editEmployment} onChange={(e) => setEditEmployment(e.target.value as EmploymentType)}>
                        {EMPLOYMENT_TYPES.map((et) => (
                          <option key={et} value={et}>{EMPLOYMENT_LABELS[et]}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-primary" onClick={saveEdit}><Check size={12} /></button>
                        <button className="btn btn-secondary" onClick={() => setEditingId(null)}><X size={12} /></button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{ fontWeight: 500 }}>{t.name}</td>
                    <td>{t.subjects.map((s) => <span key={s} className="tag">{s}</span>)}</td>
                    <td>{t.target_grades.join(', ')}年</td>
                    <td><span className="tag">{EMPLOYMENT_LABELS[t.employment_type]}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-secondary" onClick={() => startEdit(t)}><Edit2 size={12} /></button>
                        <button className="btn btn-danger" onClick={() => removeTeacher(t.id)}><Trash2 size={12} /></button>
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
