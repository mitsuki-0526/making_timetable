import React, { useState } from 'react';
import { useTimetableStore } from '../store/useTimetableStore';

const CellDropdown = ({ day_of_week, period, grade, class_name }) => {
  const {
    getAvailableTeachers, setTimetableEntry, setAltEntry, setEntryGroup,
    getEntry, teachers, teacher_groups, getDailySubjectCount, structure
  } = useTimetableStore();

  const [showAltForm, setShowAltForm] = useState(false);
  const [showGroupForm, setShowGroupForm] = useState(false);

  const currentEntry = getEntry(day_of_week, period, grade, class_name);
  const availableTeachers = getAvailableTeachers(day_of_week, period, grade);

  // 対象クラスの教科リスト
  const isSpecial = class_name.includes('特支') || grade === '特支';
  const reqKey = isSpecial ? `${grade}_特支` : `${grade}_通常`;
  const gradeSubjects = Object.keys(structure.required_hours[reqKey] || {});

  // 重複チェック
  const dailyCount = currentEntry?.subject
    ? getDailySubjectCount(day_of_week, grade, class_name, currentEntry.subject)
    : 0;
  const isDuplicateWarning = dailyCount > 1;

  // 教員不足警告
  const isTeacherMissing =
    currentEntry && currentEntry.subject &&
    !currentEntry.teacher_id && !currentEntry.teacher_group_id;

  const hasAlt = !!(currentEntry?.alt_subject);
  const hasGroup = !!(currentEntry?.teacher_group_id);

  const assignedGroup = hasGroup
    ? (teacher_groups || []).find(g => g.id === currentEntry.teacher_group_id)
    : null;

  // ---- A週 教科変更ハンドラ ----
  const handleChange = (e) => {
    const subject = e.target.value;
    if (!subject) {
      setTimetableEntry(day_of_week, period, grade, class_name, null, null);
      setShowAltForm(false);
      setShowGroupForm(false);
      return;
    }
    const suitableTeachers = availableTeachers.filter(t => t.subjects.includes(subject));
    const teacherId = suitableTeachers.length > 0 ? suitableTeachers[0].id : null;
    setTimetableEntry(day_of_week, period, grade, class_name, teacherId, subject);
  };

  // ---- B週 教科変更ハンドラ ----
  const handleAltSubjectChange = (e) => {
    const altSubject = e.target.value;
    if (!altSubject) {
      setAltEntry(day_of_week, period, grade, class_name, null, null);
      return;
    }
    const altCandidates = teachers.filter(t => {
      if (t.unavailable_times.some(u => u.day_of_week === day_of_week && u.period === period)) return false;
      if (t.id === currentEntry?.teacher_id) return false;
      return t.subjects.includes(altSubject);
    });
    const altTeacherId = altCandidates.length > 0 ? altCandidates[0].id : null;
    setAltEntry(day_of_week, period, grade, class_name, altSubject, altTeacherId);
  };

  // ---- B週 教員変更ハンドラ ----
  const handleAltTeacherChange = (e) => {
    setAltEntry(
      day_of_week, period, grade, class_name,
      currentEntry?.alt_subject,
      e.target.value || null
    );
  };

  // ---- グループ変更ハンドラ ----
  const handleGroupChange = (e) => {
    const groupId = e.target.value || null;
    setEntryGroup(day_of_week, period, grade, class_name, groupId);
  };

  const altTeacherCandidates = teachers.filter(t => {
    if (t.unavailable_times.some(u => u.day_of_week === day_of_week && u.period === period)) return false;
    if (t.id === currentEntry?.teacher_id) return false;
    return true;
  });

  const teacherName = (id) => {
    if (!id) return null;
    const t = teachers.find(t => t.id === id);
    return t ? t.name.split(' ')[0] : null;
  };

  return (
    <>
      {/* ---- 選択エリア: hidden-select をこのdiv内だけに限定 ---- */}
      <div style={{ position: 'relative', width: '100%' }}>
        <div
          className="cell-display"
          style={{
            backgroundColor: isDuplicateWarning ? '#fef08a' : (isTeacherMissing ? '#fee2e2' : 'transparent'),
            border: isDuplicateWarning ? '1px solid #eab308' : (isTeacherMissing ? '1px solid #f87171' : 'none'),
          }}
        >
          {currentEntry && currentEntry.subject ? (
            hasAlt ? (
              <>
                <div style={{ fontSize: '0.68rem', lineHeight: 1.4, color: '#1D4ED8', fontWeight: 700 }}>
                  A: {currentEntry.subject}
                  <span style={{ fontWeight: 400, color: '#475569', marginLeft: '3px' }}>
                    {teacherName(currentEntry.teacher_id) || '未定'}
                  </span>
                </div>
                <div style={{ fontSize: '0.68rem', lineHeight: 1.4, color: '#6D28D9', fontWeight: 700 }}>
                  B: {currentEntry.alt_subject}
                  <span style={{ fontWeight: 400, color: '#475569', marginLeft: '3px' }}>
                    {teacherName(currentEntry.alt_teacher_id) || '未定'}
                  </span>
                </div>
                <div style={{
                  display: 'inline-block', fontSize: '0.6rem', marginTop: '1px',
                  backgroundColor: '#EDE9FE', color: '#5B21B6',
                  borderRadius: '3px', padding: '0 4px', fontWeight: 600
                }}>隔週</div>
              </>
            ) : hasGroup ? (
              <>
                <div className="subject-line">{currentEntry.subject}</div>
                <div className="teacher-line" style={{ color: '#065F46', fontWeight: 600 }}>
                  👥 {assignedGroup?.name || 'グループ'}
                </div>
                <div style={{
                  display: 'inline-block', fontSize: '0.6rem', marginTop: '1px',
                  backgroundColor: '#D1FAE5', color: '#065F46',
                  borderRadius: '3px', padding: '0 4px', fontWeight: 600
                }}>グループ</div>
              </>
            ) : (
              <>
                <div className={`subject-line ${isDuplicateWarning || isTeacherMissing ? 'warning-text' : ''}`}>
                  {currentEntry.subject}
                </div>
                <div className="teacher-line" style={{ color: isTeacherMissing ? '#b91c1c' : '#475569' }}>
                  {currentEntry.teacher_id ? teacherName(currentEntry.teacher_id) : '空きなし'}
                </div>
              </>
            )
          ) : (
            <div className="empty-line">未設定</div>
          )}
        </div>

        {/* A週教科の隠し選択 — このdiv内にのみ重なる */}
        <select
          className="hidden-select"
          value={currentEntry?.subject || ''}
          onChange={handleChange}
          title="クリックして教科を選択（A週）"
        >
          <option value="">未設定</option>
          {gradeSubjects.map(subj => (
            <option key={subj} value={subj}>{subj}</option>
          ))}
        </select>
      </div>

      {/* ---- サブ設定ボタン行（hidden-selectの外に配置） ---- */}
      {currentEntry?.subject && (
        <div style={{ padding: '2px 0', display: 'flex', gap: '2px', justifyContent: 'center', position: 'relative', zIndex: 20 }}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowAltForm(v => !v); setShowGroupForm(false); }}
            style={{
              fontSize: '0.58rem', padding: '1px 5px',
              border: `1px solid ${hasAlt ? '#7C3AED' : '#CBD5E1'}`,
              borderRadius: '3px',
              backgroundColor: hasAlt ? '#EDE9FE' : '#F8FAFC',
              color: hasAlt ? '#5B21B6' : '#94A3B8',
              cursor: 'pointer', lineHeight: 1.6,
            }}
          >
            {hasAlt ? '隔週▼' : '+隔週'}
          </button>

          {(teacher_groups || []).length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowGroupForm(v => !v); setShowAltForm(false); }}
              style={{
                fontSize: '0.58rem', padding: '1px 5px',
                border: `1px solid ${hasGroup ? '#059669' : '#CBD5E1'}`,
                borderRadius: '3px',
                backgroundColor: hasGroup ? '#D1FAE5' : '#F8FAFC',
                color: hasGroup ? '#065F46' : '#94A3B8',
                cursor: 'pointer', lineHeight: 1.6,
              }}
            >
              {hasGroup ? '👥▼' : '+グループ'}
            </button>
          )}
        </div>
      )}

      {/* ---- B週設定フォーム ---- */}
      {showAltForm && currentEntry?.subject && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            padding: '6px',
            backgroundColor: '#F5F3FF', borderRadius: '5px',
            border: '1px solid #DDD6FE',
            display: 'flex', flexDirection: 'column', gap: '3px',
            position: 'relative', zIndex: 20,
          }}
        >
          <div style={{ fontSize: '0.65rem', color: '#5B21B6', fontWeight: 700 }}>B週の設定</div>
          <select
            value={currentEntry?.alt_subject || ''}
            onChange={handleAltSubjectChange}
            style={{ fontSize: '0.72rem', width: '100%', padding: '2px 3px', border: '1px solid #C4B5FD', borderRadius: '3px' }}
          >
            <option value="">B週なし（隔週解除）</option>
            {gradeSubjects.filter(s => s !== currentEntry.subject).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {currentEntry?.alt_subject && (
            <select
              value={currentEntry?.alt_teacher_id || ''}
              onChange={handleAltTeacherChange}
              style={{ fontSize: '0.72rem', width: '100%', padding: '2px 3px', border: '1px solid #C4B5FD', borderRadius: '3px' }}
            >
              <option value="">教員未定</option>
              {altTeacherCandidates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* ---- グループ設定フォーム ---- */}
      {showGroupForm && currentEntry?.subject && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            padding: '6px',
            backgroundColor: '#F0FDF4', borderRadius: '5px',
            border: '1px solid #BBF7D0',
            display: 'flex', flexDirection: 'column', gap: '3px',
            position: 'relative', zIndex: 20,
          }}
        >
          <div style={{ fontSize: '0.65rem', color: '#065F46', fontWeight: 700 }}>グループ担当</div>
          <select
            value={currentEntry?.teacher_group_id || ''}
            onChange={handleGroupChange}
            style={{ fontSize: '0.72rem', width: '100%', padding: '2px 3px', border: '1px solid #86EFAC', borderRadius: '3px' }}
          >
            <option value="">個別担当に戻す（解除）</option>
            {(teacher_groups || []).map(g => (
              <option key={g.id} value={g.id}>
                👥 {g.name}（{g.teacher_ids.length}名）
              </option>
            ))}
          </select>
          {hasGroup && assignedGroup && (
            <div style={{ fontSize: '0.65rem', color: '#166534' }}>
              メンバー: {assignedGroup.teacher_ids
                .map(id => teachers.find(t => t.id === id)?.name?.split('(')[0]?.trim() || id)
                .join('・')}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default CellDropdown;
