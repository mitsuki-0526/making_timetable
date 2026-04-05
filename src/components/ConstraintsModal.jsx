import React, { useState } from 'react';
import { useTimetableStore } from '../store/useTimetableStore';

const DAYS = ['月', '火', '水', '木', '金'];
const PERIODS = [1, 2, 3, 4, 5, 6];

// ─────────────────────────────────────────────
// タブ① 固定コマ
// ─────────────────────────────────────────────
function FixedSlotsTab() {
  const { structure, fixed_slots, addFixedSlot, removeFixedSlot } = useTimetableStore();

  const [form, setForm] = useState({
    scope: 'all',
    grade: '',
    class_name: '',
    day_of_week: '月',
    period: 1,
    subject: '',
    label: '',
  });

  const allSubjects = [...new Set(
    Object.values(structure.required_hours || {}).flatMap(h => Object.keys(h))
  )].sort();

  const gradeOptions = (structure.grades || []).map(g => g.grade);
  const classOptions = form.grade
    ? (() => {
        const g = (structure.grades || []).find(gr => gr.grade === Number(form.grade));
        if (!g) return [];
        return [...(g.classes || []), ...(g.special_classes || [])];
      })()
    : [];

  const handleAdd = () => {
    if (!form.subject) { alert('教科を選択してください'); return; }
    if (form.scope === 'grade' && !form.grade) { alert('学年を選択してください'); return; }
    if (form.scope === 'class' && (!form.grade || !form.class_name)) { alert('学年とクラスを選択してください'); return; }
    addFixedSlot({
      scope: form.scope,
      grade: form.scope !== 'all' ? Number(form.grade) : null,
      class_name: form.scope === 'class' ? form.class_name : null,
      day_of_week: form.day_of_week,
      period: Number(form.period),
      subject: form.subject,
      label: form.label || form.subject,
    });
    setForm(f => ({ ...f, subject: '', label: '' }));
  };

  const scopeLabel = (scope, grade, class_name) => {
    if (scope === 'all') return '全校共通';
    if (scope === 'grade') return `${grade}年生全クラス`;
    return `${grade}年 ${class_name}`;
  };

  return (
    <div>
      <p style={{ color: '#666', marginBottom: '1rem', fontSize: '0.85rem' }}>
        特定の曜日・時限に固定する授業を登録します。<br />
        <strong>全校共通</strong>（例: 月1限は全校朝会）、<strong>学年指定</strong>（例: 3年の水5限は学活）、<strong>クラス指定</strong>も選べます。
      </p>

      <div style={{ background: '#f8faff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <label style={labelStyle}>
            <span style={labelHead}>適用範囲</span>
            <select value={form.scope} onChange={e => setForm(f => ({ ...f, scope: e.target.value, grade: '', class_name: '' }))} style={selectStyle}>
              <option value="all">全校共通</option>
              <option value="grade">学年指定</option>
              <option value="class">クラス指定</option>
            </select>
          </label>

          {form.scope !== 'all' && (
            <label style={labelStyle}>
              <span style={labelHead}>学年</span>
              <select value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value, class_name: '' }))} style={selectStyle}>
                <option value="">選択</option>
                {gradeOptions.map(g => <option key={g} value={g}>{g}年</option>)}
              </select>
            </label>
          )}

          {form.scope === 'class' && (
            <label style={labelStyle}>
              <span style={labelHead}>クラス</span>
              <select value={form.class_name} onChange={e => setForm(f => ({ ...f, class_name: e.target.value }))} style={selectStyle}>
                <option value="">選択</option>
                {classOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          )}

          <label style={labelStyle}>
            <span style={labelHead}>曜日</span>
            <select value={form.day_of_week} onChange={e => setForm(f => ({ ...f, day_of_week: e.target.value }))} style={selectStyle}>
              {DAYS.map(d => <option key={d} value={d}>{d}曜</option>)}
            </select>
          </label>

          <label style={labelStyle}>
            <span style={labelHead}>時限</span>
            <select value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))} style={selectStyle}>
              {PERIODS.map(p => <option key={p} value={p}>{p}限</option>)}
            </select>
          </label>

          <label style={labelStyle}>
            <span style={labelHead}>教科</span>
            <select value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} style={selectStyle}>
              <option value="">選択</option>
              {allSubjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          <label style={labelStyle}>
            <span style={labelHead}>ラベル（任意）</span>
            <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="例: 全校朝会" maxLength={20} style={inputStyle} />
          </label>
        </div>

        <button onClick={handleAdd} style={addBtnStyle}>＋ 追加</button>
      </div>

      {(fixed_slots || []).length === 0 ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: '1rem' }}>固定コマはまだ登録されていません</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: '#f1f5f9' }}>
              {['適用範囲', '曜日・時限', '教科', 'ラベル', ''].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(fixed_slots || []).map(slot => (
              <tr key={slot.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={tdStyle}>{scopeLabel(slot.scope, slot.grade, slot.class_name)}</td>
                <td style={tdStyle}>{slot.day_of_week}曜 {slot.period}限</td>
                <td style={tdStyle}>{slot.subject}</td>
                <td style={{ ...tdStyle, color: '#6b7280' }}>{slot.label || '-'}</td>
                <td style={tdStyle}>
                  <button onClick={() => removeFixedSlot(slot.id)} style={deleteBtnStyle}>削除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// タブ② 時間帯設定
// ─────────────────────────────────────────────
function TimezoneTab() {
  const { settings, updateLunchPeriod } = useTimetableStore();
  const lunchAfter = settings.lunch_after_period ?? 4;

  const amPeriods = PERIODS.filter(p => p <= lunchAfter);
  const pmPeriods = PERIODS.filter(p => p > lunchAfter);

  return (
    <div>
      <p style={{ color: '#666', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
        昼休みの区切りを設定します。「午前」「午後」の判定は教科配置制約に使用されます。
      </p>

      {/* 昼休み設定 */}
      <div style={{ background: '#f8faff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, color: '#374151', fontSize: '0.9rem' }}>🍱 昼休みは</span>
          <select
            value={lunchAfter}
            onChange={e => updateLunchPeriod(e.target.value)}
            style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid #d1d5db', fontWeight: 600, fontSize: '0.9rem', color: '#374151' }}
          >
            {PERIODS.slice(0, PERIODS.length - 1).map(p => (
              <option key={p} value={p}>{p}限と{p + 1}限の間</option>
            ))}
          </select>
          <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>に設定</span>
        </div>
      </div>

      {/* 時限プレビュー */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '1rem' }}>
            <div style={{ fontWeight: 700, color: '#1D4ED8', marginBottom: '0.75rem', fontSize: '0.9rem' }}>☀️ 午前</div>
            {amPeriods.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: '0.82rem' }}>なし</p>
            ) : (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {amPeriods.map(p => (
                  <span key={p} style={{ background: '#DBEAFE', color: '#1E40AF', borderRadius: '20px', padding: '4px 12px', fontWeight: 600, fontSize: '0.85rem' }}>
                    {p}限
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 0.5rem' }}>
          <div style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.8rem' }}>
            <div style={{ fontSize: '1.2rem' }}>🍱</div>
            <div>昼休み</div>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: '200px' }}>
          <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '8px', padding: '1rem' }}>
            <div style={{ fontWeight: 700, color: '#92400E', marginBottom: '0.75rem', fontSize: '0.9rem' }}>🌇 午後</div>
            {pmPeriods.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: '0.82rem' }}>なし</p>
            ) : (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {pmPeriods.map(p => (
                  <span key={p} style={{ background: '#FDE68A', color: '#92400E', borderRadius: '20px', padding: '4px 12px', fontWeight: 600, fontSize: '0.85rem' }}>
                    {p}限
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '1.5rem', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '1rem', fontSize: '0.83rem', color: '#166534' }}>
        <strong>📚 教科配置タブとの連携</strong><br />
        各教科の「午後1日上限」に <code>1</code> を設定すると、午後の授業は1日1コマまでに制限されます。<br />
        「午後分散」にチェックを入れると、午後コマをなるべく異なる曜日に分けます。
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// タブ③ 教員制約
// ─────────────────────────────────────────────
function TeacherConstraintsTab() {
  const { teachers, structure, teacher_constraints, updateTeacherConstraintSettings } = useTimetableStore();

  const get = (tid, key) => (teacher_constraints[tid] || {})[key] ?? '';
  const getBool = (tid, key) => !!(teacher_constraints[tid] || {})[key];

  const update = (tid, key, value) => {
    const num = value === '' ? null : parseInt(value, 10);
    updateTeacherConstraintSettings(tid, { [key]: isNaN(num) ? null : num });
  };

  const updateStr = (tid, key, value) => {
    updateTeacherConstraintSettings(tid, { [key]: value || null });
  };

  const updateBool = (tid, key) => {
    updateTeacherConstraintSettings(tid, { [key]: !getBool(tid, key) });
  };

  const gradeOptions = (structure.grades || []).map(g => g.grade);
  const getClassOptions = (tid) => {
    const hr_grade = (teacher_constraints[tid] || {}).homeroom_grade;
    if (!hr_grade) return [];
    const g = (structure.grades || []).find(gr => gr.grade === Number(hr_grade));
    if (!g) return [];
    return [...(g.classes || []), ...(g.special_classes || [])];
  };

  return (
    <div>
      <p style={{ color: '#666', marginBottom: '1rem', fontSize: '0.85rem' }}>
        教員ごとの授業コマ数制限・担任クラス・空きコマ集約を設定します。
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
          <thead>
            <tr style={{ background: '#f1f5f9' }}>
              {['教員名', '担当教科', '1日最大', '連続最大', '週最大', '担任学年', '担任クラス', '空きコマ集約'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teachers.map(t => (
              <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{t.name}</td>
                <td style={{ ...tdStyle, color: '#6b7280', fontSize: '0.78rem' }}>{(t.subjects || []).join(', ')}</td>
                <td style={tdStyle}>
                  <input type="number" min="1" max="6" value={get(t.id, 'max_daily')} placeholder="なし"
                    onChange={e => update(t.id, 'max_daily', e.target.value)} style={{ ...numInputStyle, width: '58px' }} />
                </td>
                <td style={tdStyle}>
                  <input type="number" min="1" max="6" value={get(t.id, 'max_consecutive')} placeholder="なし"
                    onChange={e => update(t.id, 'max_consecutive', e.target.value)} style={{ ...numInputStyle, width: '58px' }} />
                </td>
                <td style={tdStyle}>
                  <input type="number" min="1" max="30" value={get(t.id, 'max_weekly')} placeholder="なし"
                    onChange={e => update(t.id, 'max_weekly', e.target.value)} style={{ ...numInputStyle, width: '58px' }} />
                </td>
                <td style={tdStyle}>
                  <select value={(teacher_constraints[t.id] || {}).homeroom_grade ?? ''}
                    onChange={e => updateTeacherConstraintSettings(t.id, { homeroom_grade: e.target.value ? Number(e.target.value) : null, homeroom_class: null })}
                    style={{ ...selectStyle, width: '70px' }}>
                    <option value="">なし</option>
                    {gradeOptions.map(g => <option key={g} value={g}>{g}年</option>)}
                  </select>
                </td>
                <td style={tdStyle}>
                  <select value={(teacher_constraints[t.id] || {}).homeroom_class ?? ''}
                    onChange={e => updateStr(t.id, 'homeroom_class', e.target.value)}
                    style={{ ...selectStyle, width: '70px' }}
                    disabled={!(teacher_constraints[t.id] || {}).homeroom_grade}>
                    <option value="">なし</option>
                    {getClassOptions(t.id).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <input type="checkbox" checked={getBool(t.id, 'consolidate_free')}
                    onChange={() => updateBool(t.id, 'consolidate_free')}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: '0.75rem', color: '#9ca3af', fontSize: '0.78rem' }}>
        ※ 空欄は制限なし。担任クラス: そのクラスへの割り当てを優先。空きコマ集約: 授業の合間に空き時間を作らないよう最適化。
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// タブ⑤ 施設制約
// ─────────────────────────────────────────────
function FacilityTab() {
  const { structure, facilities, subject_facility, addFacility, removeFacility, updateSubjectFacility } = useTimetableStore();
  const [newFacName, setNewFacName] = useState('');

  const allSubjects = [...new Set(
    Object.values(structure.required_hours || {}).flatMap(h => Object.keys(h))
  )].sort();

  const handleAdd = () => {
    if (!newFacName.trim()) return;
    addFacility(newFacName.trim());
    setNewFacName('');
  };

  return (
    <div>
      <p style={{ color: '#666', marginBottom: '1rem', fontSize: '0.85rem' }}>
        体育館・理科室など<strong>同時に1クラスしか使えない施設</strong>を登録し、教科と紐付けます。<br />
        ソルバーは同一時限に同じ施設を複数クラスが使用しないよう制約します。
      </p>

      {/* 施設追加 */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input value={newFacName} onChange={e => setNewFacName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="施設名を入力（例: 体育館）" maxLength={20}
          style={{ flex: 1, padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem' }} />
        <button onClick={handleAdd} style={addBtnStyle}>＋ 追加</button>
      </div>

      {/* 施設一覧 */}
      {(facilities || []).length === 0 ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: '1rem', background: '#f9fafb', borderRadius: '8px', border: '1px dashed #d1d5db' }}>
          施設が登録されていません
        </p>
      ) : (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          {(facilities || []).map(fac => (
            <div key={fac.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '20px', padding: '4px 12px', fontSize: '0.85rem' }}>
              <span style={{ fontWeight: 600, color: '#1E40AF' }}>🏫 {fac.name}</span>
              <button onClick={() => removeFacility(fac.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '0.8rem', padding: '0 2px', lineHeight: 1 }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* 教科→施設マッピング */}
      {(facilities || []).length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.88rem', color: '#374151', fontWeight: 700 }}>教科と施設の紐付け</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th style={thStyle}>教科</th>
                <th style={thStyle}>使用施設</th>
              </tr>
            </thead>
            <tbody>
              {allSubjects.map(subj => (
                <tr key={subj} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{subj}</td>
                  <td style={tdStyle}>
                    <select value={(subject_facility || {})[subj] || ''}
                      onChange={e => updateSubjectFacility(subj, e.target.value || null)}
                      style={{ padding: '0.35rem 0.6rem', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.85rem', minWidth: '140px' }}>
                      <option value="">施設を使用しない</option>
                      {(facilities || []).map(fac => (
                        <option key={fac.id} value={fac.id}>{fac.name}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ marginTop: '0.5rem', color: '#9ca3af', fontSize: '0.78rem' }}>
            ※ 同一施設が設定された教科は、同一時限に1クラスのみ配置されます（ソルバーのハード制約）。
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// タブ④ 教科配置制約
// ─────────────────────────────────────────────
function SubjectConstraintsTab() {
  const { structure, settings, subject_placement, updateSubjectPlacement } = useTimetableStore();
  const lunchAfter = settings.lunch_after_period ?? 4;

  const allSubjects = [...new Set(
    Object.values(structure.required_hours || {}).flatMap(h => Object.keys(h))
  )].sort();

  const get = (subj, key) => (subject_placement[subj] || {})[key];

  const updateNum = (subj, key, value) => {
    const num = value === '' ? null : parseInt(value, 10);
    updateSubjectPlacement(subj, { [key]: isNaN(num) ? null : num });
  };

  const togglePeriod = (subj, period) => {
    const current = get(subj, 'allowed_periods') || [];
    const next = current.includes(period)
      ? current.filter(p => p !== period)
      : [...current, period].sort((a, b) => a - b);
    updateSubjectPlacement(subj, { allowed_periods: next });
  };

  const toggle = (subj, key) => {
    updateSubjectPlacement(subj, { [key]: !get(subj, key) });
  };

  return (
    <div>
      <p style={{ color: '#666', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
        教科ごとに配置可能な時限・午後制限・分散設定をします。
        昼休みの境界は「⏰ 時間帯」タブで変更できます（現在: <strong>{lunchAfter}限まで午前 / {lunchAfter + 1}限以降午後</strong>）。
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
          <thead>
            <tr style={{ background: '#f1f5f9' }}>
              <th style={thStyle}>教科</th>
              <th style={thStyle}>
                配置可能時限
                <div style={{ display: 'flex', gap: '3px', marginTop: '3px' }}>
                  {PERIODS.map(p => (
                    <span key={p} style={{
                      width: '22px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 400,
                      color: p <= lunchAfter ? '#1D4ED8' : '#92400E',
                    }}>{p}</span>
                  ))}
                </div>
              </th>
              <th style={thStyle}>1日最大コマ</th>
              <th style={thStyle}>午後1日上限</th>
              <th style={thStyle}>午後分散</th>
              <th style={thStyle}>全体分散</th>
              <th style={thStyle}>2コマ連続</th>
            </tr>
          </thead>
          <tbody>
            {allSubjects.map(subj => {
              const allowed = get(subj, 'allowed_periods') || [];
              return (
                <tr key={subj} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{subj}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: '3px' }}>
                      {PERIODS.map(p => {
                        const isAM = p <= lunchAfter;
                        const active = allowed.includes(p);
                        return (
                          <button key={p} onClick={() => togglePeriod(subj, p)} style={{
                            width: '22px', height: '22px', borderRadius: '3px', fontSize: '0.72rem',
                            cursor: 'pointer', fontWeight: 600, border: '1px solid',
                            background: active ? (isAM ? '#3B82F6' : '#F59E0B') : '#f1f5f9',
                            color: active ? '#fff' : '#9ca3af',
                            borderColor: active ? (isAM ? '#3B82F6' : '#F59E0B') : '#d1d5db',
                          }}>{p}</button>
                        );
                      })}
                      {allowed.length === 0 && (
                        <span style={{ color: '#9ca3af', fontSize: '0.75rem', alignSelf: 'center', marginLeft: '4px' }}>制限なし</span>
                      )}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <input type="number" min="1" max="6" value={get(subj, 'max_daily') ?? ''}
                      placeholder="なし" onChange={e => updateNum(subj, 'max_daily', e.target.value)}
                      style={{ ...numInputStyle, width: '68px' }} />
                  </td>
                  <td style={tdStyle}>
                    <input type="number" min="0" max="6" value={get(subj, 'max_afternoon_daily') ?? ''}
                      placeholder="なし" onChange={e => updateNum(subj, 'max_afternoon_daily', e.target.value)}
                      style={{ ...numInputStyle, width: '68px' }} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <input type="checkbox" checked={!!get(subj, 'afternoon_spread')}
                      onChange={() => toggle(subj, 'afternoon_spread')}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <input type="checkbox" checked={!!get(subj, 'spread_days')}
                      onChange={() => toggle(subj, 'spread_days')}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <input type="checkbox" checked={!!get(subj, 'requires_double')}
                      onChange={() => toggle(subj, 'requires_double')}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: '#6b7280', display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <span>🔵 青ボタン = 午前時限 　🟡 黄ボタン = 午後時限</span>
        <span>午後1日上限: その日の午後に置けるコマ数（推奨: 1）　午後分散: 午後コマを異なる曜日に配置　全体分散: 週全体で分散</span>
        <span>2コマ連続: ON にすると2時限連続で配置（理科実験・美術など）</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// タブ⑥ 隔週授業
// ─────────────────────────────────────────────
function AltWeekTab() {
  const { structure, alt_week_pairs, addAltWeekPair, removeAltWeekPair, updateAltWeekPair } = useTimetableStore();

  const [form, setForm] = useState({ class_key: '', subject_a: '', subject_b: '', count: 1 });

  // class_key の選択肢
  const classKeyOptions = (structure.grades || []).flatMap(g => {
    const opts = [];
    if ((g.classes || []).length > 0)         opts.push({ value: `${g.grade}_通常`, label: `${g.grade}年 通常クラス` });
    if ((g.special_classes || []).length > 0) opts.push({ value: `${g.grade}_特支`, label: `${g.grade}年 特支クラス` });
    return opts;
  });

  // 教科一覧
  const allSubjects = [...new Set(
    Object.values(structure.required_hours || {}).flatMap(h => Object.keys(h))
  )].sort();

  // 選択された class_key の required_hours から利用可能な教科を絞る
  const subjectsForKey = (key) => key
    ? Object.keys(structure.required_hours[key] || {})
    : allSubjects;

  const handleAdd = () => {
    if (!form.class_key) { alert('クラス区分を選択してください'); return; }
    if (!form.subject_a) { alert('A週の教科を選択してください'); return; }
    if (!form.subject_b) { alert('B週の教科を選択してください'); return; }
    if (form.subject_a === form.subject_b) { alert('A週とB週に同じ教科は設定できません'); return; }
    if (form.count < 1) { alert('コマ数は1以上を指定してください'); return; }
    addAltWeekPair({
      class_key: form.class_key,
      subject_a: form.subject_a,
      subject_b: form.subject_b,
      count: Number(form.count),
    });
    setForm(f => ({ ...f, subject_a: '', subject_b: '', count: 1 }));
  };

  const classKeyLabel = (key) => classKeyOptions.find(o => o.value === key)?.label || key;

  return (
    <div>
      <p style={{ color: '#666', marginBottom: '1rem', fontSize: '0.85rem' }}>
        同じ時限に A週・B週で異なる教科を交互に行う「隔週授業」を設定します。<br />
        <strong>例</strong>: 1年通常クラスの「音楽」と「図工」を同一コマで1週交代に配置（各2コマ）
      </p>

      <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.82rem', color: '#92400E' }}>
        ⚠ <strong>required_hours の設定と合わせてください。</strong><br />
        例: 音楽=2、図工=2 のときに ペアcount=2 を設定 → 2つの同一コマが音楽(A)/図工(B)になります。
      </div>

      {/* 追加フォーム */}
      <div style={{ background: '#f8faff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <label style={labelStyle}>
            <span style={labelHead}>クラス区分</span>
            <select value={form.class_key} onChange={e => setForm(f => ({ ...f, class_key: e.target.value, subject_a: '', subject_b: '' }))} style={selectStyle}>
              <option value="">選択</option>
              {classKeyOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label style={labelStyle}>
            <span style={labelHead}>A週の教科</span>
            <select value={form.subject_a} onChange={e => setForm(f => ({ ...f, subject_a: e.target.value }))} style={selectStyle}>
              <option value="">選択</option>
              {subjectsForKey(form.class_key).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label style={labelStyle}>
            <span style={labelHead}>B週の教科</span>
            <select value={form.subject_b} onChange={e => setForm(f => ({ ...f, subject_b: e.target.value }))} style={selectStyle}>
              <option value="">選択</option>
              {subjectsForKey(form.class_key).filter(s => s !== form.subject_a).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label style={labelStyle}>
            <span style={labelHead}>隔週スロット数</span>
            <input type="number" min="1" max="10" value={form.count}
              onChange={e => setForm(f => ({ ...f, count: e.target.value }))}
              style={{ ...numInputStyle, width: '80px' }} />
          </label>
        </div>
        <button onClick={handleAdd} style={addBtnStyle}>＋ 追加</button>
      </div>

      {/* 登録済みリスト */}
      {(alt_week_pairs || []).length === 0 ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: '1rem', background: '#f9fafb', borderRadius: '8px', border: '1px dashed #d1d5db' }}>
          隔週授業ペアはまだ登録されていません
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: '#f1f5f9' }}>
              {['クラス区分', 'A週（主）', 'B週（副）', '隔週スロット数', ''].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(alt_week_pairs || []).map(pair => (
              <tr key={pair.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={tdStyle}>{classKeyLabel(pair.class_key)}</td>
                <td style={{ ...tdStyle, fontWeight: 600, color: '#1D4ED8' }}>A: {pair.subject_a}</td>
                <td style={{ ...tdStyle, fontWeight: 600, color: '#7C3AED' }}>B: {pair.subject_b}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <input type="number" min="1" max="10" value={pair.count}
                    onChange={e => updateAltWeekPair(pair.id, { count: Number(e.target.value) })}
                    style={{ ...numInputStyle, width: '60px' }} />
                </td>
                <td style={tdStyle}>
                  <button onClick={() => removeAltWeekPair(pair.id)} style={deleteBtnStyle}>削除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p style={{ marginTop: '0.75rem', color: '#9ca3af', fontSize: '0.78rem' }}>
        ※ ソルバー実行時に、A週教科のスロットへ自動的に B週教科（alt_subject）がタグ付けされます。
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// メインモーダル
// ─────────────────────────────────────────────
const TABS = [
  { id: 'fixed',    label: '🔒 固定コマ' },
  { id: 'timezone', label: '⏰ 時間帯' },
  { id: 'teacher',  label: '👨‍🏫 教員制約' },
  { id: 'subject',  label: '📚 教科配置' },
  { id: 'facility', label: '🏫 施設制約' },
  { id: 'altweek',  label: '🔄 隔週授業' },
];

export default function ConstraintsModal({ onClose }) {
  const [activeTab, setActiveTab] = useState('fixed');

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: '12px', width: '90vw', maxWidth: '820px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>

        {/* ヘッダー */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.2rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>📋 条件設定</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#6b7280' }}>✕</button>
        </div>

        {/* タブ */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', padding: '0 1.5rem', overflowX: 'auto' }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: '0.75rem 1.1rem', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              fontWeight: activeTab === tab.id ? 700 : 400,
              color: activeTab === tab.id ? '#3B82F6' : '#6b7280',
              borderBottom: activeTab === tab.id ? '2px solid #3B82F6' : '2px solid transparent',
              fontSize: '0.88rem',
            }}>{tab.label}</button>
          ))}
        </div>

        {/* コンテンツ */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          {activeTab === 'fixed'    && <FixedSlotsTab />}
          {activeTab === 'timezone' && <TimezoneTab />}
          {activeTab === 'teacher'  && <TeacherConstraintsTab />}
          {activeTab === 'subject'  && <SubjectConstraintsTab />}
          {activeTab === 'facility' && <FacilityTab />}
          {activeTab === 'altweek'  && <AltWeekTab />}
        </div>

        {/* フッター */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e5e7eb', textAlign: 'right' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 1.5rem', background: '#f1f5f9', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 共通スタイル ────────────────────────────
const labelStyle = { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' };
const labelHead  = { fontWeight: 600, color: '#374151' };
const selectStyle = { padding: '0.4rem', borderRadius: '4px', border: '1px solid #d1d5db' };
const inputStyle  = { padding: '0.4rem', borderRadius: '4px', border: '1px solid #d1d5db' };
const numInputStyle = { width: '80px', padding: '0.3rem 0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', textAlign: 'center' };
const addBtnStyle = { padding: '0.5rem 1.5rem', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 };
const deleteBtnStyle = { padding: '0.25rem 0.6rem', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' };
const thStyle = { padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontWeight: 600, color: '#475569', fontSize: '0.83rem' };
const tdStyle = { padding: '0.5rem 0.75rem' };
