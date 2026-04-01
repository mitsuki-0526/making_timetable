import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTimetableStore } from '../store/useTimetableStore';

const CellDropdown = ({ day_of_week, period, grade, class_name }) => {
  const {
    getAvailableTeachers, setTimetableEntry, setAltEntry, setEntryGroup,
    getEntry, teachers, teacher_groups, getDailySubjectCount, structure
  } = useTimetableStore();

  // 右クリックメニューの座標
  const [contextMenu, setContextMenu] = useState(null); // { x, y } | null
  // サブフォームの表示状態と表示座標
  const [subForm, setSubForm] = useState(null); // 'alt' | 'group' | null
  const [formPos, setFormPos] = useState({ x: 0, y: 0 });
  // グループ配置不可警告: [{ teacherName, day, period }] | null
  const [groupWarnings, setGroupWarnings] = useState(null);

  const currentEntry = getEntry(day_of_week, period, grade, class_name);
  const availableTeachers = getAvailableTeachers(day_of_week, period, grade);

  const isSpecial = class_name.includes('特支') || grade === '特支';
  const reqKey = isSpecial ? `${grade}_特支` : `${grade}_通常`;
  const gradeSubjects = Object.keys(structure.required_hours[reqKey] || {});

  const dailyCount = currentEntry?.subject
    ? getDailySubjectCount(day_of_week, grade, class_name, currentEntry.subject)
    : 0;
  const isDuplicateWarning = dailyCount > 1;
  const isTeacherMissing =
    currentEntry && currentEntry.subject &&
    !currentEntry.teacher_id && !currentEntry.teacher_group_id;

  const hasAlt = !!(currentEntry?.alt_subject);
  const hasGroup = !!(currentEntry?.teacher_group_id);
  const assignedGroup = hasGroup
    ? (teacher_groups || []).find(g => g.id === currentEntry.teacher_group_id)
    : null;

  // コンテキストメニュー・フォームを外クリックで閉じる
  useEffect(() => {
    if (!contextMenu && !subForm) return;
    const close = () => { setContextMenu(null); setSubForm(null); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [contextMenu, subForm]);

  // 右クリック — 画面端では反転して見切れを防ぐ
  const handleContextMenu = (e) => {
    if (!currentEntry?.subject) return;
    e.preventDefault();
    const MENU_W = 190, MENU_H = 150, FORM_W = 220, FORM_H = 160;
    const vw = window.innerWidth, vh = window.innerHeight;
    const mx = e.clientX + MENU_W > vw ? e.clientX - MENU_W : e.clientX;
    const my = e.clientY + MENU_H > vh ? e.clientY - MENU_H : e.clientY;
    const fx = e.clientX + FORM_W > vw ? e.clientX - FORM_W : e.clientX;
    const fy = e.clientY + FORM_H > vh ? e.clientY - FORM_H : e.clientY;
    setContextMenu({ x: mx, y: my });
    setFormPos({ x: fx, y: fy });
    setSubForm(null);
  };

  // ---- A週 教科変更ハンドラ ----
  const handleChange = (e) => {
    const subject = e.target.value;
    if (!subject) {
      setTimetableEntry(day_of_week, period, grade, class_name, null, null);
      setSubForm(null);
      return;
    }
    const suitableTeachers = availableTeachers.filter(t =>
      t.subjects.includes(subject) ||
      (isSpecial && t.subjects.includes('特別支援'))
    );
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
      return t.subjects.includes(altSubject) || (isSpecial && t.subjects.includes('特別支援'));
    });
    const altTeacherId = altCandidates.length > 0 ? altCandidates[0].id : null;
    setAltEntry(day_of_week, period, grade, class_name, altSubject, altTeacherId);
  };

  const handleAltTeacherChange = (e) => {
    setAltEntry(day_of_week, period, grade, class_name,
      currentEntry?.alt_subject, e.target.value || null);
  };

  const handleGroupChange = (e) => {
    const groupId = e.target.value || null;
    setEntryGroup(day_of_week, period, grade, class_name, groupId);

    // グループ内の先生に配置不可時間が含まれているか確認
    if (groupId) {
      const grp = (teacher_groups || []).find(g => g.id === groupId);
      if (grp) {
        const conflicts = grp.teacher_ids
          .map(tid => teachers.find(t => t.id === tid))
          .filter(Boolean)
          .filter(t => t.unavailable_times?.some(
            u => u.day_of_week === day_of_week && u.period === period
          ))
          .map(t => t.name.split('(')[0].trim());
        if (conflicts.length > 0) {
          setGroupWarnings({ conflicts, groupName: grp.name, day: day_of_week, period });
        }
      }
    }
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

  // ---- 右クリックメニュー ----
  const ContextMenuPortal = contextMenu && createPortal(
    <div
      onMouseDown={e => e.stopPropagation()}
      style={{
        position: 'fixed', top: contextMenu.y, left: contextMenu.x,
        backgroundColor: '#fff', border: '1px solid #E2E8F0',
        borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        zIndex: 9999, minWidth: '170px', padding: '4px 0', fontSize: '0.875rem',
      }}
    >
      <div
        onMouseDown={(e) => {
          e.stopPropagation();
          setSubForm('alt');
          setContextMenu(null);
        }}
        style={{
          padding: '8px 16px', cursor: 'pointer', color: '#1E293B',
          backgroundColor: subForm === 'alt' ? '#F5F3FF' : 'transparent',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F8FAFC'}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        🗓️ {hasAlt ? '隔週設定を変更' : '隔週設定'}
      </div>
      {(teacher_groups || []).length > 0 && (
        <div
          onMouseDown={(e) => {
            e.stopPropagation();
            setSubForm('group');
            setContextMenu(null);
          }}
          style={{
            padding: '8px 16px', cursor: 'pointer', color: '#1E293B',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F8FAFC'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          👥 グループ担当設定
        </div>
      )}
      <div style={{ height: '1px', backgroundColor: '#E2E8F0', margin: '4px 0' }} />
      <div
        onMouseDown={(e) => {
          e.stopPropagation();
          setTimetableEntry(day_of_week, period, grade, class_name, null, null);
          setSubForm(null);
          setContextMenu(null);
        }}
        style={{
          padding: '8px 16px', cursor: 'pointer', color: '#DC2626',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#FFF1F2'}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        🗑️ 教科をクリア
      </div>
    </div>,
    document.body
  );

  // ---- B週設定フォーム (fixed overlay) ----
  const AltFormPortal = subForm === 'alt' && currentEntry?.subject && createPortal(
    <div
      onMouseDown={e => e.stopPropagation()}
      style={{
        position: 'fixed', top: formPos.y, left: formPos.x,
        backgroundColor: '#F5F3FF', border: '1px solid #DDD6FE',
        borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        zIndex: 9998, padding: '12px', minWidth: '200px',
        display: 'flex', flexDirection: 'column', gap: '8px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', color: '#5B21B6', fontWeight: 700 }}>🗓️ B週の設定</span>
        <button
          onMouseDown={(e) => { e.stopPropagation(); setSubForm(null); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '1rem' }}
        >✕</button>
      </div>
      <select
        value={currentEntry?.alt_subject || ''}
        onChange={handleAltSubjectChange}
        style={{ fontSize: '0.85rem', padding: '4px 6px', border: '1px solid #C4B5FD', borderRadius: '4px' }}
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
          style={{ fontSize: '0.85rem', padding: '4px 6px', border: '1px solid #C4B5FD', borderRadius: '4px' }}
        >
          <option value="">教員未定</option>
          {altTeacherCandidates.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      )}
    </div>,
    document.body
  );

  // ---- グループ設定フォーム (fixed overlay) ----
  const GroupFormPortal = subForm === 'group' && currentEntry?.subject && createPortal(
    <div
      onMouseDown={e => e.stopPropagation()}
      style={{
        position: 'fixed', top: formPos.y, left: formPos.x,
        backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0',
        borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        zIndex: 9998, padding: '12px', minWidth: '200px',
        display: 'flex', flexDirection: 'column', gap: '8px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', color: '#065F46', fontWeight: 700 }}>👥 グループ担当設定</span>
        <button
          onMouseDown={(e) => { e.stopPropagation(); setSubForm(null); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '1rem' }}
        >✕</button>
      </div>
      <select
        value={currentEntry?.teacher_group_id || ''}
        onChange={handleGroupChange}
        style={{ fontSize: '0.85rem', padding: '4px 6px', border: '1px solid #86EFAC', borderRadius: '4px' }}
      >
        <option value="">個別担当に戻す（解除）</option>
        {(teacher_groups || []).map(g => (
          <option key={g.id} value={g.id}>👥 {g.name}（{g.teacher_ids.length}名）</option>
        ))}
      </select>
      {hasGroup && assignedGroup && (
        <div style={{ fontSize: '0.75rem', color: '#166534' }}>
          メンバー: {assignedGroup.teacher_ids
            .map(id => teachers.find(t => t.id === id)?.name?.split('(')[0]?.trim() || id)
            .join('・')}
        </div>
      )}
    </div>,
    document.body
  );

  // ---- グループ配置不可警告ポータル ----
  const GroupWarningPortal = groupWarnings && createPortal(
    <div
      onMouseDown={e => e.stopPropagation()}
      style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: '#fff', border: '2px solid #F59E0B',
        borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        zIndex: 10000, padding: '20px 24px', minWidth: '320px', maxWidth: '420px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>⚠️</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#92400E', marginBottom: '8px' }}>
            配置不可の先生が含まれています
          </div>
          <div style={{ fontSize: '0.85rem', color: '#1E293B', marginBottom: '8px' }}>
            グループ「{groupWarnings.groupName}」の以下の先生は
            <strong> {groupWarnings.day}曜日 {groupWarnings.period}限</strong> が配置不可に設定されています：
          </div>
          <ul style={{ margin: '0 0 12px', padding: '0 0 0 16px', fontSize: '0.85rem', color: '#DC2626' }}>
            {groupWarnings.conflicts.map(name => (
              <li key={name} style={{ marginBottom: '2px' }}>
                <strong>{name}</strong>
              </li>
            ))}
          </ul>
          <div style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: '16px' }}>
            配置は登録されました。問題がなければ確認を押してください。
          </div>
          <button
            onMouseDown={(e) => { e.stopPropagation(); setGroupWarnings(null); }}
            style={{
              width: '100%', padding: '8px', border: 'none', borderRadius: '6px',
              backgroundColor: '#F59E0B', color: '#fff',
              fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
            }}
          >
            確認しました
          </button>
        </div>
      </div>
    </div>,
    document.body
  );

  // 背景オーバーレイ
  const WarningOverlay = groupWarnings && createPortal(
    <div
      onMouseDown={() => setGroupWarnings(null)}
      style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 9999,
      }}
    />,
    document.body
  );

  return (
    <>
      {/* セル表示 + hidden-select をこのdivに限定 */}
      <div style={{ position: 'relative', width: '100%', height: '100%' }} onContextMenu={handleContextMenu}>
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
                <div style={{ fontSize: '0.68rem', lineHeight: 1.3, color: '#1D4ED8', fontWeight: 700 }}>
                  A: {currentEntry.subject}
                  <span style={{ fontWeight: 400, color: '#475569', marginLeft: '3px' }}>
                    {teacherName(currentEntry.teacher_id) || '未定'}
                  </span>
                </div>
                <div style={{ fontSize: '0.68rem', lineHeight: 1.3, color: '#6D28D9', fontWeight: 700 }}>
                  B: {currentEntry.alt_subject}
                  <span style={{ fontWeight: 400, color: '#475569', marginLeft: '3px' }}>
                    {teacherName(currentEntry.alt_teacher_id) || '未定'}
                  </span>
                </div>
                <div style={{
                  display: 'inline-block', fontSize: '0.58rem',
                  backgroundColor: '#EDE9FE', color: '#5B21B6',
                  borderRadius: '3px', padding: '0 3px', fontWeight: 600
                }}>隔週</div>
              </>
            ) : hasGroup ? (
              <>
                <div className="subject-line">{currentEntry.subject}</div>
                <div className="teacher-line" style={{ color: '#065F46', fontWeight: 600 }}>
                  👥 {assignedGroup?.name || 'グループ'}
                </div>
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

        {/* 左クリックで教科選択 */}
        <select
          className="hidden-select"
          value={currentEntry?.subject || ''}
          onChange={handleChange}
          title="左クリック：教科選択 / 右クリック：隔週・グループ設定"
        >
          <option value="">未設定</option>
          {gradeSubjects.map(subj => (
            <option key={subj} value={subj}>{subj}</option>
          ))}
        </select>
      </div>

      {/* ポータル経由でbodyに描画（セルの高さに影響しない） */}
      {ContextMenuPortal}
      {AltFormPortal}
      {GroupFormPortal}
      {WarningOverlay}
      {GroupWarningPortal}
    </>
  );
};

export default CellDropdown;
