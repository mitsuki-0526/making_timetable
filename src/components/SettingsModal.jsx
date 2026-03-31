import React, { useState } from 'react';
import { useTimetableStore } from '../store/useTimetableStore';
import { getStoredApiKey, setStoredApiKey, testApiKey } from '../lib/gemini';

const DAYS = ['月', '火', '水', '木', '金'];
const PERIODS = [1, 2, 3, 4, 5, 6];

const SettingsModal = ({ onClose }) => {
  const {
    structure, settings, teachers, teacher_groups, subject_constraints,
    addSubject, removeSubject, updateRequiredHours, updateSubjectConstraint,
    addMappingRule, removeMappingRule,
    addClass, removeClass,
    addTeacher, removeTeacher, updateTeacher,
    addTeacherGroup, removeTeacherGroup
  } = useTimetableStore();
  const [activeTab, setActiveTab] = useState('subjects'); // 'subjects', 'classes', 'teachers', 'ai'

  // --- タブ1: 教科・ルール ---
  const [newSubj, setNewSubj] = useState('');
  const [mapGrade, setMapGrade] = useState('1');
  const [mapFrom, setMapFrom] = useState('');
  const [mapTo, setMapTo] = useState('');

  const hwKeys = [];
  structure.grades.forEach(g => {
    hwKeys.push(`${g.grade}_通常`);
    if (g.special_classes && g.special_classes.length > 0) {
      hwKeys.push(`${g.grade}_特支`);
    }
  });

  const subjectList = Array.from(new Set(
    Object.values(structure.required_hours).flatMap(gradeObj => Object.keys(gradeObj))
  ));

  const handleAddSubject = () => {
    if (newSubj.trim()) {
      addSubject(newSubj.trim());
      setNewSubj('');
    }
  };

  const handleHourChange = (key, subj, val) => {
    updateRequiredHours(key, subj, val);
  };

  const handleMaxConsecutiveChange = (subj, val) => {
    const parsed = val === '' ? null : parseInt(val, 10);
    updateSubjectConstraint(subj, isNaN(parsed) ? null : parsed);
  };

  const handleAddRule = () => {
    if (mapGrade && mapFrom.trim() && mapTo.trim()) {
      addMappingRule(parseInt(mapGrade, 10) || mapGrade, mapFrom.trim(), mapTo.trim());
      setMapFrom('');
      setMapTo('');
    }
  };

  // --- タブ2: クラス設定 ---
  const [newClassGrade, setNewClassGrade] = useState('1');
  const [newClassName, setNewClassName] = useState('');
  const [isNewClassSpecial, setIsNewClassSpecial] = useState(false);

  const handleAddClass = () => {
    if (newClassName.trim()) {
      addClass(parseInt(newClassGrade, 10), newClassName.trim(), isNewClassSpecial);
      setNewClassName('');
    }
  };

  // --- グループ管理 ---
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupTeacherIds, setNewGroupTeacherIds] = useState([]);

  const toggleGroupTeacher = (tid) => {
    setNewGroupTeacherIds(prev =>
      prev.includes(tid) ? prev.filter(id => id !== tid) : [...prev, tid]
    );
  };

  const handleAddGroup = () => {
    if (!newGroupName.trim() || newGroupTeacherIds.length === 0) return;
    addTeacherGroup({ name: newGroupName.trim(), teacher_ids: newGroupTeacherIds });
    setNewGroupName('');
    setNewGroupTeacherIds([]);
  };

  // --- タブ4: AI設定 ---
  const [apiKeyInput, setApiKeyInput] = useState(getStoredApiKey());
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [apiTestLoading, setApiTestLoading] = useState(false);
  const [apiTestResult, setApiTestResult] = useState(''); // '' | 'ok' | 'error'
  const [apiTestMessage, setApiTestMessage] = useState('');

  const handleSaveApiKey = () => {
    setStoredApiKey(apiKeyInput.trim());
    setApiTestResult('');
    setApiTestMessage('APIキーを保存しました。');
    setTimeout(() => setApiTestMessage(''), 3000);
  };

  const handleTestApiKey = async () => {
    const key = apiKeyInput.trim();
    if (!key) { setApiTestResult('error'); setApiTestMessage('APIキーを入力してください。'); return; }
    setApiTestLoading(true);
    setApiTestResult('');
    setApiTestMessage('');
    try {
      await testApiKey(key);
      setStoredApiKey(key);
      setApiTestResult('ok');
      setApiTestMessage('接続成功！APIキーは自動的に保存されました。');
    } catch (e) {
      setApiTestResult('error');
      setApiTestMessage(`接続失敗: ${e.message}`);
    } finally {
      setApiTestLoading(false);
    }
  };

  // --- タブ3: 教員設定 ---
  const [teacherName, setTeacherName] = useState('');
  const [teacherSubjs, setTeacherSubjs] = useState('');
  const [teacherGrades, setTeacherGrades] = useState('');
  const [expandedTeacherId, setExpandedTeacherId] = useState(null);

  const handleAddTeacher = () => {
    if (teacherName.trim()) {
      const parsedGrades = teacherGrades.split(',').map(g => parseInt(g.trim(), 10)).filter(g => !isNaN(g));
      const parsedSubjs = teacherSubjs.split(',').map(s => s.trim()).filter(s => s);
      addTeacher({
        name: teacherName.trim(),
        subjects: parsedSubjs,
        target_grades: parsedGrades.length ? parsedGrades : [1, 2, 3],
        unavailable_times: []
      });
      setTeacherName('');
      setTeacherSubjs('');
      setTeacherGrades('');
    }
  };

  const toggleUnavailable = (teacherId, day, period) => {
    const teacher = teachers.find(t => t.id === teacherId);
    const exists = teacher.unavailable_times.some(u => u.day_of_week === day && u.period === period);
    const newTimes = exists
      ? teacher.unavailable_times.filter(u => !(u.day_of_week === day && u.period === period))
      : [...teacher.unavailable_times, { day_of_week: day, period }];
    updateTeacher(teacherId, { unavailable_times: newTimes });
  };

  const isUnavailable = (teacher, day, period) =>
    teacher.unavailable_times.some(u => u.day_of_week === day && u.period === period);

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <header className="modal-header">
          <h2>マスタ設定</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </header>

        <div className="modal-tabs" style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
          <button className={`tab-btn ${activeTab === 'subjects' ? 'active' : ''}`} onClick={() => setActiveTab('subjects')} style={{ flex: 1, padding: '1rem', border: 'none', background: activeTab === 'subjects' ? '#fff' : 'transparent', borderBottom: activeTab === 'subjects' ? '2px solid var(--primary)' : 'none', fontWeight: activeTab === 'subjects' ? 'bold' : 'normal', cursor: 'pointer' }}>教科・連動ルール</button>
          <button className={`tab-btn ${activeTab === 'classes' ? 'active' : ''}`} onClick={() => setActiveTab('classes')} style={{ flex: 1, padding: '1rem', border: 'none', background: activeTab === 'classes' ? '#fff' : 'transparent', borderBottom: activeTab === 'classes' ? '2px solid var(--primary)' : 'none', fontWeight: activeTab === 'classes' ? 'bold' : 'normal', cursor: 'pointer' }}>クラス編成</button>
          <button className={`tab-btn ${activeTab === 'teachers' ? 'active' : ''}`} onClick={() => setActiveTab('teachers')} style={{ flex: 1, padding: '1rem', border: 'none', background: activeTab === 'teachers' ? '#fff' : 'transparent', borderBottom: activeTab === 'teachers' ? '2px solid var(--primary)' : 'none', fontWeight: activeTab === 'teachers' ? 'bold' : 'normal', cursor: 'pointer' }}>教員リスト</button>
          <button className={`tab-btn ${activeTab === 'ai' ? 'active' : ''}`} onClick={() => setActiveTab('ai')} style={{ flex: 1, padding: '1rem', border: 'none', background: activeTab === 'ai' ? '#F5F3FF' : 'transparent', borderBottom: activeTab === 'ai' ? '2px solid #6366F1' : 'none', fontWeight: activeTab === 'ai' ? 'bold' : 'normal', cursor: 'pointer', color: activeTab === 'ai' ? '#4338CA' : undefined }}>🤖 AI設定</button>
        </div>

        <div className="modal-body">
          {activeTab === 'subjects' && (
            <>
              <section className="settings-section">
                <h3>1. 教科の追加と規定時数・連続日数上限の設定</h3>
                <div className="add-subject-row">
                  <input type="text" placeholder="新しい教科を入力" value={newSubj} onChange={e => setNewSubj(e.target.value)} className="input-base" />
                  <button className="btn-primary" onClick={handleAddSubject}>追加</button>
                </div>

                <div className="hours-table-wrapper">
                  <table className="hours-table">
                    <thead>
                      <tr>
                        <th style={{ width: '50px' }}>操作</th>
                        <th>教科</th>
                        {hwKeys.map(k => <th key={k}>{k.replace('_通常', '年').replace('_特支', '特支')}</th>)}
                        <th title="この日数以上連続して同じ教科が配置された場合に警告します。空欄は制限なし。">連続上限日数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjectList.map(subj => (
                        <tr key={subj}>
                          <td style={{ textAlign: 'center' }}>
                            <button className="btn-danger" style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }} onClick={() => removeSubject(subj)}>削除</button>
                          </td>
                          <td style={{ fontWeight: 600 }}>{subj}</td>
                          {hwKeys.map(k => (
                            <td key={k}>
                              <input type="number" min="0" className="input-small" value={structure.required_hours[k]?.[subj] || 0} onChange={(e) => handleHourChange(k, subj, e.target.value)} />
                            </td>
                          ))}
                          <td>
                            <input
                              type="number"
                              min="1"
                              max="5"
                              placeholder="−"
                              className="input-small"
                              value={subject_constraints?.[subj]?.max_consecutive_days ?? ''}
                              onChange={e => handleMaxConsecutiveChange(subj, e.target.value)}
                              title="連続して配置できる最大日数（この日数に達したら警告）"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="settings-section">
                <h3>2. 特別支援学級の教科連動ルール</h3>
                <p className="help-text">通常学級で左側の教科が設定された際、特別支援学級では右側の教科に自動で差し替えます。</p>

                <ul className="rules-list">
                  {Object.keys(settings.mappingRules).map(g => {
                    const rules = settings.mappingRules[g];
                    return Object.entries(rules).map(([fromS, toS]) => (
                      <li key={`${g}-${fromS}`} className="rule-item">
                        <span><strong>{g}年</strong>のルール: 通常 <strong>{fromS}</strong> ➡ 特支 <strong>{toS}</strong></span>
                        <button className="btn-danger" onClick={() => removeMappingRule(g, fromS)}>削除</button>
                      </li>
                    ));
                  })}
                </ul>

                <div className="add-rule-row">
                  <select value={mapGrade} onChange={e => setMapGrade(e.target.value)} className="input-base">
                    {structure.grades.map(g => <option key={g.grade} value={g.grade}>{g.grade}年</option>)}
                  </select>
                  <input type="text" placeholder="通常学級の教科" value={mapFrom} onChange={e => setMapFrom(e.target.value)} className="input-base" />
                  <span>➡</span>
                  <input type="text" placeholder="特支の教科" value={mapTo} onChange={e => setMapTo(e.target.value)} className="input-base" />
                  <button className="btn-primary" onClick={handleAddRule}>ルール登録</button>
                </div>
              </section>
            </>
          )}

          {activeTab === 'classes' && (
            <section className="settings-section">
              <h3>クラス編成の管理</h3>
              <div style={{ backgroundColor: '#F8FAFC', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                <p className="help-text" style={{ marginTop: 0 }}>新しいクラスを追加します。（既存のクラスを消すと、時間割上のそのクラスのコマも消去されます）</p>
                <div className="add-rule-row" style={{ marginBottom: 0 }}>
                  <select value={newClassGrade} onChange={e => setNewClassGrade(e.target.value)} className="input-base">
                    {structure.grades.map(g => <option key={g.grade} value={g.grade}>{g.grade}年</option>)}
                  </select>
                  <input type="text" placeholder="クラス名 (例: 3組, 特支2)" value={newClassName} onChange={e => setNewClassName(e.target.value)} className="input-base" />
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem', marginRight: '1rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={isNewClassSpecial} onChange={e => setIsNewClassSpecial(e.target.checked)} />
                    特支枠として追加
                  </label>
                  <button className="btn-primary" onClick={handleAddClass}>クラス追加</button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {structure.grades.map(g => (
                  <div key={g.grade} style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '1rem' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0' }}>{g.grade}年生</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {g.classes.map(c => (
                        <div key={`${g.grade}-${c}`} className="rule-item" style={{ padding: '0.4rem 0.8rem', gap: '0.5rem' }}>
                          <span>{c}</span>
                          <button className="btn-danger" onClick={() => removeClass(g.grade, c, false)}>✕</button>
                        </div>
                      ))}
                      {g.special_classes && g.special_classes.map(c => (
                        <div key={`${g.grade}-${c}`} className="rule-item" style={{ padding: '0.4rem 0.8rem', gap: '0.5rem', backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }}>
                          <span>{c} (特支)</span>
                          <button className="btn-danger" onClick={() => removeClass(g.grade, c, true)}>✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'teachers' && (
            <section className="settings-section">
              <h3>教員リストの管理</h3>
              <div style={{ backgroundColor: '#F8FAFC', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                <p className="help-text" style={{ marginTop: 0 }}>新しい教員を登録します。複数設定する場合はカンマ（,）で区切ってください。</p>
                <div className="add-rule-row" style={{ flexWrap: 'wrap', marginBottom: 0 }}>
                  <input type="text" placeholder="教員名 (例: 山田)" value={teacherName} onChange={e => setTeacherName(e.target.value)} className="input-base" style={{ flex: 1, minWidth: '120px' }} />
                  <input type="text" placeholder="担当教科 (例: 国語,書写)" value={teacherSubjs} onChange={e => setTeacherSubjs(e.target.value)} className="input-base" style={{ flex: 1, minWidth: '150px' }} />
                  <input type="text" placeholder="対象学年 (例: 1,2)" value={teacherGrades} onChange={e => setTeacherGrades(e.target.value)} className="input-base" style={{ flex: 1, minWidth: '120px' }} />
                  <button className="btn-primary" onClick={handleAddTeacher}>教員追加</button>
                </div>
              </div>

              <ul className="rules-list" style={{ gap: '0.75rem' }}>
                {teachers.map(t => {
                  const isExpanded = expandedTeacherId === t.id;
                  return (
                    <li key={t.id} style={{ border: '1px solid #E2E8F0', borderRadius: '8px', listStyle: 'none', padding: 0, overflow: 'hidden' }}>
                      {/* 教員ヘッダー行 */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', backgroundColor: isExpanded ? '#EFF6FF' : '#fff', cursor: 'pointer' }} onClick={() => setExpandedTeacherId(isExpanded ? null : t.id)}>
                        <div>
                          <strong style={{ fontSize: '1rem' }}>{t.name}</strong>
                          <span style={{ fontSize: '0.82rem', color: '#64748B', marginLeft: '1rem' }}>
                            {t.subjects.join(', ')} / {t.target_grades.join(', ')}年
                          </span>
                          {t.unavailable_times.length > 0 && (
                            <span style={{ fontSize: '0.78rem', color: '#B45309', marginLeft: '0.75rem' }}>
                              配置不可: {t.unavailable_times.length}コマ
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>{isExpanded ? '▲ 閉じる' : '▼ スケジュール設定'}</span>
                          <button className="btn-danger" style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }} onClick={e => { e.stopPropagation(); removeTeacher(t.id); }}>削除</button>
                        </div>
                      </div>

                      {/* 展開時: 配置不可グリッド */}
                      {isExpanded && (
                        <div style={{ padding: '1rem', backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
                          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.88rem', color: '#475569', fontWeight: 600 }}>
                            配置不可な時間をクリックして設定してください（赤 = 配置不可）
                          </p>
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                              <thead>
                                <tr>
                                  <th style={{ padding: '0.4rem 0.6rem', textAlign: 'center', backgroundColor: '#E2E8F0', border: '1px solid #CBD5E1', width: '48px' }}>時限</th>
                                  {DAYS.map(d => (
                                    <th key={d} style={{ padding: '0.4rem 0.8rem', textAlign: 'center', backgroundColor: '#E2E8F0', border: '1px solid #CBD5E1', minWidth: '52px' }}>{d}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {PERIODS.map(p => (
                                  <tr key={p}>
                                    <td style={{ padding: '0.3rem 0.6rem', textAlign: 'center', fontWeight: 600, backgroundColor: '#E2E8F0', border: '1px solid #CBD5E1' }}>{p}限</td>
                                    {DAYS.map(d => {
                                      const unavail = isUnavailable(t, d, p);
                                      return (
                                        <td
                                          key={d}
                                          onClick={() => toggleUnavailable(t.id, d, p)}
                                          style={{
                                            padding: '0.3rem',
                                            textAlign: 'center',
                                            border: '1px solid #CBD5E1',
                                            backgroundColor: unavail ? '#FEE2E2' : '#fff',
                                            color: unavail ? '#991B1B' : '#94A3B8',
                                            cursor: 'pointer',
                                            fontWeight: unavail ? 700 : 400,
                                            userSelect: 'none',
                                            transition: 'background-color 0.15s'
                                          }}
                                        >
                                          {unavail ? '✕' : '○'}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.78rem', color: '#94A3B8' }}>○ = 配置可 　 ✕ = 配置不可（出張・会議など）</p>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {activeTab === 'teachers' && (
            <section className="settings-section" style={{ marginTop: '1.5rem', borderTop: '2px dashed #E2E8F0', paddingTop: '1.5rem' }}>
              <h3>教員グループの管理</h3>
              <p className="help-text">道徳・総合など複数の先生が担当する教科に使用するグループを作成します。</p>

              {/* グループ作成フォーム */}
              <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#166534', display: 'block', marginBottom: '0.3rem' }}>グループ名</label>
                  <input
                    type="text"
                    placeholder="例: 1年道徳グループ、総合担当チーム"
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    className="input-base"
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#166534', display: 'block', marginBottom: '0.5rem' }}>
                    グループに追加する教員（複数選択可）
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {teachers.map(t => (
                      <label
                        key={t.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '5px',
                          padding: '0.3rem 0.7rem',
                          border: `1px solid ${newGroupTeacherIds.includes(t.id) ? '#16A34A' : '#D1FAE5'}`,
                          borderRadius: '20px',
                          backgroundColor: newGroupTeacherIds.includes(t.id) ? '#DCFCE7' : '#fff',
                          cursor: 'pointer', fontSize: '0.85rem',
                          userSelect: 'none',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={newGroupTeacherIds.includes(t.id)}
                          onChange={() => toggleGroupTeacher(t.id)}
                          style={{ display: 'none' }}
                        />
                        {newGroupTeacherIds.includes(t.id) ? '✅' : '☐'} {t.name}
                      </label>
                    ))}
                  </div>
                  {newGroupTeacherIds.length > 0 && (
                    <p style={{ fontSize: '0.78rem', color: '#166534', margin: '0.4rem 0 0' }}>
                      {newGroupTeacherIds.length}名選択中
                    </p>
                  )}
                </div>

                <button
                  className="btn-primary"
                  onClick={handleAddGroup}
                  disabled={!newGroupName.trim() || newGroupTeacherIds.length === 0}
                  style={{ opacity: (!newGroupName.trim() || newGroupTeacherIds.length === 0) ? 0.5 : 1 }}
                >
                  グループを作成
                </button>
              </div>

              {/* 登録済みグループ一覧 */}
              {teacher_groups.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: '#94A3B8', textAlign: 'center' }}>グループが登録されていません</p>
              ) : (
                <ul className="rules-list" style={{ gap: '0.5rem' }}>
                  {teacher_groups.map(g => {
                    const memberNames = g.teacher_ids
                      .map(id => teachers.find(t => t.id === id)?.name || id)
                      .join('・');
                    return (
                      <li key={g.id} className="rule-item" style={{ alignItems: 'center' }}>
                        <div>
                          <strong style={{ fontSize: '0.95rem' }}>👥 {g.name}</strong>
                          <span style={{ fontSize: '0.82rem', color: '#64748B', marginLeft: '0.75rem' }}>
                            {memberNames || 'メンバーなし'}（{g.teacher_ids.length}名）
                          </span>
                        </div>
                        <button className="btn-danger" onClick={() => removeTeacherGroup(g.id)}>削除</button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {activeTab === 'ai' && (
            <section className="settings-section">
              <h3>Gemini APIキーの設定</h3>
              <div style={{ backgroundColor: '#F5F3FF', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid #DDD6FE' }}>
                <p className="help-text" style={{ marginTop: 0 }}>
                  Google AI Studio（<a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color: '#6366F1' }}>aistudio.google.com/apikey</a>）でAPIキーを取得し、入力してください。<br />
                  APIキーはこのブラウザの <strong>ローカルストレージ</strong> のみに保存されます。外部への送信はGoogleのGemini APIのみです。
                </p>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <input
                    type={apiKeyVisible ? 'text' : 'password'}
                    placeholder="AIzaSy..."
                    value={apiKeyInput}
                    onChange={e => setApiKeyInput(e.target.value)}
                    className="input-base"
                    style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.85rem' }}
                  />
                  <button
                    onClick={() => setApiKeyVisible(v => !v)}
                    style={{ padding: '0.4rem 0.6rem', border: '1px solid #CBD5E1', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    {apiKeyVisible ? '🙈' : '👁'}
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button className="btn-primary" onClick={handleTestApiKey} disabled={apiTestLoading} style={{ flex: 1 }}>
                    {apiTestLoading ? '⏳ 確認中...' : '🔌 接続テスト＆保存'}
                  </button>
                  <button onClick={handleSaveApiKey} style={{ flex: 1, padding: '0.5rem', border: '1px solid #CBD5E1', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '0.88rem' }}>
                    💾 保存のみ
                  </button>
                  {getStoredApiKey() && (
                    <button
                      onClick={() => { setStoredApiKey(''); setApiKeyInput(''); setApiTestResult(''); setApiTestMessage('削除しました。'); }}
                      style={{ padding: '0.5rem', border: '1px solid #FCA5A5', borderRadius: '6px', background: '#FEF2F2', color: '#B91C1C', cursor: 'pointer', fontSize: '0.88rem' }}
                    >
                      🗑 削除
                    </button>
                  )}
                </div>

                {apiTestMessage && (
                  <div style={{
                    marginTop: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem',
                    backgroundColor: apiTestResult === 'ok' ? '#DCFCE7' : apiTestResult === 'error' ? '#FEE2E2' : '#E0F2FE',
                    color: apiTestResult === 'ok' ? '#166534' : apiTestResult === 'error' ? '#991B1B' : '#0369A1',
                    border: `1px solid ${apiTestResult === 'ok' ? '#86EFAC' : apiTestResult === 'error' ? '#FCA5A5' : '#7DD3FC'}`,
                  }}>
                    {apiTestResult === 'ok' ? '✅' : apiTestResult === 'error' ? '❌' : 'ℹ'} {apiTestMessage}
                  </div>
                )}
              </div>

              <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '1rem' }}>
                <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: '#475569' }}>現在の設定状態</h4>
                {getStoredApiKey() ? (
                  <div style={{ fontSize: '0.85rem', color: '#166534', backgroundColor: '#DCFCE7', padding: '0.4rem 0.75rem', borderRadius: '6px' }}>
                    ✅ APIキーが設定されています（末尾: ...{getStoredApiKey().slice(-6)}）
                  </div>
                ) : (
                  <div style={{ fontSize: '0.85rem', color: '#92400E', backgroundColor: '#FEF3C7', padding: '0.4rem 0.75rem', borderRadius: '6px' }}>
                    ⚠ APIキー未設定。AI支援機能は使用できません。
                  </div>
                )}
              </div>
            </section>
          )}

        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
