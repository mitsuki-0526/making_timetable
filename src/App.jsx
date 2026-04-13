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
  const [activeView, setActiveView] = useState('class_view'); // 'class_view' or 'teacher_view'
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

  const getPageTitle = () => {
    switch (activeView) {
      case 'class_view': return 'クラス別 時間割';
      case 'teacher_view': return '教員別 コマ数';
      default: return '';
    }
  };

  return (
    <div className="app-layout">
      {/* ── Left Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--md-primary)', fontWeight: 700, fontSize: '1.25rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>school</span>
            <span>Timetable Pro</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-title">メインビュー</div>
          
          <button 
            className={`sidebar-item ${activeView === 'class_view' ? 'active' : ''}`}
            onClick={() => setActiveView('class_view')}
          >
            <span className="material-symbols-outlined">dashboard</span>
            <span>クラス別 時間割</span>
          </button>
          
          <button 
            className={`sidebar-item ${activeView === 'teacher_view' ? 'active' : ''}`}
            onClick={() => setActiveView('teacher_view')}
          >
            <span className="material-symbols-outlined">person_book</span>
            <span>教員別 コマ数</span>
          </button>

          <div className="sidebar-section-title" style={{ marginTop: '1.25rem' }}>データ確認・設定</div>
          
          <button className="sidebar-item" onClick={() => setIsChartOpen(true)}>
            <span className="material-symbols-outlined">bar_chart</span>
            <span>時数グラフ確認</span>
          </button>
          
          <button className="sidebar-item" onClick={() => setIsConstraintsOpen(true)}>
            <span className="material-symbols-outlined">rule_settings</span>
            <span>条件設定</span>
          </button>

          <button className="sidebar-item" onClick={() => setIsSettingsOpen(true)}>
            <span className="material-symbols-outlined">database</span>
            <span>マスタ設定</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <button 
            onClick={() => setIsSolverOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              padding: '0.8rem 1rem', background: 'var(--md-primary)', color: 'var(--md-on-primary)',
              borderRadius: 'var(--md-shape-lg)', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--md-font-brand)', fontWeight: 600, fontSize: '14px', letterSpacing: '0.5px',
              boxShadow: '0 4px 12px rgba(100,66,214,0.25)', transition: 'transform 0.1s, box-shadow 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(100,66,214,0.3)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(100,66,214,0.25)'; }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>auto_awesome</span>
            自動生成 (Optimize)
          </button>
        </div>
      </aside>

      {/* ── Main Container ── */}
      <div className="main-container">
        <header className="top-header">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 600, color: 'var(--md-on-surface)', letterSpacing: '-0.5px', fontFamily: 'var(--md-font-brand)' }}>
              {getPageTitle()}
            </h1>
            {activeView === 'class_view' && (
              <span style={{ fontSize: '0.8rem', color: 'var(--md-on-surface-variant)' }}>クラスごとの週間の授業の割り当てを管理します</span>
            )}
            {activeView === 'teacher_view' && (
              <span style={{ fontSize: '0.8rem', color: 'var(--md-on-surface-variant)' }}>教員ごとのコマ数と担当クラスを確認します</span>
            )}
          </div>
          
          <div className="top-header-right">
            <TonalBtn onClick={handleClearNonFixed}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete_sweep</span>
              配置リセット
            </TonalBtn>
            <div style={{ width: 1, height: 24, background: 'var(--md-outline-variant)', margin: '0 0.5rem' }} />
            <FileActions />
            <PdfExport />
          </div>
        </header>

        <main className="main-content-scroll">
          {activeView === 'class_view' && (
            <div className="fade-in">
              <TimetableGrid />
              <div style={{ marginTop: '2rem' }}>
                <ValidationPanel />
              </div>
            </div>
          )}
          
          {activeView === 'teacher_view' && (
            <div className="fade-in">
              {/* Reset marginTop since it might be expecting stacking */}
              <div style={{ marginTop: '-1.5rem' }}>
                <TeacherScheduleGrid />
              </div>
            </div>
          )}
        </main>
      </div>

      {isSettingsOpen    && <SettingsModal    onClose={() => setIsSettingsOpen(false)} />}
      {isConstraintsOpen && <ConstraintsModal onClose={() => setIsConstraintsOpen(false)} />}
      {isChartOpen       && <SubjectHoursChart onClose={() => setIsChartOpen(false)} />}
      {isSolverOpen      && <SolverPanel      onClose={() => setIsSolverOpen(false)} />}
    </div>
  );
}

export default App;
