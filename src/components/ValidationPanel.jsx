import React from 'react';
import { useTimetableStore } from '../store/useTimetableStore';

const ValidationPanel = () => {
  const { structure, getClassSubjectTotals, getConsecutiveDaysViolations } = useTimetableStore();
  const { grades, required_hours } = structure;

  const classList = [];
  grades.forEach(g => {
    g.classes.forEach(c => classList.push({ type: 'normal', grade: g.grade, class_name: c, label: `${g.grade}-${c}`, reqKey: `${g.grade}_通常` }));
    if (g.special_classes) {
      g.special_classes.forEach(c => classList.push({ type: 'special', grade: g.grade, class_name: c, label: `${g.grade}特支 ${c}`, reqKey: `${g.grade}_特支` }));
    }
  });

  const consecutiveViolations = getConsecutiveDaysViolations();

  return (
    <div className="validation-panel">
      <div className="validation-header">
        <h3 style={{ fontSize: '1rem', color: '#0F172A', margin: 0 }}>週あたりの授業時数チェック</h3>
        <span style={{ fontSize: '0.8rem', color: '#64748B' }}>（規定数と一致しない場合は赤色で警告されます）</span>
      </div>
      <div className="validation-grid">
        {classList.map(cls => {
          const totals = getClassSubjectTotals(cls.grade, cls.class_name);
          const required = required_hours[cls.reqKey] || {};
          const subjects = Object.keys(required);

          if (subjects.length === 0) return null;

          return (
            <div key={`${cls.grade}-${cls.class_name}`} className="class-validation" style={{
              backgroundColor: cls.type === 'special' ? '#FEF3C7' : '#F8FAFC'
            }}>
              <div className="class-badge">
                {cls.label}
              </div>
              <div className="subject-totals">
                {subjects.map(subj => {
                  const current = totals[subj] || 0;
                  const req = required[subj];
                  const isWarning = current !== req;

                  return (
                    <div key={subj} className="subject-item" style={{
                      backgroundColor: isWarning ? '#fee2e2' : '#dcfce7',
                      color: isWarning ? '#991b1b' : '#166534',
                      border: `1px solid ${isWarning ? '#f87171' : '#86efac'}`
                    }}>
                      <span style={{ fontWeight: 600 }}>{subj}</span>
                      <span style={{ marginLeft: '4px' }}>{current}/{req}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 連続授業日数の警告 */}
      {consecutiveViolations.length > 0 && (
        <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', backgroundColor: '#FFF7ED', border: '1px solid #FCD34D', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1rem' }}>⚠</span>
            <strong style={{ fontSize: '0.9rem', color: '#92400E' }}>連続授業日数の警告</strong>
          </div>
          <ul style={{ margin: 0, padding: '0 0 0 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {consecutiveViolations.map(v => (
              <li key={`${v.grade}-${v.class_name}-${v.subject}`} style={{ fontSize: '0.85rem', color: '#92400E' }}>
                <strong>{v.grade}年{v.class_name}</strong> ─ 「{v.subject}」が{v.maxConsecutive}日連続（上限: {v.limit}日）
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ValidationPanel;
