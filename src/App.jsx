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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z"/>
            </svg>
            自動生成
          </TonalBtn>

          <TonalBtn onClick={handleClearNonFixed}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 4h-3.5l-1-1h-5l-1 1H5v2h14M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6z"/>
            </svg>
            配置リセット
          </TonalBtn>

          <TonalBtn onClick={() => setIsChartOpen(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 20v-8H2l10-9 10 9h-3v8zm5-3h4v-5H10z"/>
            </svg>
            コマ数確認
          </TonalBtn>

          <TonalBtn onClick={() => setIsConstraintsOpen(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 18v-2h18v2zm0-5v-2h18v2zm0-5V6h18v2z"/>
            </svg>
            条件設定
          </TonalBtn>

          {/* Filled button (primary action) */}
          <FilledBtn onClick={() => setIsSettingsOpen(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.92c.04-.34.07-.69.07-1.08s-.03-.74-.07-1.08l2.32-1.82c.21-.16.27-.45.13-.68l-2.2-3.81c-.14-.23-.42-.31-.65-.23l-2.74 1.1c-.57-.43-1.17-.8-1.84-1.08L14 2.42A.52.52 0 0 0 13.5 2h-4.4a.52.52 0 0 0-.5.42l-.42 2.9c-.67.28-1.27.64-1.84 1.07L3.6 5.3c-.24-.08-.51 0-.65.22L.75 9.34c-.14.23-.08.52.13.68l2.32 1.82C3.16 12.26 3.13 12.62 3.13 13s.03.74.07 1.08L.88 15.9c-.21.16-.27.45-.13.68l2.2 3.81c.14.23.42.31.65.23l2.74-1.1c.57.43 1.17.8 1.84 1.08l.42 2.9c.05.24.26.42.5.42h4.4c.24 0 .46-.17.5-.42l.42-2.9c.67-.28 1.27-.64 1.84-1.07l2.74 1.1c.24.08.51 0 .65-.22l2.2-3.81c.14-.23.08-.52-.13-.68z"/>
            </svg>
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
