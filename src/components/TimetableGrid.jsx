import React, { useState, useEffect, useCallback } from 'react';
import { useTimetableStore } from '../store/useTimetableStore';
import CellDropdown from './CellDropdown';

const DAYS = ['月', '火', '水', '木', '金'];
const PERIODS = [1, 2, 3, 4, 5, 6];

// 選択セルのキー: "grade|class_name|day|period"
const makeCellKey = (grade, class_name, day, period) => `${grade}|${class_name}|${day}|${period}`;
const parseCellKey = (key) => {
  const [gradeStr, class_name, day_of_week, periodStr] = key.split('|');
  return { grade: parseInt(gradeStr, 10), class_name, day_of_week, period: parseInt(periodStr, 10) };
};

const TimetableGrid = () => {
  const { structure, groupCells } = useTimetableStore();
  const { grades } = structure;

  const [selectedCells, setSelectedCells] = useState(new Set());

  // クラス行の設定
  const rowConfig = grades.flatMap(g => {
    const rows = [];
    g.classes.forEach(c => rows.push({ type: 'normal', grade: g.grade, class_name: c, label: `${g.grade}-${c}` }));
    if (g.special_classes) {
      g.special_classes.forEach(c => rows.push({ type: 'special', grade: g.grade, class_name: c, label: `${g.grade}特支\n${c}` }));
    }
    return rows;
  });

  // Ctrl+クリックでセルをトグル選択
  const handleCtrlClick = useCallback((grade, class_name, day, period) => {
    const key = makeCellKey(grade, class_name, day, period);
    setSelectedCells(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // 選択セルをグループ化
  const handleGroupSelected = useCallback(() => {
    const cells = Array.from(selectedCells).map(parseCellKey);
    groupCells(cells);
    setSelectedCells(new Set());
  }, [selectedCells, groupCells]);

  // Escapeで選択解除
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setSelectedCells(new Set());
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const selectedCount = selectedCells.size;

  return (
    <div className="grid-container">
      {selectedCount > 0 && (
        <div style={{
          padding: '6px 12px', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE',
          borderRadius: '6px', marginBottom: '8px', fontSize: '0.82rem',
          color: '#1D4ED8', display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <span>🔗 <strong>{selectedCount}</strong> セル選択中</span>
          <span style={{ color: '#64748B' }}>右クリック → グループ化 ／ Esc で選択解除</span>
          <button
            onClick={() => setSelectedCells(new Set())}
            style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '1rem' }}
          >✕</button>
        </div>
      )}
      <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
        <table className="grid-table">
          <thead>
            <tr>
              <th rowSpan={2} style={{ minWidth: '90px', position: 'sticky', left: 0, zIndex: 20, backgroundColor: '#F1F5F9', borderRight: '2px solid #CBD5E1', fontSize: '0.85rem' }}>クラス</th>
              {DAYS.map(day => (
                <th key={day} colSpan={PERIODS.length} style={{ textAlign: 'center', backgroundColor: '#E2E8F0', color: '#0F172A', borderBottom: '1px solid #CBD5E1', fontSize: '0.85rem', padding: '4px' }}>
                  {day}曜日
                </th>
              ))}
            </tr>
            <tr>
              {DAYS.map(day => (
                <React.Fragment key={`periods-${day}`}>
                  {PERIODS.map(period => (
                    <th key={`${day}-${period}`} style={{
                      minWidth: '45px', textAlign: 'center', fontSize: '0.75rem', padding: '2px',
                      borderRight: period === PERIODS[PERIODS.length - 1] ? '2px solid #94A3B8' : undefined,
                    }}>
                      {period}
                    </th>
                  ))}
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowConfig.map((rowObj, idx) => (
              <tr key={idx}>
                <td style={{
                  backgroundColor: rowObj.type === 'special' ? '#FEF3C7' : '#F8FAFC',
                  fontWeight: '500',
                  color: '#0F172A',
                  position: 'sticky',
                  left: 0,
                  zIndex: 5,
                  borderRight: '2px solid #CBD5E1',
                  fontSize: '0.8rem',
                  textAlign: 'center',
                  whiteSpace: 'pre-line',
                }}>
                  {rowObj.label}
                </td>
                {DAYS.map(day => (
                  <React.Fragment key={`${rowObj.class_name}-${day}`}>
                    {PERIODS.map(period => {
                      const key = makeCellKey(rowObj.grade, rowObj.class_name, day, period);
                      const isSelected = selectedCells.has(key);
                      return (
                        <td
                          key={`${rowObj.class_name}-${day}-${period}`}
                          style={{
                            borderRight: period === PERIODS[PERIODS.length - 1] ? '2px solid #94A3B8' : undefined,
                            outline: isSelected ? '2px solid #3B82F6' : undefined,
                            outlineOffset: '-2px',
                            position: 'relative',
                          }}
                        >
                          <div className="cell-content">
                            <CellDropdown
                              day_of_week={day}
                              period={period}
                              grade={rowObj.grade}
                              class_name={rowObj.class_name}
                              isSelected={isSelected}
                              onCtrlClick={() => handleCtrlClick(rowObj.grade, rowObj.class_name, day, period)}
                              selectedCount={selectedCount}
                              onGroupCells={handleGroupSelected}
                            />
                          </div>
                        </td>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TimetableGrid;
