import React, { useState, useRef, useEffect } from 'react';
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
const IconBtn = ({ className = '', onClick, title, children, type = 'button', disabled = false }) => (
  <button
    type={type}
    className={`icon-btn ${className}`.trim()}
    onClick={onClick}
    title={title}
    disabled={disabled}
  >
    {children}
  </button>
);

/* ── M3 Tonal Button ───────────────────────────────────────── */
const TonalBtn = ({ onClick, children, disabled = false, title }) => (
  <button type="button" className="tonal-btn" onClick={onClick} disabled={disabled} title={title}>
    {children}
  </button>
);

/* ── M3 Filled Button (primary CTA) ───────────────────────── */
const FilledBtn = ({ onClick, children, disabled = false, title }) => (
  <button type="button" className="filled-btn" onClick={onClick} disabled={disabled} title={title}>
    {children}
  </button>
);

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isConstraintsOpen, setIsConstraintsOpen] = useState(false);
  const [isChartOpen, setIsChartOpen] = useState(false);
  const [isSolverOpen, setIsSolverOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCompactHeader, setIsCompactHeader] = useState(false);
  const headerRef = useRef(null);
  const titleRef = useRef(null);
  const headerActionsRef = useRef(null);
  const menuToggleRef = useRef(null);
  const clearNonFixed = useTimetableStore(s => s.clearNonFixed);

  useEffect(() => {
    const updateCompactLayout = () => {
      if (isMenuOpen) return;
      if (!headerRef.current || !headerActionsRef.current || !titleRef.current) return;

      const headerWidth = headerRef.current.getBoundingClientRect().width;
      const titleWidth = titleRef.current.getBoundingClientRect().width;
      const actionsWidth = headerActionsRef.current.scrollWidth;
      const buffer = 56; // spacing, icon button, and padding buffer

      const shouldCompact = titleWidth + actionsWidth + buffer > headerWidth;
      setIsCompactHeader(shouldCompact);
    };

    updateCompactLayout();

    const resizeObserver = new ResizeObserver(updateCompactLayout);
    resizeObserver.observe(headerRef.current);
    resizeObserver.observe(headerActionsRef.current);

    window.addEventListener('resize', updateCompactLayout);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateCompactLayout);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (event) => {
      if (
        headerActionsRef.current && !headerActionsRef.current.contains(event.target) &&
        menuToggleRef.current && !menuToggleRef.current.contains(event.target)
      ) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const handleClearNonFixed = () => {
    if (window.confirm('固定コマ以外のすべての教科・教員配置を削除します。よろしいですか？')) {
      clearNonFixed();
    }
  };

  return (
    <div className="layout">
      {/* M3 Top App Bar */}
      <header className="header" ref={headerRef}>
        <h1 ref={titleRef}>時間割作成ツール</h1>

        <button
          ref={menuToggleRef}
          className={`icon-btn header__menu-toggle ${isCompactHeader ? 'visible' : ''}`.trim()}
          onClick={() => setIsMenuOpen(open => !open)}
          title="メニュー"
          type="button"
        >
          <span className="kebab-dot" />
          <span className="kebab-dot" />
          <span className="kebab-dot" />
        </button>

        <div
          ref={headerActionsRef}
          className={`header__actions${isCompactHeader ? ' header__actions--compact' : ''}${isMenuOpen ? ' header__actions--open' : ''}`}
        >
          {/* File / PDF — Outlined buttons (secondary actions) */}
          <FileActions>
            {({ handleOverwriteSave, handleSaveAs, handleLoad, fileHandle, fileName }) => (
              <>
                <TonalBtn
                  onClick={handleOverwriteSave}
                  disabled={!fileHandle}
                  title={fileHandle ? `「${fileName}」に上書き保存` : '先にファイルを読み込んでください'}
                >
                  💾 上書保存
                  {fileName && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 'normal', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      ({fileName})
                    </span>
                  )}
                </TonalBtn>
                <TonalBtn onClick={handleSaveAs} title="新しいファイルとしてダウンロード保存">
                  📥 保存
                </TonalBtn>
                <TonalBtn onClick={handleLoad} title="時間割データを読み込みます">
                  📂 読込
                </TonalBtn>
              </>
            )}
          </FileActions>
          <PdfExport>
            {({ open }) => (
              <TonalBtn onClick={open} title="時間割・先生コマ数をPDFで出力">
                📄 PDF出力
              </TonalBtn>
            )}
          </PdfExport>

          {/* Divider */}
          <div className="header__separator" />

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
