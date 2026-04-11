import React, { useState } from 'react';
import { useTimetableStore } from './store/useTimetableStore';
import TimetableGrid from './components/TimetableGrid';
import ValidationPanel from './components/ValidationPanel';
import TeacherScheduleGrid from './components/TeacherScheduleGrid';
import SettingsModal from './components/SettingsModal';
import ConstraintsModal from './components/ConstraintsModal';
import SubjectHoursChart from './components/SubjectHoursChart';
import FileActions from './components/FileActions';
import PdfExport from './components/PdfExport';
import SolverPanel from './components/SolverPanel';

/* ── M3 Icon Button ────────────────────────────────────────── */
const IconBtn = ({ onClick, title, children }) => (
  <button
    onClick={onClick}
    title={title}
    style={{
      width: 40, height: 40,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'none',
      border: 'none',
      borderRadius: '50%',
      cursor: 'pointer',
      color: 'var(--md-on-surface-variant)',
      fontSize: '1.1rem',
      position: 'relative',
      overflow: 'hidden',
      transition: 'color 0.2s',
      flexShrink: 0,
    }}
    onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--md-on-surface-variant) 8%, transparent)'}
    onMouseLeave={e => e.currentTarget.style.background = 'none'}
  >
    {children}
  </button>
);

/* ── M3 Tonal Button ───────────────────────────────────────── */
const TonalBtn = ({ onClick, children }) => (
  <button
    onClick={onClick}
    style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
      padding: '0.625rem 1.25rem',
      background: 'var(--md-secondary-container)',
      color: 'var(--md-on-secondary-container)',
      border: 'none',
      borderRadius: 'var(--md-shape-full)',
      cursor: 'pointer',
      fontFamily: 'var(--md-font-brand)',
      fontSize: '14px', fontWeight: 500,
      letterSpacing: '0.1px',
      position: 'relative', overflow: 'hidden',
      transition: 'box-shadow 0.2s cubic-bezier(0.2,0,0,1)',
      whiteSpace: 'nowrap',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.1)';
    }}
    onMouseLeave={e => {
      e.currentTarget.style.boxShadow = 'none';
    }}
  >
    {children}
  </button>
);

/* ── M3 Filled Button (primary CTA) ───────────────────────── */
const FilledBtn = ({ onClick, children }) => (
  <button
    onClick={onClick}
    style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
      padding: '0.625rem 1.5rem',
      background: 'var(--md-primary)',
      color: 'var(--md-on-primary)',
      border: 'none',
      borderRadius: 'var(--md-shape-full)',
      cursor: 'pointer',
      fontFamily: 'var(--md-font-brand)',
      fontSize: '14px', fontWeight: 500,
      letterSpacing: '0.1px',
      position: 'relative', overflow: 'hidden',
      transition: 'box-shadow 0.2s cubic-bezier(0.2,0,0,1)',
      whiteSpace: 'nowrap',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.3), 0 2px 6px rgba(100,66,214,0.3)';
    }}
    onMouseLeave={e => {
      e.currentTarget.style.boxShadow = 'none';
    }}
  >
    {children}
  </button>
);

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isConstraintsOpen, setIsConstraintsOpen] = useState(false);
  const [isChartOpen, setIsChartOpen] = useState(false);
  const [isSolverOpen, setIsSolverOpen] = useState(false);
  const clearNonFixed = useTimetableStore(s => s.clearNonFixed);

  const handleClearNonFixed = () => {
    if (window.confirm('固定コマ以外のすべての教科・教員配置を削除します。よろしいですか？')) {
      clearNonFixed();
    }
  };

  return (
    <div className="layout">
      {/* M3 Top App Bar */}
      <header className="header">
        <h1>時間割作成ツール</h1>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* File / PDF — Outlined buttons (secondary actions) */}
          <FileActions />
          <PdfExport />

          {/* Divider */}
          <div style={{ width: 1, height: 24, background: 'var(--md-outline-variant)', margin: '0 0.25rem', flexShrink: 0 }} />

          {/* Tonal buttons (medium importance) */}
          <TonalBtn onClick={() => setIsSolverOpen(true)}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>smart_toy</span>
            自動生成
          </TonalBtn>

          <TonalBtn onClick={handleClearNonFixed}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete_sweep</span>
            配置リセット
          </TonalBtn>

          <TonalBtn onClick={() => setIsChartOpen(true)}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>bar_chart</span>
            コマ数確認
          </TonalBtn>

          <TonalBtn onClick={() => setIsConstraintsOpen(true)}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>rule</span>
            条件設定
          </TonalBtn>

          {/* Filled button (primary action) */}
          <FilledBtn onClick={() => setIsSettingsOpen(true)}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>settings</span>
            マスタ設定
          </FilledBtn>
        </div>
      </header>

      <main className="main-content">
        <TimetableGrid />
        <ValidationPanel />
        <TeacherScheduleGrid />
      </main>

      {isSettingsOpen    && <SettingsModal    onClose={() => setIsSettingsOpen(false)} />}
      {isConstraintsOpen && <ConstraintsModal onClose={() => setIsConstraintsOpen(false)} />}
      {isChartOpen       && <SubjectHoursChart onClose={() => setIsChartOpen(false)} />}
      {isSolverOpen      && <SolverPanel      onClose={() => setIsSolverOpen(false)} />}
    </div>
  );
}

export default App;
