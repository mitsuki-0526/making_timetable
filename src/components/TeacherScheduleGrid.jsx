import React from 'react';
import { useTimetableStore } from '../store/useTimetableStore';

const DAYS = ['月', '火', '水', '木', '金'];
const PERIODS = [1, 2, 3, 4, 5, 6];

// セルの背景色: クラスの種別に応じて色分け
const getCellStyle = (entry) => {
  if (!entry) return { backgroundColor: '#fff', color: '#94A3B8' };
  if (entry.class_name.includes('特支')) {
    return { backgroundColor: '#FEF9C3', color: '#92400E', fontWeight: 600 };
  }
  return { backgroundColor: '#EFF6FF', color: '#1E40AF', fontWeight: 600 };
};

const TeacherScheduleGrid = () => {
  const { teachers, teacher_groups, timetable, structure } = useTimetableStore();

  // 教員が担当しているコマを取得（主担当・B週担当・グループ所属を対象）
  // 戻り値: { entry, role: 'primary' | 'alt' | 'group' } | null
  const getEntry = (teacherId, day, period) => {
    const e = timetable.find(entry => {
      if (entry.day_of_week !== day || entry.period !== period) return false;
      if (entry.teacher_id === teacherId || entry.alt_teacher_id === teacherId) return true;
      // グループ所属チェック
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

  // クラス表示ラベルを生成: 例 "1-1組" "1特支1"
  const classLabel = (entry) => {
    if (!entry) return '';
    const isSpecial = entry.class_name.includes('特支');
    if (isSpecial) return `${entry.grade}年\n${entry.class_name}`;
    return `${entry.grade}-${entry.class_name}`;
  };

  // 教科名: roleに応じてA週/B週の教科を返す
  const subjectLabel = (entry, role) => {
    if (!entry) return '';
    return role === 'alt' ? (entry.alt_subject || '') : (entry.subject || '');
  };

  // 表示する教員が1人もいない場合
  if (teachers.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#94A3B8' }}>
        教員が登録されていません。マスタ設定から追加してください。
      </div>
    );
  }

  return (
    <div className="grid-container">
      <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
        <table className="grid-table" style={{ fontSize: '0.82rem' }}>
          <thead>
            <tr>
              {/* 曜日列・時限列のヘッダー */}
              <th
                rowSpan={2}
                style={{
                  minWidth: '44px',
                  position: 'sticky',
                  left: 0,
                  zIndex: 20,
                  backgroundColor: '#F1F5F9',
                  borderRight: '1px solid #CBD5E1',
                  fontSize: '0.78rem',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                }}
              >
                曜日
              </th>
              <th
                rowSpan={2}
                style={{
                  minWidth: '36px',
                  position: 'sticky',
                  left: '44px',
                  zIndex: 20,
                  backgroundColor: '#F1F5F9',
                  borderRight: '2px solid #CBD5E1',
                  fontSize: '0.78rem',
                  textAlign: 'center',
                }}
              >
                時限
              </th>
              {/* 教員名ヘッダー */}
              {teachers.map(t => (
                <th
                  key={t.id}
                  style={{
                    minWidth: '80px',
                    textAlign: 'center',
                    backgroundColor: '#E2E8F0',
                    color: '#0F172A',
                    fontSize: '0.8rem',
                    padding: '6px 4px',
                    borderBottom: '2px solid #CBD5E1',
                    whiteSpace: 'pre-line',
                  }}
                >
                  {/* 名前と担当教科を2行で表示 */}
                  {t.name}
                  <div style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 'normal', marginTop: '2px' }}>
                    {t.subjects.join('・')}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day) =>
              PERIODS.map((period, pIdx) => {
                const isFirstPeriod = pIdx === 0;
                return (
                  <tr key={`${day}-${period}`}>
                    {/* 曜日セル: 1曜日あたり最初の行だけ rowSpan で表示 */}
                    {isFirstPeriod && (
                      <td
                        rowSpan={PERIODS.length}
                        style={{
                          textAlign: 'center',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          backgroundColor: '#E2E8F0',
                          color: '#0F172A',
                          position: 'sticky',
                          left: 0,
                          zIndex: 5,
                          borderRight: '1px solid #CBD5E1',
                          borderBottom: '2px solid #CBD5E1',
                          padding: '0 6px',
                          verticalAlign: 'middle',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {day}曜
                      </td>
                    )}
                    {/* 時限セル */}
                    <td
                      style={{
                        textAlign: 'center',
                        fontWeight: 600,
                        fontSize: '0.78rem',
                        backgroundColor: '#F1F5F9',
                        color: '#475569',
                        position: 'sticky',
                        left: '44px',
                        zIndex: 5,
                        borderRight: '2px solid #CBD5E1',
                        borderBottom: period === PERIODS[PERIODS.length - 1] ? '2px solid #CBD5E1' : '1px solid #E2E8F0',
                        padding: '2px 4px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {period}限
                    </td>
                    {/* 各教員のコマ */}
                    {teachers.map(t => {
                      const result  = getEntry(t.id, day, period);
                      const entry   = result?.entry ?? null;
                      const role    = result?.role  ?? 'primary';
                      const isAlt   = role === 'alt';
                      const isGroup = role === 'group';
                      const cellStyle = getCellStyle(entry);

                      // グループセルは緑系背景
                      const bgColor = entry
                        ? isGroup ? '#D1FAE5'
                          : isAlt ? '#F5F3FF'
                          : cellStyle.backgroundColor
                        : '#fff';
                      const textColor = entry
                        ? isGroup ? '#065F46'
                          : isAlt ? '#5B21B6'
                          : cellStyle.color
                        : '#94A3B8';

                      // グループ情報
                      const grp = isGroup && entry?.teacher_group_id
                        ? (teacher_groups || []).find(g => g.id === entry.teacher_group_id)
                        : null;

                      return (
                        <td
                          key={t.id}
                          style={{
                            backgroundColor: bgColor,
                            color: textColor,
                            textAlign: 'center',
                            padding: '3px 4px',
                            borderBottom: period === PERIODS[PERIODS.length - 1] ? '2px solid #CBD5E1' : '1px solid #E2E8F0',
                            borderRight: '1px solid #E2E8F0',
                            minWidth: '80px',
                            verticalAlign: 'middle',
                            whiteSpace: 'pre-line',
                            lineHeight: 1.3,
                          }}
                        >
                          {entry ? (
                            <>
                              <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>
                                {classLabel(entry)}
                              </div>
                              <div style={{ fontSize: '0.72rem', marginTop: '1px', opacity: 0.85 }}>
                                {subjectLabel(entry, role)}
                              </div>
                              {/* バッジ */}
                              {isGroup && (
                                <div style={{
                                  display: 'inline-block', fontSize: '0.58rem',
                                  backgroundColor: '#A7F3D0', color: '#065F46',
                                  borderRadius: '3px', padding: '0 3px', marginTop: '1px', fontWeight: 600,
                                }}>
                                  👥 {grp?.name || 'グループ'}
                                </div>
                              )}
                              {!isGroup && entry.alt_subject && (
                                <div style={{
                                  display: 'inline-block', fontSize: '0.58rem',
                                  backgroundColor: isAlt ? '#DDD6FE' : '#DBEAFE',
                                  color: isAlt ? '#5B21B6' : '#1D4ED8',
                                  borderRadius: '3px', padding: '0 3px', marginTop: '1px', fontWeight: 600,
                                }}>
                                  {isAlt ? 'B週' : 'A週'}
                                </div>
                              )}
                            </>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: '#CBD5E1' }}>－</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TeacherScheduleGrid;
