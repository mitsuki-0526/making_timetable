import React from 'react';
import { useTimetableStore } from '../store/useTimetableStore';

const DAYS = ['月', '火', '水', '木', '金'];
const PERIODS = [1, 2, 3, 4, 5, 6];

const TeacherScheduleGrid = () => {
  const { teachers, teacher_groups, timetable } = useTimetableStore();

  // 指定の先生・曜日・時限のエントリを取得
  const getEntry = (teacherId, day, period) => {
    const e = timetable.find(entry => {
      if (entry.day_of_week !== day || entry.period !== period) return false;
      if (entry.teacher_id === teacherId || entry.alt_teacher_id === teacherId) return true;
      if (entry.teacher_group_id) {
        const grp = (teacher_groups || []).find(g => g.id === entry.teacher_group_id);
        if (grp?.teacher_ids?.includes(teacherId)) return true;
      }
      return false;
    });
    if (!e) return null;
    const role = e.teacher_id === teacherId ? 'primary'
      : e.alt_teacher_id === teacherId ? 'alt'
      : 'group';
    return { entry: e, role };
  };

  // クラス表示ラベル
  const classLabel = (entry) => {
    if (!entry) return '';
    const isSpecial = entry.class_name.includes('特支');
    if (isSpecial) return `${entry.grade}年\n${entry.class_name}`;
    return `${entry.grade}-${entry.class_name}`;
  };

  // 教科ラベル
  const subjectLabel = (entry, role) => {
    if (!entry) return '';
    return role === 'alt' ? (entry.alt_subject || '') : (entry.subject || '');
  };

  // 週コマ数の集計
  const countPeriods = (teacherId) =>
    timetable.filter(e => e.teacher_id === teacherId || e.alt_teacher_id === teacherId).length;

  if (teachers.length === 0) return null;

  return (
    <div className="validation-panel" style={{ marginTop: '1.5rem' }}>
      <div className="validation-header">
        <h3 style={{ fontSize: '1rem', color: '#0F172A', margin: 0 }}>先生ごとのコマ数</h3>
        <span style={{ fontSize: '0.8rem', color: '#64748B' }}>（各コマの担当クラスが表示されます）</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="grid-table" style={{ fontSize: '0.82rem' }}>
          <thead>
            <tr>
              {/* 先生列ヘッダー */}
              <th rowSpan={2} style={{
                minWidth: '100px', position: 'sticky', left: 0, zIndex: 20,
                backgroundColor: '#F1F5F9', borderRight: '2px solid #CBD5E1', fontSize: '0.85rem',
              }}>
                先生
              </th>
              <th rowSpan={2} style={{
                minWidth: '52px', textAlign: 'center',
                backgroundColor: '#F1F5F9', borderRight: '2px solid #CBD5E1', fontSize: '0.8rem',
              }}>
                週計
              </th>
              {/* 曜日ヘッダー */}
              {DAYS.map(day => (
                <th key={day} colSpan={PERIODS.length} style={{
                  textAlign: 'center', backgroundColor: '#E2E8F0', color: '#0F172A',
                  borderBottom: '1px solid #CBD5E1', fontSize: '0.85rem', padding: '4px',
                }}>
                  {day}曜日
                </th>
              ))}
            </tr>
            <tr>
              {/* 時限ヘッダー */}
              {DAYS.map(day =>
                PERIODS.map(period => (
                  <th key={`${day}-${period}`} style={{
                    minWidth: '45px', textAlign: 'center', fontSize: '0.75rem', padding: '2px',
                    borderRight: period === PERIODS[PERIODS.length - 1] ? '2px solid #94A3B8' : undefined,
                  }}>
                    {period}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {teachers.map(teacher => {
              const total = countPeriods(teacher.id);
              return (
                <tr key={teacher.id}>
                  {/* 先生名 */}
                  <td style={{
                    backgroundColor: '#F8FAFC', fontWeight: 600, color: '#0F172A',
                    position: 'sticky', left: 0, zIndex: 5,
                    borderRight: '2px solid #CBD5E1', fontSize: '0.82rem',
                    padding: '4px 6px', whiteSpace: 'pre-line',
                  }}>
                    {teacher.name.split('(')[0].trim()}
                    <div style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 'normal' }}>
                      {teacher.subjects.join('・')}
                    </div>
                  </td>
                  {/* 週計 */}
                  <td style={{
                    textAlign: 'center', fontWeight: 700,
                    backgroundColor: total > 0 ? '#EFF6FF' : '#F8FAFC',
                    color: total > 0 ? '#1D4ED8' : '#94A3B8',
                    borderRight: '2px solid #CBD5E1', fontSize: '0.85rem',
                  }}>
                    {total > 0 ? `${total}コマ` : '－'}
                  </td>
                  {/* 各コマ */}
                  {DAYS.map(day =>
                    PERIODS.map(period => {
                      const result = getEntry(teacher.id, day, period);
                      const entry = result?.entry ?? null;
                      const role = result?.role ?? 'primary';
                      const isAlt = role === 'alt';
                      const isGroup = role === 'group';
                      const isSpecialClass = entry?.class_name?.includes('特支');

                      const bgColor = entry
                        ? isGroup ? '#D1FAE5'
                          : isAlt ? '#F5F3FF'
                          : isSpecialClass ? '#FEF9C3'
                          : '#EFF6FF'
                        : '#fff';
                      const textColor = entry
                        ? isGroup ? '#065F46'
                          : isAlt ? '#5B21B6'
                          : isSpecialClass ? '#92400E'
                          : '#1E40AF'
                        : '#CBD5E1';

                      return (
                        <td key={`${day}-${period}`} style={{
                          backgroundColor: bgColor,
                          color: textColor,
                          textAlign: 'center',
                          padding: '3px 2px',
                          fontSize: '0.78rem',
                          fontWeight: entry ? 600 : 400,
                          whiteSpace: 'pre-line',
                          lineHeight: 1.3,
                          borderRight: period === PERIODS[PERIODS.length - 1] ? '2px solid #94A3B8' : undefined,
                        }}>
                          {entry ? (
                            <>
                              <div>{classLabel(entry)}</div>
                              <div style={{ fontSize: '0.68rem', opacity: 0.85, fontWeight: 400 }}>
                                {subjectLabel(entry, role)}
                              </div>
                              {entry.alt_subject && (
                                <div style={{
                                  display: 'inline-block', fontSize: '0.58rem',
                                  backgroundColor: isAlt ? '#DDD6FE' : '#DBEAFE',
                                  color: isAlt ? '#5B21B6' : '#1D4ED8',
                                  borderRadius: '3px', padding: '0 3px', fontWeight: 600,
                                }}>
                                  {isAlt ? 'B週' : 'A週'}
                                </div>
                              )}
                            </>
                          ) : '－'}
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
