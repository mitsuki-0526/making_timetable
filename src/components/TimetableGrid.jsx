import React from 'react';
import { useTimetableStore } from '../store/useTimetableStore';
import CellDropdown from './CellDropdown';

const DAYS = ['月', '火', '水', '木', '金'];
const PERIODS = [1, 2, 3, 4, 5, 6];

const TimetableGrid = () => {
  const { structure } = useTimetableStore();
  const { grades } = structure;

  // Flatten normal and special classes per grade
  const rowConfig = grades.flatMap(g => {
    const rows = [];
    g.classes.forEach(c => rows.push({ type: 'normal', grade: g.grade, class_name: c, label: `${g.grade}-${c}` }));
    if (g.special_classes) {
      g.special_classes.forEach(c => rows.push({ type: 'special', grade: g.grade, class_name: c, label: `${g.grade}特支\n${c}` }));
    }
    return rows;
  });

  return (
    <div className="grid-container">
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
                  whiteSpace: 'pre-line' // To allow \n in label
                }}>
                  {rowObj.label}
                </td>
                {DAYS.map(day => (
                  <React.Fragment key={`${rowObj.class_name}-${day}`}>
                    {PERIODS.map(period => (
                      <td key={`${rowObj.class_name}-${day}-${period}`} style={{
                        borderRight: period === PERIODS[PERIODS.length - 1] ? '2px solid #94A3B8' : undefined,
                      }}>
                        <div className="cell-content">
                          <CellDropdown
                            day_of_week={day}
                            period={period}
                            grade={rowObj.grade}
                            class_name={rowObj.class_name}
                          />
                        </div>
                      </td>
                    ))}
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

