import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useTimetableStore } from '@/store/useTimetableStore'
import { DAYS, PERIODS } from '@/constants/school'
import type { FixedSlot, FixedSlotScope } from '@/types'
import type { Day } from '@/types'

const SCOPE_LABELS: Record<FixedSlotScope, string> = {
  school: '全校',
  grade: '学年',
  class: 'クラス',
}

export function FixedSlotsTab() {
  const structure = useTimetableStore((s) => s.structure)
  const fixedSlots = useTimetableStore((s) => s.fixed_slots)
  const teachers = useTimetableStore((s) => s.teachers)
  const addFixedSlot = useTimetableStore((s) => s.addFixedSlot)
  const removeFixedSlot = useTimetableStore((s) => s.removeFixedSlot)

  const [scope, setScope] = useState<FixedSlotScope>('school')
  const [grade, setGrade] = useState<number>(structure.grades[0]?.grade ?? 1)
  const [className, setClassName] = useState('')
  const [day, setDay] = useState<Day>('月')
  const [period, setPeriod] = useState(1)
  const [subject, setSubject] = useState('')
  const [teacherId, setTeacherId] = useState('')

  const gradeConfig = structure.grades.find((g) => g.grade === grade)

  const handleAdd = () => {
    if (!subject.trim()) return
    const slot: FixedSlot = {
      id: crypto.randomUUID(),
      scope,
      grade: scope !== 'school' ? grade : null,
      class_name: scope === 'class' ? className : null,
      day_of_week: day,
      period,
      subject: subject.trim(),
      teacher_id: teacherId || null,
    }
    addFixedSlot(slot)
    setSubject('')
    setTeacherId('')
  }

  return (
    <div>
      <h3 className="section-title">固定コマ設定</h3>
      <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>
        ソルバーや手動編集で変更不可のコマ（朝礼・学年集会等）
      </p>

      <div style={{ background: '#f9fafb', padding: 12, borderRadius: 6, marginBottom: 12 }}>
        <div className="form-row">
          <div className="form-field">
            <label>スコープ</label>
            <select className="form-select" value={scope} onChange={(e) => setScope(e.target.value as FixedSlotScope)}>
              {(['school', 'grade', 'class'] as const).map((s) => (
                <option key={s} value={s}>{SCOPE_LABELS[s]}</option>
              ))}
            </select>
          </div>
          {scope !== 'school' && (
            <div className="form-field">
              <label>学年</label>
              <select className="form-select" value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
                {structure.grades.map((g) => (
                  <option key={g.grade} value={g.grade}>{g.grade}年</option>
                ))}
              </select>
            </div>
          )}
          {scope === 'class' && gradeConfig && (
            <div className="form-field">
              <label>クラス</label>
              <select className="form-select" value={className} onChange={(e) => setClassName(e.target.value)}>
                <option value="">選択...</option>
                {gradeConfig.classes.map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="form-row">
          <div className="form-field">
            <label>曜日</label>
            <select className="form-select" value={day} onChange={(e) => setDay(e.target.value as Day)}>
              {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>時限</label>
            <select className="form-select" value={period} onChange={(e) => setPeriod(Number(e.target.value))}>
              {PERIODS.map((p) => <option key={p} value={p}>{p}限</option>)}
            </select>
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label>教科 *</label>
            <input className="form-input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="例: 学活" />
          </div>
          <div className="form-field">
            <label>教員（任意）</label>
            <select className="form-select" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
              <option value="">指定なし</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={handleAdd}>
            <Plus size={12} /> 追加
          </button>
        </div>
      </div>

      {fixedSlots.length === 0 ? (
        <p className="empty-state">固定コマが登録されていません</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>スコープ</th>
              <th>対象</th>
              <th>曜日</th>
              <th>時限</th>
              <th>教科</th>
              <th>教員</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {fixedSlots.map((s) => (
              <tr key={s.id}>
                <td><span className="tag">{SCOPE_LABELS[s.scope]}</span></td>
                <td>
                  {s.scope === 'school' ? '—' : `${s.grade}年`}
                  {s.scope === 'class' && s.class_name ? ` ${s.class_name}` : ''}
                </td>
                <td>{s.day_of_week}</td>
                <td>{s.period}限</td>
                <td>{s.subject}</td>
                <td>{s.teacher_id ? teachers.find((t) => t.id === s.teacher_id)?.name ?? '—' : '—'}</td>
                <td>
                  <button className="btn btn-danger" onClick={() => removeFixedSlot(s.id)}>
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
