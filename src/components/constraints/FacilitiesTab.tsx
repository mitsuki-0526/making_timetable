import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useTimetableStore } from '@/store/useTimetableStore'
import type { Facility } from '@/types'

export function FacilitiesTab() {
  const facilities = useTimetableStore((s) => s.facilities)
  const subjectFacilities = useTimetableStore((s) => s.subject_facilities)
  const structure = useTimetableStore((s) => s.structure)
  const addFacility = useTimetableStore((s) => s.addFacility)
  const removeFacility = useTimetableStore((s) => s.removeFacility)
  const updateSubjectFacility = useTimetableStore((s) => s.updateSubjectFacility)

  const [name, setName] = useState('')
  const [capacity, setCapacity] = useState(1)

  const allSubjects = [...new Set(structure.grades.flatMap((g) => Object.keys(g.required_hours)))]

  const handleAddFacility = () => {
    if (!name.trim()) return
    const facility: Facility = {
      id: crypto.randomUUID(),
      name: name.trim(),
      capacity,
    }
    addFacility(facility)
    setName('')
    setCapacity(1)
  }

  const getFacilityForSubject = (subject: string) =>
    subjectFacilities.find((sf) => sf.subject === subject)?.facility_id ?? ''

  return (
    <div>
      <h3 className="section-title">施設マスタ</h3>
      <div className="form-row">
        <div className="form-field" style={{ flex: 1 }}>
          <label>施設名</label>
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 体育館" onKeyDown={(e) => e.key === 'Enter' && handleAddFacility()} />
        </div>
        <div className="form-field">
          <label>同時使用上限</label>
          <input className="form-input" type="number" min={1} max={10} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} style={{ width: 60 }} />
        </div>
        <button className="btn btn-primary" onClick={handleAddFacility}>
          <Plus size={12} /> 追加
        </button>
      </div>

      {facilities.length === 0 ? (
        <p className="empty-state">施設が登録されていません</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>施設名</th>
              <th style={{ width: 100 }}>同時使用上限</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {facilities.map((f) => (
              <tr key={f.id}>
                <td style={{ fontWeight: 500 }}>{f.name}</td>
                <td>{f.capacity}</td>
                <td>
                  <button className="btn btn-danger" onClick={() => removeFacility(f.id)}>
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {facilities.length > 0 && allSubjects.length > 0 && (
        <>
          <h3 className="section-title" style={{ marginTop: 24 }}>教科 → 施設マッピング</h3>
          <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>
            教科が使用する施設を指定すると、同時使用上限を超えないようバリデーションされます
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th>教科</th>
                <th>使用施設</th>
              </tr>
            </thead>
            <tbody>
              {allSubjects.map((subject) => (
                <tr key={subject}>
                  <td>{subject}</td>
                  <td>
                    <select
                      className="form-select"
                      value={getFacilityForSubject(subject)}
                      onChange={(e) => {
                        if (e.target.value) {
                          updateSubjectFacility({ subject, facility_id: e.target.value })
                        }
                      }}
                    >
                      <option value="">指定なし</option>
                      {facilities.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
