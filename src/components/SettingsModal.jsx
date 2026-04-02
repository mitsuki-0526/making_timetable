import React, { useState } from 'react';
import { useTimetableStore } from '../store/useTimetableStore';
import { getStoredApiKey, setStoredApiKey, testApiKey, getStoredModel, setStoredModel } from '../lib/gemini';

const DAYS = ['月', '火', '水', '木', '金'];
const PERIODS = [1, 2, 3, 4, 5, 6];

const SettingsModal = ({ onClose }) => {
  const {
    structure, settings, teachers, teacher_groups, subject_constraints, subject_pairings, class_groups,
    addSubject, removeSubject, updateRequiredHours, updateSubjectConstraint,
    addMappingRule, removeMappingRule,
    addClass, removeClass,
    addTeacher, removeTeacher, updateTeacher,
    addTeacherGroup, updateTeacherGroup, removeTeacherGroup, moveTeacherGroup,
    addSubjectPairing, removeSubjectPairing,
    addClassGroup, removeClassGroup, addSplitSubject, removeSplitSubject,
  } = useTimetableStore();
  const [activeTab, setActiveTab] = useState('subjects'); // 'subjects', 'classes', 'teachers', 'classgroups', 'pairings', 'ai'

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

  // --- グループ編集 ---
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupTeacherIds, setEditGroupTeacherIds] = useState([]);

  const startEditGroup = (g) => {
    setEditingGroupId(g.id);
    setEditGroupName(g.name);
    setEditGroupTeacherIds([...g.teacher_ids]);
  };

  const cancelEditGroup = () => {
    setEditingGroupId(null);
    setEditGroupName('');
    setEditGroupTeacherIds([]);
  };

  const saveEditGroup = () => {
    if (!editGroupName.trim() || editGroupTeacherIds.length === 0) return;
    updateTeacherGroup(editingGroupId, { name: editGroupName.trim(), teacher_ids: editGroupTeacherIds });
    cancelEditGroup();
  };

  const toggleEditGroupTeacher = (tid) => {
    setEditGroupTeacherIds(prev =>
      prev.includes(tid) ? prev.filter(id => id !== tid) : [...prev, tid]
    );
  };

  // --- タブ4: AI設定 ---
  const [apiKeyInput, setApiKeyInput] = useState(getStoredApiKey());
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [apiModelInput, setApiModelInput] = useState(getStoredModel());
  const [apiTestLoading, setApiTestLoading] = useState(false);
  const [apiTestResult, setApiTestResult] = useState(''); // '' | 'ok' | 'error'
  const [apiTestMessage, setApiTestMessage] = useState('');

  const handleSaveApiKey = () => {
    setStoredApiKey(apiKeyInput.trim());
    setStoredModel(apiModelInput.trim());
    setApiTestResult('');
    setApiTestMessage('API設定を保存しました。');
    setTimeout(() => setApiTestMessage(''), 3000);
  };

  const handleTestApiKey = async () => {
    const key = apiKeyInput.trim();
    if (!key) { setApiTestResult('error'); setApiTestMessage('APIキーを入力してください。'); return; }
    setStoredModel(apiModelInput.trim());
    setApiTestLoading(true);
    setApiTestResult('');
    setApiTestMessage('');
    try {
      await testApiKey(key);
      setStoredApiKey(key);
      setApiTestResult('ok');
      setApiTestMessage('接続成功！設定は自動的に保存されました。');
    } catch (e) {
      setApiTestResult('error');
      setApiTestMessage(`接続失敗: ${e.message}`);
    } finally {
      setApiTestLoading(false);
    }
  };

  // --- タブ: 合同クラス ---
  const [cgGrade, setCgGrade] = useState(String(structure.grades[0]?.grade ?? '1'));
  const [cgClasses, setCgClasses] = useState([]);
  const [cgSplitSubj, setCgSplitSubj] = useState('');

  const cgGradeObj = structure.grades.find(g => String(g.grade) === cgGrade);
  const cgAllClasses = cgGradeObj
    ? [...(cgGradeObj.classes || []), ...(cgGradeObj.special_classes || [])]
    : [];

  const toggleCgClass = (c) => {
    setCgClasses(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  const handleAddClassGroup = () => {
    if (cgClasses.length < 2) return;
    addClassGroup({ grade: parseInt(cgGrade, 10), classes: cgClasses, split_subjects: [] });
    setCgClasses([]);
  };

  // --- タブ: 抱き合わせ教科 ---
  const [pairGrade, setPairGrade] = useState(String(structure.grades[0]?.grade ?? '1'));
  const [pairClassA, setPairClassA] = useState('');
  const [pairSubjectA, setPairSubjectA] = useState('');
  const [pairClassB, setPairClassB] = useState('');
  const [pairSubjectB, setPairSubjectB] = useState('');

  const pairGradeObj = structure.grades.find(g => String(g.grade) === pairGrade);
  const pairAllClasses = pairGradeObj
    ? [...(pairGradeObj.classes || []), ...(pairGradeObj.special_classes || [])]
    : [];

  const handleAddPairing = () => {
    if (!pairClassA || !pairSubjectA || !pairClassB || !pairSubjectB) return;
    if (pairClassA === pairClassB) return;
    addSubjectPairing({
      grade: parseInt(pairGrade, 10),
      classA: pairClassA,
      subjectA: pairSubjectA,
      classB: pairClassB,
      subjectB: pairSubjectB,
    });
    setPairClassA('');
    setPairSubjectA('');
    setPairClassB('');
    setPairSubjectB('');
  };

  // --- タブ3: 教員設定 ---
  const [teacherName, setTeacherName] = useState('');
  const [teacherSubjs, setTeacherSubjs] = useState('');
  const [teacherGrades, setTeacherGrades] = useState('');
  const [expandedTeacherId, setExpandedTeacherId] = useState(null);

  // --- 教員編集 ---
  const [editingTeacherId, setEditingTeacherId] = useState(null);
  const [editTeacherName, setEditTeacherName] = useState('');
  const [editTeacherSubjs, setEditTeacherSubjs] = useState('');
  const [editTeacherGrades, setEditTeacherGrades] = useState('');

  const startEditTeacher = (t) => {
    setEditingTeacherId(t.id);
    setEditTeacherName(t.name);
    setEditTeacherSubjs(t.subjects.join(', '));
    setEditTeacherGrades(t.target_grades.join(', '));
    setExpandedTeacherId(null); // 配置不可グリッドを閉じる
  };

  const cancelEditTeacher = () => {
    setEditingTeacherId(null);
    setEditTeacherName('');
    setEditTeacherSubjs('');
    setEditTeacherGrades('');
  };

  const saveEditTeacher = () => {
    if (!editTeacherName.trim()) return;
    const parsedGrades = editTeacherGrades.split(',').map(g => parseInt(g.trim(), 10)).filter(g => !isNaN(g));
    const parsedSubjs = editTeacherSubjs.split(',').map(s => s.trim()).filter(s => s);
    updateTeacher(editingTeacherId, {
      name: editTeacherName.trim(),
      subjects: parsedSubjs,
      target_grades: parsedGrades.length ? parsedGrades : [1, 2, 3],
    });
    cancelEditTeacher();
  };

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
          <button className={`tab-btn ${activeTab === 'classgroups' ? 'active' : ''}`} onClick={() => setActiveTab('classgroups')} style={{ flex: 1, padding: '1rem', border: 'none', background: activeTab === 'classgroups' ? '#fff' : 'transparent', borderBottom: activeTab === 'classgroups' ? '2px solid var(--primary)' : 'none', fontWeight: activeTab === 'classgroups' ? 'bold' : 'normal', cursor: 'pointer' }}>合同クラス</button>
          <button className={`tab-btn ${activeTab === 'pairings' ? 'active' : ''}`} onClick={() => setActiveTab('pairings')} style={{ flex: 1, padding: '1rem', border: 'none', background: activeTab === 'pairings' ? '#fff' : 'transparent', borderBottom: activeTab === 'pairings' ? '2px solid var(--primary)' : 'none', fontWeight: activeTab === 'pairings' ? 'bold' : 'normal', cursor: 'pointer' }}>抱き合わせ</button>
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
                  const isEditing = editingTeacherId === t.id;
                  return (
                    <li key={t.id} style={{ border: '1px solid #E2E8F0', borderRadius: '8px', listStyle: 'none', padding: 0, overflow: 'hidden' }}>
                      {/* 教員編集フォーム（編集中のみ表示） */}
                      {isEditing ? (
                        <div style={{ padding: '1rem', backgroundColor: '#EFF6FF', borderBottom: isExpanded ? '1px solid #E2E8F0' : 'none' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: '1', minWidth: '120px' }}>
                              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1D4ED8' }}>教員名</label>
                              <input
                                type="text"
                                value={editTeacherName}
                                onChange={e => setEditTeacherName(e.target.value)}
                                className="input-base"
                                autoFocus
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: '1', minWidth: '160px' }}>
                              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1D4ED8' }}>担当教科（カンマ区切り）</label>
                              <input
                                type="text"
                                value={editTeacherSubjs}
                                onChange={e => setEditTeacherSubjs(e.target.value)}
                                className="input-base"
                                placeholder="例: 国語, 書写"
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: '1', minWidth: '130px' }}>
                              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1D4ED8' }}>対象学年（カンマ区切り）</label>
                              <input
                                type="text"
                                value={editTeacherGrades}
                                onChange={e => setEditTeacherGrades(e.target.value)}
                                className="input-base"
                                placeholder="例: 1, 2, 3"
                              />
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              className="btn-primary"
                              onClick={saveEditTeacher}
                              disabled={!editTeacherName.trim()}
                              style={{ opacity: !editTeacherName.trim() ? 0.5 : 1 }}
                            >保存</button>
                            <button onClick={cancelEditTeacher} style={{ padding: '0.4rem 0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '0.85rem' }}>キャンセル</button>
                          </div>
                        </div>
                      ) : (
                        /* 教員ヘッダー行（通常表示） */
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
                            <button
                              onClick={e => { e.stopPropagation(); startEditTeacher(t); }}
                              style={{ padding: '0.25rem 0.6rem', border: '1px solid #3B82F6', borderRadius: '4px', background: '#EFF6FF', color: '#1D4ED8', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                            >編集</button>
                            <button className="btn-danger" style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }} onClick={e => { e.stopPropagation(); removeTeacher(t.id); }}>削除</button>
                          </div>
                        </div>
                      )}

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
                  {teacher_groups.map((g, idx) => {
                    const isEditing = editingGroupId === g.id;
                    const memberNames = g.teacher_ids
                      .map(id => teachers.find(t => t.id === id)?.name || id)
                      .join('・');
                    return (
                      <li key={g.id} style={{ border: '1px solid #E2E8F0', borderRadius: '8px', listStyle: 'none', padding: 0, overflow: 'hidden' }}>
                        {isEditing ? (
                          /* 編集フォーム */
                          <div style={{ padding: '1rem', backgroundColor: '#F0FDF4' }}>
                            <div style={{ marginBottom: '0.6rem' }}>
                              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#166534', display: 'block', marginBottom: '0.3rem' }}>グループ名</label>
                              <input
                                type="text"
                                value={editGroupName}
                                onChange={e => setEditGroupName(e.target.value)}
                                className="input-base"
                                style={{ width: '100%' }}
                                autoFocus
                              />
                            </div>
                            <div style={{ marginBottom: '0.75rem' }}>
                              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#166534', display: 'block', marginBottom: '0.4rem' }}>メンバー</label>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                {teachers.map(t => (
                                  <label key={t.id} style={{
                                    display: 'flex', alignItems: 'center', gap: '4px',
                                    padding: '0.25rem 0.6rem',
                                    border: `1px solid ${editGroupTeacherIds.includes(t.id) ? '#16A34A' : '#D1FAE5'}`,
                                    borderRadius: '20px',
                                    backgroundColor: editGroupTeacherIds.includes(t.id) ? '#DCFCE7' : '#fff',
                                    cursor: 'pointer', fontSize: '0.82rem', userSelect: 'none',
                                  }}>
                                    <input type="checkbox" checked={editGroupTeacherIds.includes(t.id)} onChange={() => toggleEditGroupTeacher(t.id)} style={{ display: 'none' }} />
                                    {editGroupTeacherIds.includes(t.id) ? '✅' : '☐'} {t.name}
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button
                                className="btn-primary"
                                onClick={saveEditGroup}
                                disabled={!editGroupName.trim() || editGroupTeacherIds.length === 0}
                                style={{ opacity: (!editGroupName.trim() || editGroupTeacherIds.length === 0) ? 0.5 : 1 }}
                              >保存</button>
                              <button onClick={cancelEditGroup} style={{ padding: '0.4rem 0.8rem', border: '1px solid #CBD5E1', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '0.85rem' }}>キャンセル</button>
                            </div>
                          </div>
                        ) : (
                          /* 通常表示 */
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.8rem' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <strong style={{ fontSize: '0.92rem' }}>👥 {g.name}</strong>
                              <span style={{ fontSize: '0.8rem', color: '#64748B', marginLeft: '0.6rem' }}>
                                {memberNames || 'メンバーなし'}（{g.teacher_ids.length}名）
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                              {/* 並べ替えボタン */}
                              <button
                                onClick={() => moveTeacherGroup(g.id, 'up')}
                                disabled={idx === 0}
                                title="上へ"
                                style={{ padding: '0.2rem 0.5rem', border: '1px solid #CBD5E1', borderRadius: '4px', background: '#fff', cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? 0.3 : 1, fontSize: '0.8rem' }}
                              >▲</button>
                              <button
                                onClick={() => moveTeacherGroup(g.id, 'down')}
                                disabled={idx === teacher_groups.length - 1}
                                title="下へ"
                                style={{ padding: '0.2rem 0.5rem', border: '1px solid #CBD5E1', borderRadius: '4px', background: '#fff', cursor: idx === teacher_groups.length - 1 ? 'not-allowed' : 'pointer', opacity: idx === teacher_groups.length - 1 ? 0.3 : 1, fontSize: '0.8rem' }}
                              >▼</button>
                              <button
                                onClick={() => startEditGroup(g)}
                                style={{ padding: '0.2rem 0.6rem', border: '1px solid #3B82F6', borderRadius: '4px', background: '#EFF6FF', color: '#1D4ED8', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
                              >編集</button>
                              <button className="btn-danger" style={{ padding: '0.2rem 0.6rem', fontSize: '0.82rem' }} onClick={() => removeTeacherGroup(g.id)}>削除</button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {activeTab === 'classgroups' && (
            <section className="settings-section">
              <h3>合同クラスの設定</h3>
              <p className="help-text">同じ学年の複数クラスを合同クラスとして登録します。合同クラス内では、<strong>分割教科</strong>に登録した教科のみ別々の先生を割り当て可能で、それ以外は同一教員を重複扱いせず配置できます。</p>

              {/* 合同クラス作成フォーム */}
              <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#166534' }}>学年</label>
                    <select value={cgGrade} onChange={e => { setCgGrade(e.target.value); setCgClasses([]); }} className="input-base">
                      {structure.grades.map(g => <option key={g.grade} value={String(g.grade)}>{g.grade}年</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#166534' }}>合同にするクラス（2つ以上選択）</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {cgAllClasses.map(c => (
                        <label key={c} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0.3rem 0.7rem', border: `1px solid ${cgClasses.includes(c) ? '#16A34A' : '#D1FAE5'}`, borderRadius: '20px', backgroundColor: cgClasses.includes(c) ? '#DCFCE7' : '#fff', cursor: 'pointer', fontSize: '0.85rem', userSelect: 'none' }}>
                          <input type="checkbox" checked={cgClasses.includes(c)} onChange={() => toggleCgClass(c)} style={{ display: 'none' }} />
                          {cgClasses.includes(c) ? '✅' : '☐'} {c}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  className="btn-primary"
                  onClick={handleAddClassGroup}
                  disabled={cgClasses.length < 2}
                  style={{ marginTop: '0.75rem', opacity: cgClasses.length < 2 ? 0.5 : 1 }}
                >
                  合同クラスを登録
                </button>
              </div>

              {/* 登録済み合同クラス一覧 */}
              {(class_groups || []).length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: '#94A3B8', textAlign: 'center' }}>合同クラスが登録されていません</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {(class_groups || []).map(grp => (
                    <div key={grp.id} style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <strong>{grp.grade}年：{grp.classes.join(' ・ ')} （合同）</strong>
                        <button className="btn-danger" onClick={() => removeClassGroup(grp.id)}>削除</button>
                      </div>
                      <div>
                        <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569', margin: '0 0 0.4rem' }}>分割教科（別々に先生を配置する教科）</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
                          {grp.split_subjects.length === 0 && (
                            <span style={{ fontSize: '0.82rem', color: '#94A3B8' }}>なし（全教科合同）</span>
                          )}
                          {grp.split_subjects.map(s => (
                            <span key={s} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0.2rem 0.6rem', backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: '20px', fontSize: '0.82rem' }}>
                              {s}
                              <button onClick={() => removeSplitSubject(grp.id, s)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#B91C1C', padding: '0', lineHeight: 1 }}>✕</button>
                            </span>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <select value={cgSplitSubj} onChange={e => setCgSplitSubj(e.target.value)} className="input-base" style={{ flex: 1 }}>
                            <option value="">分割教科を追加...</option>
                            {subjectList.filter(s => !grp.split_subjects.includes(s)).map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                          <button
                            className="btn-primary"
                            onClick={() => { if (cgSplitSubj) { addSplitSubject(grp.id, cgSplitSubj); setCgSplitSubj(''); } }}
                            disabled={!cgSplitSubj}
                            style={{ opacity: !cgSplitSubj ? 0.5 : 1 }}
                          >
                            追加
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === 'pairings' && (
            <section className="settings-section">
              <h3>抱き合わせ教科の設定</h3>
              <p className="help-text">同じ学年の2クラスで「AクラスにX教科を配置したとき、BクラスにY教科を自動配置」するルールを設定します。双方向に適用されます。</p>

              <div style={{ backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#0369A1' }}>学年</label>
                    <select value={pairGrade} onChange={e => { setPairGrade(e.target.value); setPairClassA(''); setPairClassB(''); }} className="input-base">
                      {structure.grades.map(g => <option key={g.grade} value={String(g.grade)}>{g.grade}年</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#0369A1' }}>クラスA</label>
                    <select value={pairClassA} onChange={e => setPairClassA(e.target.value)} className="input-base">
                      <option value="">選択</option>
                      {pairAllClasses.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#0369A1' }}>教科A</label>
                    <select value={pairSubjectA} onChange={e => setPairSubjectA(e.target.value)} className="input-base">
                      <option value="">選択</option>
                      {subjectList.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: '1.1rem', paddingBottom: '0.2rem' }}>⇔</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#0369A1' }}>クラスB</label>
                    <select value={pairClassB} onChange={e => setPairClassB(e.target.value)} className="input-base">
                      <option value="">選択</option>
                      {pairAllClasses.filter(c => c !== pairClassA).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#0369A1' }}>教科B</label>
                    <select value={pairSubjectB} onChange={e => setPairSubjectB(e.target.value)} className="input-base">
                      <option value="">選択</option>
                      {subjectList.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <button
                    className="btn-primary"
                    onClick={handleAddPairing}
                    disabled={!pairClassA || !pairSubjectA || !pairClassB || !pairSubjectB}
                    style={{ opacity: (!pairClassA || !pairSubjectA || !pairClassB || !pairSubjectB) ? 0.5 : 1 }}
                  >
                    登録
                  </button>
                </div>
              </div>

              {(subject_pairings || []).length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: '#94A3B8', textAlign: 'center' }}>抱き合わせルールが登録されていません</p>
              ) : (
                <ul className="rules-list" style={{ gap: '0.5rem' }}>
                  {(subject_pairings || []).map(p => (
                    <li key={p.id} className="rule-item" style={{ alignItems: 'center' }}>
                      <span>
                        <strong>{p.grade}年</strong>：
                        <strong>{p.classA}</strong> の <strong>{p.subjectA}</strong>
                        {' ⇔ '}
                        <strong>{p.classB}</strong> の <strong>{p.subjectB}</strong>
                      </span>
                      <button className="btn-danger" onClick={() => removeSubjectPairing(p.id)}>削除</button>
                    </li>
                  ))}
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

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#4338CA', display: 'block', marginBottom: '0.4rem' }}>使用するモデル（制限エラーが出る場合は変更をお試しください）</label>
                  <select
                    value={apiModelInput}
                    onChange={e => setApiModelInput(e.target.value)}
                    className="input-base"
                    style={{ width: '100%', maxWidth: '300px' }}
                  >
                    <option value="gemini-2.0-flash-lite">gemini-2.0-flash-lite（軽量・推奨）</option>
                    <option value="gemini-1.5-flash-8b">gemini-1.5-flash-8b（軽量・無料枠多）</option>
                    <option value="gemini-1.5-flash">gemini-1.5-flash（標準的）</option>
                    <option value="gemini-2.5-flash">gemini-2.5-flash（最新・要枠確認）</option>
                    <option value="gemini-2.0-flash">gemini-2.0-flash（高性能・要枠確認）</option>
                    <option value="gemini-1.5-pro">gemini-1.5-pro（高性能）</option>
                  </select>
                </div>

                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#4338CA', display: 'block', marginBottom: '0.4rem' }}>APIキー</label>
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
