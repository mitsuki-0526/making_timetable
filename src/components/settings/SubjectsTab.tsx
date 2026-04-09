import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useTimetableStore } from '@/store/useTimetableStore'

export function SubjectsTab() {
  const structure = useTimetableStore((s) => s.structure)
  const updateRequiredHours = useTimetableStore((s) => s.updateRequiredHours)
  const settings = useTimetableStore((s) => s.settings)
  const addMappingRule = useTimetableStore((s) => s.addMappingRule)
  const removeMappingRule = useTimetableStore((s) => s.removeMappingRule)

  const [selectedGrade, setSelectedGrade] = useState<number>(structure.grades[0]?.grade ?? 1)
  const [newSubject, setNewSubject] = useState('')
  const [newHours, setNewHours] = useState(1)

  // 特支連動ルール追加用
  const [ruleGrade, setRuleGrade] = useState<number>(structure.grades[0]?.grade ?? 1)
  const [ruleFrom, setRuleFrom] = useState('')
  const [ruleTo, setRuleTo] = useState('')

  const gradeConfig = structure.grades.find((g) => g.grade === selectedGrade)
  const subjects = gradeConfig ? Object.entries(gradeConfig.required_hours) : []

  const handleAddSubject = () => {
    const trimmed = newSubject.trim()
    if (!trimmed || !gradeConfig) return
    updateRequiredHours(selectedGrade, trimmed, newHours)
    setNewSubject('')
    setNewHours(1)
  }

  const handleAddRule = () => {
    if (!ruleFrom.trim() || !ruleTo.trim()) return
    addMappingRule({ grade: ruleGrade, from_subject: ruleFrom.trim(), to_subject: ruleTo.trim() })
    setRuleFrom('')
    setRuleTo('')
  }

  return (
    <div>
      <h3 className="section-title">学年別 規定時数</h3>

      {structure.grades.length === 0 ? (
        <p className="empty-state">先に「クラス設定」タブで学年を追加してください</p>
      ) : (
        <>
          <div className="form-row">
            <div className="form-field">
              <label>学年</label>
              <select
                className="form-select"
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(Number(e.target.value))}
              >
                {structure.grades.map((g) => (
                  <option key={g.grade} value={g.grade}>{g.grade}年</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>教科名</label>
              <input
                className="form-input"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="例: 国語"
                onKeyDown={(e) => e.key === 'Enter' && handleAddSubject()}
              />
            </div>
            <div className="form-field">
              <label>週時数</label>
              <input
                className="form-input"
                type="number"
                min={0}
                max={30}
                value={newHours}
                onChange={(e) => setNewHours(Number(e.target.value))}
                style={{ width: 60 }}
              />
            </div>
            <button className="btn btn-primary" onClick={handleAddSubject}>
              <Plus size={12} /> 追加
            </button>
          </div>

          {subjects.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>教科</th>
                  <th style={{ width: 80 }}>週時数</th>
                  <th style={{ width: 50 }}></th>
                </tr>
              </thead>
              <tbody>
                {subjects.map(([subject, hours]) => (
                  <tr key={subject}>
                    <td>{subject}</td>
                    <td>
                      <input
                        className="form-input"
                        type="number"
                        min={0}
                        max={30}
                        value={hours}
                        onChange={(e) => updateRequiredHours(selectedGrade, subject, Number(e.target.value))}
                        style={{ width: 50 }}
                      />
                    </td>
                    <td>
                      <button
                        className="btn btn-danger"
                        onClick={() => updateRequiredHours(selectedGrade, subject, 0)}
                        title="削除（時数を0に）"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="empty-state">教科が登録されていません</p>
          )}
        </>
      )}

      <h3 className="section-title" style={{ marginTop: 24 }}>特支連動マッピングルール</h3>
      <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>
        通常学級の教科を配置した際に、特支クラスに自動設定される教科を定義します
      </p>

      <div className="form-row">
        <div className="form-field">
          <label>学年</label>
          <select
            className="form-select"
            value={ruleGrade}
            onChange={(e) => setRuleGrade(Number(e.target.value))}
          >
            {structure.grades.map((g) => (
              <option key={g.grade} value={g.grade}>{g.grade}年</option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label>通常学級の教科</label>
          <input
            className="form-input"
            value={ruleFrom}
            onChange={(e) => setRuleFrom(e.target.value)}
            placeholder="例: 数学"
          />
        </div>
        <div className="form-field">
          <label>特支の教科</label>
          <input
            className="form-input"
            value={ruleTo}
            onChange={(e) => setRuleTo(e.target.value)}
            placeholder="例: 自立活動"
          />
        </div>
        <button className="btn btn-primary" onClick={handleAddRule}>
          <Plus size={12} /> 追加
        </button>
      </div>

      {settings.mapping_rules.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>学年</th>
              <th>通常学級</th>
              <th>→</th>
              <th>特支</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {settings.mapping_rules.map((r) => (
              <tr key={`${r.grade}-${r.from_subject}`}>
                <td>{r.grade}年</td>
                <td>{r.from_subject}</td>
                <td>→</td>
                <td>{r.to_subject}</td>
                <td>
                  <button
                    className="btn btn-danger"
                    onClick={() => removeMappingRule(r.grade, r.from_subject)}
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="empty-state">ルールが登録されていません</p>
      )}
    </div>
  )
}
