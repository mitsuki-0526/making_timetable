import React, { useState } from 'react';
import { useTimetableStore } from '../store/useTimetableStore';

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
    addCrossGradeGroup, removeCrossGradeGroup, updateCrossGradeGroup, cross_grade_groups,
  } = useTimetableStore();
  const [activeTab, setActiveTab] = useState('subjects'); // 'subjects', 'classes', 'teachers', 'classgroups', 'pairings'

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
  const [newGroupSubjects, setNewGroupSubjects] = useState([]);
  const [newGroupGrades, setNewGroupGrades] = useState([]);

  const toggleGroupTeacher = (tid) =>
    setNewGroupTeacherIds(prev => prev.includes(tid) ? prev.filter(id => id !== tid) : [...prev, tid]);
  const toggleGroupSubject = (s) =>
    setNewGroupSubjects(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const toggleGroupGrade = (g) =>
    setNewGroupGrades(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);

  const handleAddGroup = () => {
    if (!newGroupName.trim() || newGroupTeacherIds.length === 0) return;
    addTeacherGroup({
      name: newGroupName.trim(),
      teacher_ids: newGroupTeacherIds,
      subjects: newGroupSubjects,
      target_grades: newGroupGrades,
    });
    setNewGroupName('');
    setNewGroupTeacherIds([]);
    setNewGroupSubjects([]);
    setNewGroupGrades([]);
  };

  // --- グループ編集 ---
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupTeacherIds, setEditGroupTeacherIds] = useState([]);
  const [editGroupSubjects, setEditGroupSubjects] = useState([]);
  const [editGroupGrades, setEditGroupGrades] = useState([]);

  const startEditGroup = (g) => {
    setEditingGroupId(g.id);
    setEditGroupName(g.name);
    setEditGroupTeacherIds([...g.teacher_ids]);
    setEditGroupSubjects([...(g.subjects || [])]);
    setEditGroupGrades([...(g.target_grades || [])]);
  };

  const cancelEditGroup = () => {
    setEditingGroupId(null);
    setEditGroupName('');
    setEditGroupTeacherIds([]);
    setEditGroupSubjects([]);
    setEditGroupGrades([]);
  };

  const saveEditGroup = () => {
    if (!editGroupName.trim() || editGroupTeacherIds.length === 0) return;
    updateTeacherGroup(editingGroupId, {
      name: editGroupName.trim(),
      teacher_ids: editGroupTeacherIds,
      subjects: editGroupSubjects,
      target_grades: editGroupGrades,
    });
    cancelEditGroup();
  };

  const toggleEditGroupTeacher = (tid) =>
    setEditGroupTeacherIds(prev => prev.includes(tid) ? prev.filter(id => id !== tid) : [...prev, tid]);
  const toggleEditGroupSubject = (s) =>
    setEditGroupSubjects(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const toggleEditGroupGrade = (g) =>
    setEditGroupGrades(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);

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

  // --- 全体合同授業 ---
  const [cgxName, setCgxName] = useState('');
  const [cgxSubject, setCgxSubject] = useState('');
  const [cgxCount, setCgxCount] = useState(1);
  const [cgxParticipants, setCgxParticipants] = useState([]);

  const toggleCgxParticipant = (grade, class_name) => {
    setCgxParticipants(prev => {
      const exists = prev.some(p => p.grade === grade && p.class_name === class_name);
      if (exists) return prev.filter(p => !(p.grade === grade && p.class_name === class_name));
      return [...prev, { grade, class_name }];
    });
  };

  // 学年全体を一括選択/解除
  const toggleGradeAll = (gradeObj) => {
    const allClasses = [...(gradeObj.classes || []), ...(gradeObj.special_classes || [])];
    const allSelected = allClasses.every(cn => cgxParticipants.some(p => p.grade === gradeObj.grade && p.class_name === cn));
    if (allSelected) {
      setCgxParticipants(prev => prev.filter(p => p.grade !== gradeObj.grade));
    } else {
      setCgxParticipants(prev => {
        const next = prev.filter(p => p.grade !== gradeObj.grade);
        allClasses.forEach(cn => next.push({ grade: gradeObj.grade, class_name: cn }));
        return next;
      });
    }
  };

  // 全校一括選択/解除
  const toggleAllSchool = () => {
    const allParticipants = structure.grades.flatMap(g =>
      [...(g.classes || []), ...(g.special_classes || [])].map(cn => ({ grade: g.grade, class_name: cn }))
    );
    const totalCount = allParticipants.length;
    const selectedCount = allParticipants.filter(p => cgxParticipants.some(c => c.grade === p.grade && c.class_name === p.class_name)).length;
    if (selectedCount === totalCount) {
      setCgxParticipants([]);
    } else {
      setCgxParticipants(allParticipants);
    }
  };

  const handleAddCrossGradeGroup = () => {
    if (cgxParticipants.length < 2 || !cgxSubject) return;
    addCrossGradeGroup({ name: cgxName || '合同授業', participants: cgxParticipants, subject: cgxSubject, count: cgxCount });
    setCgxName(''); setCgxSubject(''); setCgxCount(1); setCgxParticipants([]);
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
  const [teacherSubjsArr, setTeacherSubjsArr] = useState([]);   // 選択済み教科 (配列)
  const [teacherGradesArr, setTeacherGradesArr] = useState([]); // 選択済み学年 (配列)
  const [expandedTeacherId, setExpandedTeacherId] = useState(null);

  const toggleTeacherSubj = (subj) =>
    setTeacherSubjsArr(prev => prev.includes(subj) ? prev.filter(s => s !== subj) : [...prev, subj]);

  const toggleTeacherGrade = (grade) =>
    setTeacherGradesArr(prev => prev.includes(grade) ? prev.filter(g => g !== grade) : [...prev, grade]);

  // --- 教員編集 ---
  const [editingTeacherId, setEditingTeacherId] = useState(null);
  const [editTeacherName, setEditTeacherName] = useState('');
  const [editTeacherSubjsArr, setEditTeacherSubjsArr] = useState([]);
  const [editTeacherGradesArr, setEditTeacherGradesArr] = useState([]);

  const toggleEditSubj = (subj) =>
    setEditTeacherSubjsArr(prev => prev.includes(subj) ? prev.filter(s => s !== subj) : [...prev, subj]);

  const toggleEditGrade = (grade) =>
    setEditTeacherGradesArr(prev => prev.includes(grade) ? prev.filter(g => g !== grade) : [...prev, grade]);

  const startEditTeacher = (t) => {
    setEditingTeacherId(t.id);
    setEditTeacherName(t.name);
    setEditTeacherSubjsArr([...t.subjects]);
    setEditTeacherGradesArr([...t.target_grades]);
    setExpandedTeacherId(null);
  };

  const cancelEditTeacher = () => {
    setEditingTeacherId(null);
    setEditTeacherName('');
    setEditTeacherSubjsArr([]);
    setEditTeacherGradesArr([]);
  };

  const saveEditTeacher = () => {
    if (!editTeacherName.trim()) return;
    updateTeacher(editingTeacherId, {
      name: editTeacherName.trim(),
      subjects: editTeacherSubjsArr,
      target_grades: editTeacherGradesArr.length ? editTeacherGradesArr : structure.grades.map(g => g.grade),
    });
    cancelEditTeacher();
  };

  const handleAddTeacher = () => {
    if (teacherName.trim()) {
      addTeacher({
        name: teacherName.trim(),
        subjects: teacherSubjsArr,
        target_grades: teacherGradesArr.length ? teacherGradesArr : structure.grades.map(g => g.grade),
        unavailable_times: []
      });
      setTeacherName('');
      setTeacherSubjsArr([]);
      setTeacherGradesArr([]);
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
          <button className="close-btn" onClick={onClose} aria-label="閉じる">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="modal-tabs" style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
          <button className={`tab-btn ${activeTab === 'subjects' ? 'active' : ''}`} onClick={() => setActiveTab('subjects')} style={{ flex: 1, padding: '1rem', border: 'none', background: activeTab === 'subjects' ? '#fff' : 'transparent', borderBottom: activeTab === 'subjects' ? '2px solid var(--primary)' : 'none', fontWeight: activeTab === 'subjects' ? 'bold' : 'normal', cursor: 'pointer' }}>教科・連動ルール</button>
          <button className={`tab-btn ${activeTab === 'classes' ? 'active' : ''}`} onClick={() => setActiveTab('classes')} style={{ flex: 1, padding: '1rem', border: 'none', background: activeTab === 'classes' ? '#fff' : 'transparent', borderBottom: activeTab === 'classes' ? '2px solid var(--primary)' : 'none', fontWeight: activeTab === 'classes' ? 'bold' : 'normal', cursor: 'pointer' }}>クラス編成</button>
          <button className={`tab-btn ${activeTab === 'teachers' ? 'active' : ''}`} onClick={() => setActiveTab('teachers')} style={{ flex: 1, padding: '1rem', border: 'none', background: activeTab === 'teachers' ? '#fff' : 'transparent', borderBottom: activeTab === 'teachers' ? '2px solid var(--primary)' : 'none', fontWeight: activeTab === 'teachers' ? 'bold' : 'normal', cursor: 'pointer' }}>教員リスト</button>
          <button className={`tab-btn ${activeTab === 'classgroups' ? 'active' : ''}`} onClick={() => setActiveTab('classgroups')} style={{ flex: 1, padding: '1rem', border: 'none', background: activeTab === 'classgroups' ? '#fff' : 'transparent', borderBottom: activeTab === 'classgroups' ? '2px solid var(--primary)' : 'none', fontWeight: activeTab === 'classgroups' ? 'bold' : 'normal', cursor: 'pointer' }}>合同クラス</button>
          <button className={`tab-btn ${activeTab === 'pairings' ? 'active' : ''}`} onClick={() => setActiveTab('pairings')} style={{ flex: 1, padding: '1rem', border: 'none', background: activeTab === 'pairings' ? '#fff' : 'transparent', borderBottom: activeTab === 'pairings' ? '2px solid var(--primary)' : 'none', fontWeight: activeTab === 'pairings' ? 'bold' : 'normal', cursor: 'pointer' }}>抱き合わせ</button>
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
                        <div key={`${g.grade}-${c}`} style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                          padding: '0.3rem 0.5rem 0.3rem 0.8rem',
                          background: 'var(--md-surface-container-lowest)',
                          border: '1px solid var(--md-outline-variant)',
                          borderRadius: '999px', fontSize: '14px',
                        }}>
                          <span>{c}</span>
                          <button
                            style={{
                              background: 'var(--md-error-container)', color: 'var(--md-on-error-container)',
                              border: 'none', borderRadius: '50%', width: '20px', height: '20px',
                              cursor: 'pointer', fontSize: '11px', lineHeight: 1,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0,
                            }}
                            onClick={() => removeClass(g.grade, c, false)}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
                          </button>
                        </div>
                      ))}
                      {g.special_classes && g.special_classes.map(c => (
                        <div key={`${g.grade}-${c}`} style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                          padding: '0.3rem 0.5rem 0.3rem 0.8rem',
                          background: '#FEF3C7',
                          border: '1px solid #FCD34D',
                          borderRadius: '999px', fontSize: '14px',
                        }}>
                          <span>{c} (特支)</span>
                          <button
                            style={{
                              background: 'var(--md-error-container)', color: 'var(--md-on-error-container)',
                              border: 'none', borderRadius: '50%', width: '20px', height: '20px',
                              cursor: 'pointer', fontSize: '11px', lineHeight: 1,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0,
                            }}
                            onClick={() => removeClass(g.grade, c, true)}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
                          </button>
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
              <div style={{ background: 'var(--md-surface-container)', padding: '1.25rem', borderRadius: 'var(--md-shape-lg)', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <p className="help-text" style={{ marginTop: 0 }}>新しい教員を登録します。</p>

                {/* 教員名 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--md-on-surface-variant)', minWidth: '64px' }}>教員名</label>
                  <input
                    type="text"
                    placeholder="例: 山田"
                    value={teacherName}
                    onChange={e => setTeacherName(e.target.value)}
                    className="input-base"
                    style={{ flex: 1, minWidth: '140px' }}
                  />
                </div>

                {/* 担当教科 — チップ選択 */}
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--md-on-surface-variant)', display: 'block', marginBottom: '0.5rem' }}>
                    担当教科
                    {teacherSubjsArr.length > 0 && (
                      <span style={{ marginLeft: '0.5rem', fontSize: '12px', color: 'var(--md-primary)' }}>
                        {teacherSubjsArr.join('・')}
                      </span>
                    )}
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {subjectList.map(subj => {
                      const selected = teacherSubjsArr.includes(subj);
                      return (
                        <button
                          key={subj}
                          type="button"
                          onClick={() => toggleTeacherSubj(subj)}
                          style={{
                            padding: '0.3rem 0.875rem',
                            borderRadius: 'var(--md-shape-full)',
                            border: `1px solid ${selected ? 'var(--md-primary)' : 'var(--md-outline-variant)'}`,
                            background: selected ? 'var(--md-primary-container)' : 'transparent',
                            color: selected ? 'var(--md-on-primary-container)' : 'var(--md-on-surface-variant)',
                            fontSize: '13px', fontWeight: selected ? 600 : 400,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            fontFamily: 'var(--md-font-plain)',
                            display: 'flex', alignItems: 'center', gap: '0.25rem',
                          }}
                        >
                          {selected && <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check</span>}
                          {subj}
                        </button>
                      );
                    })}
                    {subjectList.length === 0 && (
                      <span style={{ fontSize: '12px', color: 'var(--md-on-surface-variant)' }}>先に教科タブで教科を登録してください</span>
                    )}
                  </div>
                </div>

                {/* 対象学年 — チップ選択 */}
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--md-on-surface-variant)', display: 'block', marginBottom: '0.5rem' }}>
                    対象学年
                    {teacherGradesArr.length === 0 && (
                      <span style={{ marginLeft: '0.5rem', fontSize: '12px', color: 'var(--md-on-surface-variant)', opacity: 0.7 }}>（未選択の場合は全学年）</span>
                    )}
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {structure.grades.map(g => {
                      const selected = teacherGradesArr.includes(g.grade);
                      return (
                        <button
                          key={g.grade}
                          type="button"
                          onClick={() => toggleTeacherGrade(g.grade)}
                          style={{
                            padding: '0.3rem 0.875rem',
                            borderRadius: 'var(--md-shape-full)',
                            border: `1px solid ${selected ? 'var(--md-secondary)' : 'var(--md-outline-variant)'}`,
                            background: selected ? 'var(--md-secondary-container)' : 'transparent',
                            color: selected ? 'var(--md-on-secondary-container)' : 'var(--md-on-surface-variant)',
                            fontSize: '13px', fontWeight: selected ? 600 : 400,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            fontFamily: 'var(--md-font-plain)',
                            display: 'flex', alignItems: 'center', gap: '0.25rem',
                          }}
                        >
                          {selected && <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check</span>}
                          {g.grade}年
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <button
                    className="btn-primary"
                    onClick={handleAddTeacher}
                    disabled={!teacherName.trim()}
                    style={{ opacity: !teacherName.trim() ? 0.5 : 1 }}
                  >
                    教員を追加
                  </button>
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
                        <div style={{ padding: '1rem', background: 'var(--md-surface-container)', borderBottom: isExpanded ? `1px solid var(--md-outline-variant)` : 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {/* 教員名 */}
                          <div>
                            <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--md-on-surface-variant)', display: 'block', marginBottom: '0.4rem' }}>教員名</label>
                            <input
                              type="text"
                              value={editTeacherName}
                              onChange={e => setEditTeacherName(e.target.value)}
                              className="input-base"
                              autoFocus
                            />
                          </div>

                          {/* 担当教科 — チップ選択 */}
                          <div>
                            <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--md-on-surface-variant)', display: 'block', marginBottom: '0.4rem' }}>
                              担当教科
                              {editTeacherSubjsArr.length > 0 && (
                                <span style={{ marginLeft: '0.5rem', fontSize: '12px', color: 'var(--md-primary)' }}>
                                  {editTeacherSubjsArr.join('・')}
                                </span>
                              )}
                            </label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                              {subjectList.map(subj => {
                                const selected = editTeacherSubjsArr.includes(subj);
                                return (
                                  <button
                                    key={subj}
                                    type="button"
                                    onClick={() => toggleEditSubj(subj)}
                                    style={{
                                      padding: '0.3rem 0.875rem',
                                      borderRadius: 'var(--md-shape-full)',
                                      border: `1px solid ${selected ? 'var(--md-primary)' : 'var(--md-outline-variant)'}`,
                                      background: selected ? 'var(--md-primary-container)' : 'transparent',
                                      color: selected ? 'var(--md-on-primary-container)' : 'var(--md-on-surface-variant)',
                                      fontSize: '13px', fontWeight: selected ? 600 : 400,
                                      cursor: 'pointer',
                                      transition: 'all 0.15s',
                                      fontFamily: 'var(--md-font-plain)',
                                      display: 'flex', alignItems: 'center', gap: '0.25rem',
                                    }}
                                  >
                                    {selected && <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check</span>}
                                    {subj}
                                  </button>
                                );
                              })}
                              {subjectList.length === 0 && (
                                <span style={{ fontSize: '12px', color: 'var(--md-on-surface-variant)' }}>先に教科タブで教科を登録してください</span>
                              )}
                            </div>
                          </div>

                          {/* 対象学年 — チップ選択 */}
                          <div>
                            <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--md-on-surface-variant)', display: 'block', marginBottom: '0.4rem' }}>
                              対象学年
                              {editTeacherGradesArr.length === 0 && (
                                <span style={{ marginLeft: '0.5rem', fontSize: '12px', color: 'var(--md-on-surface-variant)', opacity: 0.7 }}>（未選択の場合は全学年）</span>
                              )}
                            </label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                              {structure.grades.map(g => {
                                const selected = editTeacherGradesArr.includes(g.grade);
                                return (
                                  <button
                                    key={g.grade}
                                    type="button"
                                    onClick={() => toggleEditGrade(g.grade)}
                                    style={{
                                      padding: '0.3rem 0.875rem',
                                      borderRadius: 'var(--md-shape-full)',
                                      border: `1px solid ${selected ? 'var(--md-secondary)' : 'var(--md-outline-variant)'}`,
                                      background: selected ? 'var(--md-secondary-container)' : 'transparent',
                                      color: selected ? 'var(--md-on-secondary-container)' : 'var(--md-on-surface-variant)',
                                      fontSize: '13px', fontWeight: selected ? 600 : 400,
                                      cursor: 'pointer',
                                      transition: 'all 0.15s',
                                      fontFamily: 'var(--md-font-plain)',
                                      display: 'flex', alignItems: 'center', gap: '0.25rem',
                                    }}
                                  >
                                    {selected && <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check</span>}
                                    {g.grade}年
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* 保存・キャンセル */}
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              className="btn-primary"
                              onClick={saveEditTeacher}
                              disabled={!editTeacherName.trim()}
                              style={{ opacity: !editTeacherName.trim() ? 0.5 : 1 }}
                            >保存</button>
                            <button
                              onClick={cancelEditTeacher}
                              style={{ padding: '0.4rem 0.8rem', border: `1px solid var(--md-outline-variant)`, borderRadius: 'var(--md-shape-sm)', background: 'transparent', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--md-on-surface-variant)', fontFamily: 'var(--md-font-plain)' }}
                            >キャンセル</button>
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#94A3B8' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{isExpanded ? 'expand_less' : 'expand_more'}</span>
                              {isExpanded ? '閉じる' : 'スケジュール設定'}
                            </div>
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
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569', fontWeight: 600 }}>
                              配置不可な時間をクリックして設定してください（赤 = 配置不可）
                            </p>
                            <button 
                              onClick={() => setExpandedTeacherId(null)}
                              style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6b7280', padding: '4px', borderRadius: '50%' }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
                            </button>
                          </div>
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
                                          {unavail ? (
                                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                                          ) : (
                                            <span className="material-symbols-outlined" style={{ fontSize: '16px', opacity: 0.3 }}>radio_button_unchecked</span>
                                          )}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.78rem', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#16A34A' }}>check_circle</span> = 配置可
                            <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#EF4444', marginLeft: '8px' }}>cancel</span> = 配置不可
                          </p>
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
                        <span className="material-symbols-outlined" style={{ fontSize: '20px', color: newGroupTeacherIds.includes(t.id) ? '#16A34A' : '#94A3B8' }}>
                          {newGroupTeacherIds.includes(t.id) ? 'check_box' : 'check_box_outline_blank'}
                        </span>
                        {t.name}
                      </label>
                    ))}
                  </div>
                  {newGroupTeacherIds.length > 0 && (
                    <p style={{ fontSize: '0.78rem', color: '#166534', margin: '0.4rem 0 0' }}>
                      {newGroupTeacherIds.length}名選択中
                    </p>
                  )}
                </div>

                {/* 担当教科 */}
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#166534', display: 'block', marginBottom: '0.4rem' }}>
                    担当教科（自動生成で使用）
                    {newGroupSubjects.length > 0 && <span style={{ marginLeft: '0.5rem', fontSize: '12px' }}>{newGroupSubjects.join('・')}</span>}
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {subjectList.map(s => {
                      const sel = newGroupSubjects.includes(s);
                      return (
                        <button key={s} type="button" onClick={() => toggleGroupSubject(s)} style={{
                          padding: '0.25rem 0.7rem', borderRadius: '999px', fontSize: '12px', cursor: 'pointer',
                          border: `1px solid ${sel ? '#16A34A' : '#D1FAE5'}`,
                          background: sel ? '#DCFCE7' : '#fff',
                          color: sel ? '#166534' : '#64748B', fontWeight: sel ? 600 : 400,
                          display: 'flex', alignItems: 'center', gap: '2px'
                        }}>
                          {sel && <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check</span>}
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 対象学年 */}
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#166534', display: 'block', marginBottom: '0.4rem' }}>対象学年</label>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {structure.grades.map(g => {
                      const sel = newGroupGrades.includes(g.grade);
                      return (
                        <button key={g.grade} type="button" onClick={() => toggleGroupGrade(g.grade)} style={{
                          padding: '0.25rem 0.7rem', borderRadius: '999px', fontSize: '12px', cursor: 'pointer',
                          border: `1px solid ${sel ? '#16A34A' : '#D1FAE5'}`,
                          background: sel ? '#DCFCE7' : '#fff',
                          color: sel ? '#166534' : '#64748B', fontWeight: sel ? 600 : 400,
                          display: 'flex', alignItems: 'center', gap: '2px'
                        }}>
                          {sel && <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check</span>}
                          {g.grade}年
                        </button>
                      );
                    })}
                  </div>
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
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: editGroupTeacherIds.includes(t.id) ? '#16A34A' : '#94A3B8' }}>
                                      {editGroupTeacherIds.includes(t.id) ? 'check_box' : 'check_box_outline_blank'}
                                    </span>
                                    {t.name}
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div style={{ marginBottom: '0.75rem' }}>
                              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#166534', display: 'block', marginBottom: '0.4rem' }}>
                                担当教科
                                {editGroupSubjects.length > 0 && <span style={{ marginLeft: '0.4rem', fontSize: '11px' }}>{editGroupSubjects.join('・')}</span>}
                              </label>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                {subjectList.map(s => {
                                  const sel = editGroupSubjects.includes(s);
                                  return (
                                    <button key={s} type="button" onClick={() => toggleEditGroupSubject(s)} style={{
                                      padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '11px', cursor: 'pointer',
                                      border: `1px solid ${sel ? '#16A34A' : '#D1FAE5'}`,
                                      background: sel ? '#DCFCE7' : '#fff',
                                      color: sel ? '#166534' : '#64748B', fontWeight: sel ? 600 : 400,
                                      display: 'flex', alignItems: 'center', gap: '2px'
                                    }}>
                                      {sel && <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>check</span>}
                                      {s}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div style={{ marginBottom: '0.75rem' }}>
                              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#166534', display: 'block', marginBottom: '0.4rem' }}>対象学年</label>
                              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                                {structure.grades.map(gr => {
                                  const sel = editGroupGrades.includes(gr.grade);
                                  return (
                                    <button key={gr.grade} type="button" onClick={() => toggleEditGroupGrade(gr.grade)} style={{
                                      padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '11px', cursor: 'pointer',
                                      border: `1px solid ${sel ? '#16A34A' : '#D1FAE5'}`,
                                      background: sel ? '#DCFCE7' : '#fff',
                                      color: sel ? '#166534' : '#64748B', fontWeight: sel ? 600 : 400,
                                      display: 'flex', alignItems: 'center', gap: '2px'
                                    }}>
                                      {sel && <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>check</span>}
                                      {gr.grade}年
                                    </button>
                                  );
                                })}
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
                               <strong style={{ fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                 <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>groups</span>
                                 {g.name}
                               </strong>
                              <span style={{ fontSize: '0.8rem', color: '#64748B', marginLeft: '0.6rem' }}>
                                {memberNames || 'メンバーなし'}（{g.teacher_ids.length}名）
                              </span>
                              {(g.subjects?.length > 0 || g.target_grades?.length > 0) && (
                                <div style={{ marginTop: '0.2rem', fontSize: '0.75rem', color: '#475569' }}>
                                  {g.subjects?.length > 0 && <span>教科: {g.subjects.join('・')}</span>}
                                  {g.subjects?.length > 0 && g.target_grades?.length > 0 && <span style={{ margin: '0 0.4rem' }}>／</span>}
                                  {g.target_grades?.length > 0 && <span>学年: {g.target_grades.map(gr => `${gr}年`).join('・')}</span>}
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                              {/* 並べ替えボタン */}
                                <button
                                 onClick={() => moveTeacherGroup(g.id, 'up')}
                                 disabled={idx === 0}
                                 title="上へ"
                                 style={{ padding: '0.2rem 0.5rem', border: '1px solid #CBD5E1', borderRadius: '4px', background: '#fff', cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? 0.3 : 1, fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}
                               >
                                 <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_upward</span>
                               </button>
                                <button
                                 onClick={() => moveTeacherGroup(g.id, 'down')}
                                 disabled={idx === teacher_groups.length - 1}
                                 title="下へ"
                                 style={{ padding: '0.2rem 0.5rem', border: '1px solid #CBD5E1', borderRadius: '4px', background: '#fff', cursor: idx === teacher_groups.length - 1 ? 'not-allowed' : 'pointer', opacity: idx === teacher_groups.length - 1 ? 0.3 : 1, fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}
                               >
                                 <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_downward</span>
                               </button>
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
                          <span className="material-symbols-outlined" style={{ fontSize: '20px', color: cgClasses.includes(c) ? '#16A34A' : '#94A3B8' }}>
                            {cgClasses.includes(c) ? 'check_box' : 'check_box_outline_blank'}
                          </span>
                          {c}
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

              {/* ── 全体合同授業 ─────────────────────────────── */}
              <div style={{ marginTop: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.4rem' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--md-on-surface)' }}>全体合同授業</h3>
                  <span style={{ fontSize: '12px', color: 'var(--md-on-surface-variant)' }}>学年全体・全校など複数クラスが同一時限に受ける授業</span>
                </div>

                {/* 登録フォーム */}
                <div style={{ background: 'var(--md-surface-container)', border: `1px solid var(--md-outline-variant)`, borderRadius: 'var(--md-shape-lg, 16px)', padding: '1rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

                  {/* 授業名 */}
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--md-on-surface-variant)', display: 'block', marginBottom: '0.4rem' }}>授業名（任意）</label>
                    <input className="input-base" value={cgxName} onChange={e => setCgxName(e.target.value)} placeholder="例: 合同体育、学年集会" style={{ maxWidth: '240px' }} />
                  </div>

                  {/* 教科チップ選択 */}
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--md-on-surface-variant)', display: 'block', marginBottom: '0.4rem' }}>
                      教科
                      {cgxSubject && <span style={{ marginLeft: '0.5rem', fontSize: '12px', color: 'var(--md-primary)' }}>{cgxSubject}</span>}
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {subjectList.map(s => {
                        const sel = cgxSubject === s;
                        return (
                          <button key={s} type="button" onClick={() => setCgxSubject(sel ? '' : s)} style={{
                            padding: '0.3rem 0.875rem', borderRadius: 'var(--md-shape-full)',
                            border: `1px solid ${sel ? 'var(--md-primary)' : 'var(--md-outline-variant)'}`,
                            background: sel ? 'var(--md-primary-container)' : 'transparent',
                            color: sel ? 'var(--md-on-primary-container)' : 'var(--md-on-surface-variant)',
                            fontSize: '13px', fontWeight: sel ? 600 : 400, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '0.25rem',
                            fontFamily: 'var(--md-font-plain)',
                          }}>
                            {sel && <span style={{ fontSize: '10px' }}>✓</span>}{s}
                          </button>
                        );
                      })}
                      {subjectList.length === 0 && <span style={{ fontSize: '12px', color: 'var(--md-on-surface-variant)' }}>先に教科タブで教科を登録してください</span>}
                    </div>
                  </div>

                  {/* 週コマ数 */}
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--md-on-surface-variant)', display: 'block', marginBottom: '0.4rem' }}>週あたりコマ数</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button type="button" onClick={() => setCgxCount(c => Math.max(1, c - 1))} style={{ width: 28, height: 28, borderRadius: '50%', border: `1px solid var(--md-outline-variant)`, background: 'transparent', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, color: 'var(--md-on-surface-variant)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                      <span style={{ minWidth: '2rem', textAlign: 'center', fontWeight: 600, fontFamily: 'var(--md-font-mono)', fontSize: '15px', color: 'var(--md-on-surface)' }}>{cgxCount}</span>
                      <button type="button" onClick={() => setCgxCount(c => Math.min(10, c + 1))} style={{ width: 28, height: 28, borderRadius: '50%', border: `1px solid var(--md-outline-variant)`, background: 'transparent', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, color: 'var(--md-on-surface-variant)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>＋</button>
                    </div>
                  </div>

                  {/* 参加クラス選択 */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.6rem' }}>
                      <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--md-on-surface-variant)' }}>
                        参加クラス
                        {cgxParticipants.length > 0 && (
                          <span style={{ marginLeft: '0.5rem', fontSize: '12px', color: 'var(--md-secondary)', fontFamily: 'var(--md-font-mono)' }}>{cgxParticipants.length}クラス選択中</span>
                        )}
                      </label>
                      {/* 全校一括選択ボタン */}
                      <button type="button" onClick={toggleAllSchool} style={{
                        padding: '0.2rem 0.75rem', borderRadius: 'var(--md-shape-full)',
                        border: `1px solid var(--md-outline-variant)`,
                        background: 'var(--md-secondary-container)',
                        color: 'var(--md-on-secondary-container)',
                        fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                        fontFamily: 'var(--md-font-plain)',
                      }}>全校</button>
                    </div>

                    {structure.grades.map(g => {
                      const allClasses = [...(g.classes || []), ...(g.special_classes || [])];
                      const allSel = allClasses.length > 0 && allClasses.every(cn => cgxParticipants.some(p => p.grade === g.grade && p.class_name === cn));
                      return (
                        <div key={g.grade} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
                          {/* 学年全選択ボタン */}
                          <button type="button" onClick={() => toggleGradeAll(g)} style={{
                            padding: '0.25rem 0.75rem', borderRadius: 'var(--md-shape-full)',
                            border: `1px solid ${allSel ? 'var(--md-primary)' : 'var(--md-outline-variant)'}`,
                            background: allSel ? 'var(--md-primary-container)' : 'var(--md-surface-container-low)',
                            color: allSel ? 'var(--md-on-primary-container)' : 'var(--md-on-surface)',
                            fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                            fontFamily: 'var(--md-font-plain)', minWidth: '60px',
                          }}>
                            {g.grade}年全体
                          </button>
                          <span style={{ color: 'var(--md-outline-variant)', fontSize: '12px' }}>|</span>
                          {/* 個別クラス選択 */}
                          {allClasses.map(cn => {
                            const sel = cgxParticipants.some(p => p.grade === g.grade && p.class_name === cn);
                            const isSpecial = cn.includes('特支');
                            return (
                              <button key={cn} type="button" onClick={() => toggleCgxParticipant(g.grade, cn)} style={{
                                padding: '0.25rem 0.6rem', borderRadius: 'var(--md-shape-full)',
                                border: `1px solid ${sel ? (isSpecial ? 'var(--md-tertiary)' : 'var(--md-primary)') : 'var(--md-outline-variant)'}`,
                                background: sel ? (isSpecial ? 'var(--md-tertiary-container)' : 'var(--md-primary-container)') : 'transparent',
                                color: sel ? (isSpecial ? 'var(--md-on-tertiary-container)' : 'var(--md-on-primary-container)') : 'var(--md-on-surface-variant)',
                                fontSize: '12px', fontWeight: sel ? 600 : 400, cursor: 'pointer',
                                fontFamily: 'var(--md-font-plain)',
                              }}>
                                {sel && '✓ '}{g.grade}年{cn}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>

                  <button className="btn-primary" onClick={handleAddCrossGradeGroup}
                    disabled={cgxParticipants.length < 2 || !cgxSubject}
                    style={{ opacity: cgxParticipants.length < 2 || !cgxSubject ? 0.5 : 1, alignSelf: 'flex-start' }}>
                    合同授業を登録
                  </button>
                </div>

                {/* 登録済み一覧 */}
                {(cross_grade_groups || []).length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'var(--md-on-surface-variant)', textAlign: 'center', padding: '1rem 0' }}>合同授業が登録されていません</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {(cross_grade_groups || []).map(grp => (
                      <div key={grp.id} style={{
                        border: `1px solid var(--md-outline-variant)`,
                        borderRadius: 'var(--md-shape-md, 12px)',
                        padding: '0.75rem 1rem',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                        background: 'var(--md-surface-container-low)',
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                            <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--md-on-surface)' }}>{grp.name}</span>
                            <span style={{
                              padding: '0.1rem 0.6rem', borderRadius: 'var(--md-shape-full)',
                              background: 'var(--md-primary-container)', color: 'var(--md-on-primary-container)',
                              fontSize: '12px', fontWeight: 600, fontFamily: 'var(--md-font-mono)',
                            }}>{grp.subject}</span>
                            <span style={{
                              padding: '0.1rem 0.6rem', borderRadius: 'var(--md-shape-full)',
                              background: 'var(--md-secondary-container)', color: 'var(--md-on-secondary-container)',
                              fontSize: '12px', fontWeight: 600, fontFamily: 'var(--md-font-mono)',
                            }}>週{grp.count}コマ</span>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                            {grp.participants.map(p => (
                              <span key={`${p.grade}-${p.class_name}`} style={{
                                padding: '0.1rem 0.5rem', borderRadius: 'var(--md-shape-full)',
                                background: p.class_name.includes('特支') ? 'var(--md-tertiary-container)' : 'var(--md-surface-container)',
                                color: p.class_name.includes('特支') ? 'var(--md-on-tertiary-container)' : 'var(--md-on-surface-variant)',
                                fontSize: '11px', fontFamily: 'var(--md-font-mono)',
                              }}>{p.grade}年{p.class_name}</span>
                            ))}
                          </div>
                        </div>
                        <button className="btn-danger" onClick={() => removeCrossGradeGroup(grp.id)} style={{ marginLeft: '0.75rem', flexShrink: 0 }}>削除</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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

        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
