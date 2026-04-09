import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useTimetableStore } from '@/store/useTimetableStore'

export function ClassesTab() {
  const structure = useTimetableStore((s) => s.structure)
  const addGrade = useTimetableStore((s) => s.addGrade)
  const addClass = useTimetableStore((s) => s.addClass)
  const removeClass = useTimetableStore((s) => s.removeClass)

  const [newGrade, setNewGrade] = useState(1)
  const [newClassName, setNewClassName] = useState('')
  const [isSpecialNeeds, setIsSpecialNeeds] = useState(false)
  const [targetGrade, setTargetGrade] = useState<number>(structure.grades[0]?.grade ?? 1)

  const handleAddGrade = () => {
    addGrade(newGrade)
    setTargetGrade(newGrade)
  }

  const handleAddClass = () => {
    const trimmed = newClassName.trim()
    if (!trimmed) return
    addClass(targetGrade, trimmed, isSpecialNeeds)
    setNewClassName('')
    setIsSpecialNeeds(false)
  }

  return (
    <div>
      <h3 className="section-title">学年管理</h3>
      <div className="form-row">
        <div className="form-field">
          <label>学年番号</label>
          <input
            className="form-input"
            type="number"
            min={1}
            max={9}
            value={newGrade}
            onChange={(e) => setNewGrade(Number(e.target.value))}
            style={{ width: 60 }}
          />
        </div>
        <button className="btn btn-primary" onClick={handleAddGrade}>
          <Plus size={12} /> 学年追加
        </button>
      </div>

      {structure.grades.length === 0 ? (
        <p className="empty-state">学年が登録されていません</p>
      ) : (
        <>
          <h3 className="section-title">クラス管理</h3>
          <div className="form-row">
            <div className="form-field">
              <label>学年</label>
              <select
                className="form-select"
                value={targetGrade}
                onChange={(e) => setTargetGrade(Number(e.target.value))}
              >
                {structure.grades.map((g) => (
                  <option key={g.grade} value={g.grade}>{g.grade}年</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>クラス名</label>
              <input
                className="form-input"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="例: 1組"
                onKeyDown={(e) => e.key === 'Enter' && handleAddClass()}
              />
            </div>
            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={isSpecialNeeds}
                onChange={(e) => setIsSpecialNeeds(e.target.checked)}
              />
              特支
            </label>
            <button className="btn btn-primary" onClick={handleAddClass}>
              <Plus size={12} /> 追加
            </button>
          </div>

          {structure.grades.map((g) => (
            <div key={g.grade} style={{ marginBottom: 12 }}>
              <h4 style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                {g.grade}年
              </h4>
              {g.classes.length === 0 ? (
                <p className="empty-state" style={{ padding: 8 }}>クラスなし</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>クラス名</th>
                      <th style={{ width: 80 }}>種別</th>
                      <th style={{ width: 50 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.classes.map((c) => (
                      <tr key={c.name}>
                        <td>{c.name}</td>
                        <td>
                          {c.is_special_needs
                            ? <span className="tag" style={{ background: '#fef3c7', color: '#92400e' }}>特支</span>
                            : <span className="tag">通常</span>
                          }
                        </td>
                        <td>
                          <button className="btn btn-danger" onClick={() => removeClass(g.grade, c.name)}>
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
