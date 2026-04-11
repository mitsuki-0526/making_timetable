import React, { useState } from 'react';
import { useTimetableStore } from '../store/useTimetableStore';

// グラフの最大バー幅（px）
const BAR_MAX_WIDTH = 200;

/**
 * 全教科 × 全クラス のコマ数（実績 / 目標）を表示するチャート。
 * - 学年タブで絞り込み
 * - 各クラスごとに教科別の実績/目標バーを表示
 */
export default function SubjectHoursChart({ onClose }) {
  const { structure, timetable } = useTimetableStore();
  const grades = structure.grades || [];

  const [selectedGrade, setSelectedGrade] = useState(
    grades.length > 0 ? grades[0].grade : null
  );

  if (grades.length === 0) {
    return (
      <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div style={panelStyle}>
          <ModalHeader onClose={onClose} />
          <p style={{ padding: '2rem', color: '#9ca3af', textAlign: 'center' }}>クラスが登録されていません。</p>
        </div>
      </div>
    );
  }

  const gradeObj = grades.find(g => g.grade === selectedGrade);
  if (!gradeObj) return null;

  // 対象学年の全クラス
  const allClasses = [
    ...(gradeObj.classes || []).map(c => ({ class_name: c, isSpecial: false })),
    ...(gradeObj.special_classes || []).map(c => ({ class_name: c, isSpecial: true })),
  ];

  // 当該学年で使われる全教科 (required_hours から収集)
  const classKeyNormal = `${selectedGrade}_通常`;
  const classKeySpecial = `${selectedGrade}_特支`;
  const subjectSet = new Set([
    ...Object.keys(structure.required_hours[classKeyNormal] || {}),
    ...Object.keys(structure.required_hours[classKeySpecial] || {}),
  ]);
  const subjects = [...subjectSet].sort();

  // 実績カウント (timetable から集計)
  // 隔週授業スロット（alt_subject あり）はA週・B週それぞれ1コマとしてカウント
  const countActual = (grade, class_name, subject) =>
    timetable.filter(
      e => e.grade === grade && e.class_name === class_name &&
           (e.subject === subject || e.alt_subject === subject)
    ).length;

  // 目標コマ数
  const getRequired = (class_name, subject) => {
    const isSpecial = class_name.includes('特支');
    const key = isSpecial ? classKeySpecial : classKeyNormal;
    return (structure.required_hours[key] || {})[subject] || 0;
  };

  // 全体の最大値（バースケール用）
  const maxRequired = Math.max(1, ...subjects.flatMap(s =>
    allClasses.map(({ class_name }) => getRequired(class_name, s))
  ));

  return (
    <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={panelStyle}>
        <ModalHeader onClose={onClose} />

        {/* 学年タブ */}
        <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid #e5e7eb', padding: '0 1.5rem' }}>
          {grades.map(g => (
            <button
              key={g.grade}
              onClick={() => setSelectedGrade(g.grade)}
              style={{
                padding: '0.6rem 1.2rem', background: 'none', border: 'none', cursor: 'pointer',
                fontWeight: selectedGrade === g.grade ? 700 : 400,
                color: selectedGrade === g.grade ? '#3B82F6' : '#6b7280',
                borderBottom: selectedGrade === g.grade ? '2px solid #3B82F6' : '2px solid transparent',
                fontSize: '0.9rem',
              }}
            >
              {g.grade}年生
            </button>
          ))}
        </div>

        {/* コンテンツ */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          {allClasses.length === 0 && (
            <p style={{ color: '#9ca3af', textAlign: 'center' }}>この学年にクラスが登録されていません。</p>
          )}

          {allClasses.map(({ class_name, isSpecial }) => (
            <div key={class_name} style={{ marginBottom: '2rem' }}>
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {isSpecial ? '🌟' : '🏫'}
                <span>{selectedGrade}年 {class_name}</span>
                <span style={{ fontSize: '0.78rem', color: '#9ca3af', fontWeight: 400 }}>（特別支援）</span>
              </h3>

              <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f8faff' }}>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#475569', fontWeight: 600, width: '80px', borderBottom: '1px solid #e5e7eb' }}>教科</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#475569', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>コマ数</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: '#475569', fontWeight: 600, width: '100px', borderBottom: '1px solid #e5e7eb' }}>実績 / 目標</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjects.map(subject => {
                      const required = getRequired(class_name, subject);
                      if (required === 0) return null;
                      const actual = countActual(selectedGrade, class_name, subject);
                      const ratio = required > 0 ? Math.min(actual / required, 1) : 0;
                      const over = actual > required;
                      const done = actual >= required;
                      const barColor = over ? '#EF4444' : done ? '#22C55E' : '#3B82F6';

                      return (
                        <tr key={subject} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: '#374151' }}>{subject}</td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {/* 目標バー（グレー背景） */}
                              <div style={{
                                width: `${BAR_MAX_WIDTH}px`, height: '16px', background: '#e5e7eb', borderRadius: '8px', overflow: 'hidden', flexShrink: 0
                              }}>
                                <div style={{
                                  width: `${ratio * 100}%`, height: '100%',
                                  background: barColor, borderRadius: '8px',
                                  transition: 'width 0.3s',
                                }} />
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700, color: over ? '#EF4444' : done ? '#22C55E' : '#374151' }}>
                            {actual} / {required}
                            {over && <span style={{ marginLeft: '4px', fontSize: '0.75rem' }}>⚠️超過</span>}
                            {done && !over && <span style={{ marginLeft: '4px', fontSize: '0.75rem', color: '#22C55E' }}>✓</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        {/* 凡例 */}
        <div style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '1.5rem', fontSize: '0.78rem', color: '#6b7280' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', background: '#3B82F6' }} />配置中
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', background: '#22C55E' }} />目標達成
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', background: '#EF4444' }} />目標超過
          </span>
          <span style={{ marginLeft: 'auto' }}>リアルタイム集計（保存不要）</span>
        </div>
      </div>
    </div>
  );
}

// ─── スタイル定数 ───────────────────────────
const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const panelStyle = {
  background: '#fff', borderRadius: '12px',
  width: '90vw', maxWidth: '700px', maxHeight: '85vh',
  display: 'flex', flexDirection: 'column',
  boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
};

function ModalHeader({ onClose }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.2rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>
      <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>📊 コマ数グラフ</h2>
      <button onClick={onClose}
        style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#6b7280', padding: '0.2rem 0.5rem' }}>
        ✕
      </button>
    </div>
  );
}
