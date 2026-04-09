import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useTimetableStore } from '@/store/useTimetableStore'
import { DAYS, PERIODS } from '@/constants/school'
import type { AltWeekPair } from '@/types'
import type { Day } from '@/types'

export function AltWeekTab() {
  const structure = useTimetableStore((s) => s.structure)
  const teachers = useTimetableStore((s) => s.teachers)
  const altWeekPairs = useTimetableStore((s) => s.alt_week_pairs)
  const addAltWeekPair = useTimetableStore((s) => s.addAltWeekPair)
  const removeAltWeekPair = useTimetableStore((s) => s.removeAltWeekPair)

  const [grade, setGrade] = useState<number>(structure.grades[0]?.grade ?? 1)
  const [className, setClassName] = useState('')
  const [day, setDay] = useState<Day>('月')
  const [period, setPeriod] = useState(1)
  const [subjectA, setSubjectA] = useState('')
  const [teacherA, setTeacherA] = useState('')
  const [subjectB, setSubjectB] = useState('')
  const [teacherB, setTeacherB] = useState('')

  const gradeConfig = structure.grades.find((g) => g.grade === grade)
  const subjectList = gradeConfig ? Object.keys(gradeConfig.required_hours) : []

  const handleAdd = () => {
    if (!className || !subjectA || !subjectB) return
    const pair: AltWeekPair = {
      id: crypto.randomUUID(),
      grade,
      class_name: className,
      day_of_week: day,
      period,
      subject_a: subjectA,
      teacher_id_a: teacherA || null,
      subject_b: subjectB,
      teacher_id_b: teacherB || null,
    }
    addAltWeekPair(pair)
    setSubjectA('')
    setSubjectB('')
    setTeacherA('')
    setTeacherB('')
  }

  const teacherName = (id: string | null) => id ? teachers.find((t) => t.id === id)?.name ?? '—' : '—'

  return (
    <div>
      <h3 className="section-title">隔週授業ペア</h3>
      <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>
        A週とB週で異なる教科を交互に実施するコマを定義します
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
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'end' }}>
            <div style={{ flex: 1 }}>
              <div className="form-row">
                <div className="form-field" style={{ flex: 1 }}>
                  <label>A週 教科</label>
                  <select className="form-select" value={subjectA} onChange={(e) => setSubjectA(e.target.value)}>
                    <option value="">選択...</option>
                    {subjectList.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-field" style={{ flex: 1 }}>
                  <label>A週 教員</label>
                  <select className="form-select" value={teacherA} onChange={(e) => setTeacherA(e.target.value)}>
                    <option value="">自動</option>
                    {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <span style={{ fontSize: 14, color: '#6b7280', marginBottom: 12 }}>/</span>
            <div style={{ flex: 1 }}>
              <div className="form-row">
                <div className="form-field" style={{ flex: 1 }}>
                  <label>B週 教科</label>
                  <select className="form-select" value={subjectB} onChange={(e) => setSubjectB(e.target.value)}>
                    <option value="">選択...</option>
                    {subjectList.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-field" style={{ flex: 1 }}>
                  <label>B週 教員</label>
                  <select className="form-select" value={teacherB} onChange={(e) => setTeacherB(e.target.value)}>
                    <option value="">自動</option>
                    {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
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

      {altWeekPairs.length === 0 ? (
        <p className="empty-state">隔週ペアが登録されていません</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>対象</th>
              <th>曜日</th>
              <th>時限</th>
              <th>A週</th>
              <th>B週</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {altWeekPairs.map((p) => (
              <tr key={p.id}>
                <td>{p.grade}年 {p.class_name}</td>
                <td>{p.day_of_week}</td>
                <td>{p.period}限</td>
                <td>{p.subject_a}（{teacherName(p.teacher_id_a)}）</td>
                <td>{p.subject_b}（{teacherName(p.teacher_id_b)}）</td>
                <td>
                  <button className="btn btn-danger" onClick={() => removeAltWeekPair(p.id)}>
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
