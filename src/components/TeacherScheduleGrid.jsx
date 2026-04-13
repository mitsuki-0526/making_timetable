import React, { useState, useEffect, useRef } from 'react';
import { useTimetableStore } from '../store/useTimetableStore';

const DAYS = ['月', '火', '水', '木', '金'];
const PERIODS = [1, 2, 3, 4, 5, 6];

const DAY_COLOR = {
  月: { container: 'var(--day-mon-container)', on: 'var(--day-mon-on)', fixed: 'var(--day-mon-fixed)' },
  火: { container: 'var(--day-tue-container)', on: 'var(--day-tue-on)', fixed: 'var(--day-tue-fixed)' },
  水: { container: 'var(--day-wed-container)', on: 'var(--day-wed-on)', fixed: 'var(--day-wed-fixed)' },
  木: { container: 'var(--day-thu-container)', on: 'var(--day-thu-on)', fixed: 'var(--day-thu-fixed)' },
  金: { container: 'var(--day-fri-container)', on: 'var(--day-fri-on)', fixed: 'var(--day-fri-fixed)' },
};

const TeacherScheduleGrid = () => {
  const { teachers, teacher_groups, timetable } = useTimetableStore();

  // 表示順を管理（teacher.id の配列）
  const [displayOrder, setDisplayOrder] = useState(() => teachers.map(t => t.id));
  // ドラッグ状態
  const dragIdRef   = useRef(null); // ドラッグ中の teacher.id
  const [dragOverId, setDragOverId] = useState(null); // ドロップ先の teacher.id

  // teachers が変わったとき（追加・削除）に表示順を同期
  useEffect(() => {
    setDisplayOrder(prev => {
      const current = teachers.map(t => t.id);
      const kept    = prev.filter(id => current.includes(id));
      const added   = current.filter(id => !kept.includes(id));
      return [...kept, ...added];
    });
  }, [teachers]);

  const orderedTeachers = displayOrder
    .map(id => teachers.find(t => t.id === id))
    .filter(Boolean);

  // ── ドラッグ&ドロップ ────────────────────────────────────────────────
  const handleDragStart = (e, id) => {
    dragIdRef.current = id;
    e.dataTransfer.effectAllowed = 'move';
    // Firefox 対応
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e, id) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== dragIdRef.current) setDragOverId(id);
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    const srcId = dragIdRef.current;
    if (!srcId || srcId === targetId) { setDragOverId(null); return; }

    setDisplayOrder(prev => {
      const arr  = [...prev];
      const from = arr.indexOf(srcId);
      const to   = arr.indexOf(targetId);
      if (from < 0 || to < 0) return prev;
      arr.splice(from, 1);
      arr.splice(to, 0, srcId);
      return arr;
    });
    setDragOverId(null);
    dragIdRef.current = null;
  };

  const handleDragEnd = () => {
    dragIdRef.current = null;
    setDragOverId(null);
  };

  // ── ロジック（変更なし） ──────────────────────────────────────────────
  const getEntries = (teacherId, day, period) => {
    const matched = timetable.filter(entry => {
      if (entry.day_of_week !== day || entry.period !== period) return false;
      if (entry.teacher_id === teacherId || entry.alt_teacher_id === teacherId) return true;
      if (entry.teacher_group_id) {
        const grp = (teacher_groups || []).find(g => g.id === entry.teacher_group_id);
        if (grp?.teacher_ids?.includes(teacherId)) return true;
      }
      return false;
    });
    if (matched.length === 0) return null;

    const first = matched[0];
    const role = first.teacher_id === teacherId ? 'primary'
      : first.alt_teacher_id === teacherId ? 'alt'
      : 'group';

    let allEntries = matched;
    if (first.cell_group_id) {
      allEntries = timetable.filter(e =>
        e.day_of_week === day && e.period === period &&
        e.cell_group_id === first.cell_group_id
      );
    }
    return { first, role, allEntries, isGrouped: first.cell_group_id && allEntries.length > 1 };
  };

  const classLabel = (entry) => {
    if (!entry) return '';
    const isSpecial = entry.class_name.includes('特支');
    if (isSpecial) return `${entry.grade}年\n${entry.class_name}`;
    return `${entry.grade}-${entry.class_name}`;
  };

  const subjectLabel = (entry, role) => {
    if (!entry) return '';
    return role === 'alt' ? (entry.alt_subject || '') : (entry.subject || '');
  };

  const countPeriods = (teacherId) => {
    let count = 0;
    DAYS.forEach(day => {
      PERIODS.forEach(period => {
        if (getEntries(teacherId, day, period) !== null) count++;
      });
    });
    return count;
  };

  if (teachers.length === 0) return null;

  return (
    <div className="validation-panel" style={{ marginTop: '1.5rem' }}>
      <div className="validation-header">
        <h3 style={{ fontSize: '16px', fontWeight: 500, color: 'var(--md-on-surface)', margin: 0, letterSpacing: '0.15px' }}>
          先生ごとのコマ数
        </h3>
        <span style={{ fontSize: '12px', color: 'var(--md-on-surface-variant)', letterSpacing: '0.4px' }}>
          ☰ をドラッグして行の順番を入れ替えられます
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="grid-table" style={{ fontSize: '0.82rem' }}>
          <thead>
            <tr>
              <th rowSpan={2} style={{
                minWidth: '110px', position: 'sticky', left: 0, zIndex: 20,
                background: 'var(--md-surface-container-high)',
                borderRight: `1px solid var(--md-outline-variant)`,
                fontSize: '11px', fontWeight: 500, letterSpacing: '0.5px',
                color: 'var(--md-on-surface-variant)', textAlign: 'center',
              }}>
                先生
              </th>
              <th rowSpan={2} style={{
                minWidth: '52px', textAlign: 'center',
                background: 'var(--md-surface-container-high)',
                borderRight: `1px solid var(--md-outline-variant)`,
                fontSize: '11px', fontWeight: 500, letterSpacing: '0.5px',
                color: 'var(--md-on-surface-variant)',
                fontFamily: 'var(--md-font-mono)',
              }}>
                週計
              </th>
              {DAYS.map(day => {
                const dc = DAY_COLOR[day];
                return (
                  <th key={day} colSpan={PERIODS.length} style={{
                    textAlign: 'center',
                    background: dc.container,
                    color: dc.on,
                    fontSize: '13px', fontWeight: 700,
                    padding: '6px 4px', letterSpacing: '0.1px',
                    borderBottom: `2px solid color-mix(in srgb, ${dc.container} 60%, ${dc.fixed})`,
                    borderRight: `1px solid var(--md-outline-variant)`,
                  }}>
                    {day}曜日
                  </th>
                );
              })}
            </tr>
            <tr>
              {DAYS.map(day => {
                const dc = DAY_COLOR[day];
                return PERIODS.map(period => (
                  <th key={`${day}-${period}`} style={{
                    minWidth: '46px', textAlign: 'center',
                    fontSize: '11px', fontWeight: 500,
                    padding: '4px 2px',
                    fontFamily: 'var(--md-font-mono)',
                    color: dc.on,
                    background: `color-mix(in srgb, ${dc.container} 70%, white)`,
                    borderRight: period === PERIODS[PERIODS.length - 1]
                      ? `1px solid var(--md-outline-variant)` : undefined,
                  }}>
                    {period}
                  </th>
                ));
              })}
            </tr>
          </thead>
          <tbody>
            {orderedTeachers.map(teacher => {
              const total      = countPeriods(teacher.id);
              const isDragOver = dragOverId === teacher.id;

              return (
                <tr
                  key={teacher.id}
                  draggable
                  onDragStart={e => handleDragStart(e, teacher.id)}
                  onDragOver={e  => handleDragOver(e, teacher.id)}
                  onDrop={e      => handleDrop(e, teacher.id)}
                  onDragEnd={handleDragEnd}
                  style={{
                    outline: isDragOver ? '2px solid var(--md-primary)' : undefined,
                    outlineOffset: isDragOver ? '-2px' : undefined,
                    opacity: dragIdRef.current === teacher.id ? 0.4 : 1,
                    transition: 'opacity 0.15s',
                  }}
                >
                  {/* 先生名セル（スティッキー） */}
                  <td style={{
                    background: 'var(--md-surface-container-low)',
                    fontWeight: 500, color: 'var(--md-on-surface)',
                    position: 'sticky', left: 0, zIndex: 5,
                    borderRight: `1px solid var(--md-outline-variant)`,
                    fontSize: '13px',
                    fontFamily: 'var(--md-font-plain)',
                    padding: '4px 6px 4px 4px',
                    whiteSpace: 'pre-line',
                    cursor: 'grab',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {/* ドラッグハンドル */}
                      <span
                        title="ドラッグして順番を変更"
                        style={{
                          fontSize: '14px',
                          color: 'var(--md-on-surface-variant)',
                          opacity: 0.5,
                          cursor: 'grab',
                          userSelect: 'none',
                          flexShrink: 0,
                          lineHeight: 1,
                        }}
                      >
                        ☰
                      </span>
                      <div>
                        <div>{teacher.name.split('(')[0].trim()}</div>
                        <div style={{ fontSize: '11px', color: 'var(--md-on-surface-variant)', fontWeight: 400, fontFamily: 'var(--md-font-mono)', letterSpacing: '0.3px' }}>
                          {teacher.subjects.join('・')}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* 週計セル */}
                  <td style={{
                    textAlign: 'center', fontWeight: 500,
                    background: total > 0 ? 'var(--md-primary-container)' : 'transparent',
                    color: total > 0 ? 'var(--md-on-primary-container)' : 'var(--md-on-surface-variant)',
                    borderRight: `1px solid var(--md-outline-variant)`,
                    fontSize: '13px',
                    fontFamily: 'var(--md-font-mono)',
                  }}>
                    {total > 0 ? total : '－'}
                  </td>

                  {/* 各コマ */}
                  {DAYS.map(day =>
                    PERIODS.map(period => {
                      const result = getEntries(teacher.id, day, period);
                      if (!result) {
                        return (
                          <td key={`${day}-${period}`} style={{
                            color: 'var(--md-outline-variant)', textAlign: 'center', padding: '3px 2px',
                            fontSize: '13px',
                            borderRight: period === PERIODS[PERIODS.length - 1]
                              ? `1px solid var(--md-outline-variant)` : undefined,
                          }}>
                            –
                          </td>
                        );
                      }
                      const { first, role, allEntries, isGrouped } = result;
                      const isAlt   = role === 'alt';
                      const isGroup = role === 'group';

                      const bgColor = isGrouped ? 'var(--md-tertiary-container)'
                        : isGroup ? 'var(--day-wed-container)'
                        : isAlt   ? 'var(--md-secondary-container)'
                        : first.class_name?.includes('特支') ? 'var(--md-tertiary-container)'
                        : 'var(--md-primary-container)';
                      const textColor = isGrouped ? 'var(--md-on-tertiary-container)'
                        : isGroup ? 'var(--day-wed-on)'
                        : isAlt   ? 'var(--md-on-secondary-container)'
                        : first.class_name?.includes('特支') ? 'var(--md-on-tertiary-container)'
                        : 'var(--md-on-primary-container)';

                      return (
                        <td key={`${day}-${period}`} style={{
                          background: bgColor,
                          color: textColor,
                          textAlign: 'center',
                          padding: '3px 2px',
                          fontSize: '11px',
                          fontWeight: 500,
                          whiteSpace: 'pre-line',
                          lineHeight: 1.3,
                          fontFamily: 'var(--md-font-mono)',
                          borderRight: period === PERIODS[PERIODS.length - 1]
                            ? `1px solid var(--md-outline-variant)` : undefined,
                        }}>
                          {isGrouped ? (
                            <>
                              <div style={{ fontSize: '0.65rem', lineHeight: 1.2 }}>
                                {allEntries.map(e => classLabel(e)).join('\n')}
                              </div>
                              <div style={{ fontSize: '0.65rem', opacity: 0.85, fontWeight: 400 }}>
                                {subjectLabel(first, role)}
                              </div>
                              <div style={{
                                display: 'inline-block', fontSize: '10px',
                                background: 'var(--md-secondary-container)',
                                color: 'var(--md-on-secondary-container)',
                                borderRadius: 'var(--md-shape-xs)',
                                padding: '0 4px', fontWeight: 500,
                              }}>合同</div>
                            </>
                          ) : (
                            <>
                              <div>{classLabel(first)}</div>
                              <div style={{ fontSize: '0.68rem', opacity: 0.85, fontWeight: 400 }}>
                                {subjectLabel(first, role)}
                              </div>
                              {first.alt_subject && (
                                <div style={{
                                  display: 'inline-block', fontSize: '10px',
                                  background: isAlt ? 'var(--md-tertiary-container)' : 'var(--md-primary-container)',
                                  color: isAlt ? 'var(--md-on-tertiary-container)' : 'var(--md-on-primary-container)',
                                  borderRadius: 'var(--md-shape-xs)',
                                  padding: '0 4px', fontWeight: 500,
                                  fontFamily: 'var(--md-font-mono)',
                                }}>
                                  {isAlt ? 'B週' : 'A週'}
                                </div>
                              )}
                            </>
                          )}
                        </td>
                      );
                    })
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TeacherScheduleGrid;
