import { useEffect, useRef, useState } from "react";
import ConstraintsModal from "./components/ConstraintsModal";
import FileActions from "./components/FileActions";
import PdfExport from "./components/PdfExport";
import SettingsModal from "./components/SettingsModal";
import SolverPanel from "./components/SolverPanel";
import SubjectHoursChart from "./components/SubjectHoursChart";
import TeacherScheduleGrid from "./components/TeacherScheduleGrid";
import TimetableGrid from "./components/TimetableGrid";
import ValidationPanel from "./components/ValidationPanel";
import { useTimetableStore } from "./store/useTimetableStore";

/* ── M3 Tonal Button ───────────────────────────────────────── */
const TonalBtn = ({ onClick, children, disabled = false, title }) => (
  <button
    type="button"
    className="tonal-btn"
    onClick={onClick}
    disabled={disabled}
    title={title}
  >
    {children}
  </button>
);

/* ── M3 Filled Button (primary CTA) ───────────────────────── */
const FilledBtn = ({ onClick, children, disabled = false, title }) => (
  <button
    type="button"
    className="filled-btn"
    onClick={onClick}
    disabled={disabled}
    title={title}
  >
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
  const clearNonFixed = useTimetableStore((s) => s.clearNonFixed);

  useEffect(() => {
    const updateCompactLayout = () => {
      if (isMenuOpen) return;
      if (!headerRef.current || !headerActionsRef.current || !titleRef.current)
        return;

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

    window.addEventListener("resize", updateCompactLayout);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateCompactLayout);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (event) => {
      if (
        headerActionsRef.current &&
        !headerActionsRef.current.contains(event.target) &&
        menuToggleRef.current &&
        !menuToggleRef.current.contains(event.target)
      ) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  const handleClearNonFixed = () => {
    if (
      window.confirm(
        "固定コマ以外のすべての教科・教員配置を削除します。よろしいですか？",
      )
    ) {
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
          className={`icon-btn header__menu-toggle ${isCompactHeader ? "visible" : ""}`.trim()}
          onClick={() => setIsMenuOpen((open) => !open)}
          title="メニュー"
          type="button"
        >
          <span className="kebab-dot" />
          <span className="kebab-dot" />
          <span className="kebab-dot" />
        </button>

        <div
          ref={headerActionsRef}
          className={`header__actions${isCompactHeader ? " header__actions--compact" : ""}${isMenuOpen ? " header__actions--open" : ""}`}
        >
          {/* File / PDF — Outlined buttons (secondary actions) */}
          <FileActions>
            {({
              handleOverwriteSave,
              handleSaveAs,
              handleLoad,
              handleExcelExport,
              fileHandle,
              fileName,
            }) => (
              <>
                <TonalBtn
                  onClick={handleOverwriteSave}
                  disabled={!fileHandle}
                  title={
                    fileHandle
                      ? `「${fileName}」に上書き保存`
                      : "先にファイルを読み込んでください"
                  }
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "16px" }}
                  >
                    save
                  </span>{" "}
                  上書保存
                  {fileName && (
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: "normal",
                        maxWidth: "80px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      ({fileName})
                    </span>
                  )}
                </TonalBtn>
                <TonalBtn
                  onClick={handleSaveAs}
                  title="新しいファイルとしてダウンロード保存"
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "16px" }}
                  >
                    download
                  </span>{" "}
                  保存
                </TonalBtn>
                <TonalBtn
                  onClick={handleLoad}
                  title="時間割データを読み込みます"
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "16px" }}
                  >
                    folder_open
                  </span>{" "}
                  読込
                </TonalBtn>
                <TonalBtn
                  onClick={handleExcelExport}
                  title="時間割をExcelファイルで出力"
                  style={{
                    background: "#7c3aed",
                    color: "#fff",
                    borderColor: "#7c3aed",
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "16px" }}
                  >
                    table_view
                  </span>{" "}
                  Excel出力
                </TonalBtn>
              </>
            )}
          </FileActions>
          <PdfExport>
            {({ open }) => (
              <TonalBtn onClick={open} title="時間割・先生コマ数をPDFで出力">
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "16px" }}
                >
                  picture_as_pdf
                </span>{" "}
                PDF出力
              </TonalBtn>
            )}
          </PdfExport>

          {/* Divider */}
          <div className="header__separator" />

          {/* Tonal buttons (medium importance) */}
          <TonalBtn onClick={() => setIsSolverOpen(true)}>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "16px" }}
            >
              auto_awesome
            </span>
            自動生成
          </TonalBtn>

          <TonalBtn onClick={handleClearNonFixed}>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "16px" }}
            >
              restart_alt
            </span>
            配置リセット
          </TonalBtn>

          <TonalBtn onClick={() => setIsChartOpen(true)}>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "16px" }}
            >
              bar_chart
            </span>
            コマ数確認
          </TonalBtn>

          <TonalBtn onClick={() => setIsConstraintsOpen(true)}>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "16px" }}
            >
              rule
            </span>
            条件設定
          </TonalBtn>

          {/* Filled button (primary action) */}
          <FilledBtn onClick={() => setIsSettingsOpen(true)}>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "16px" }}
            >
              settings
            </span>
            マスタ設定
          </FilledBtn>
        </div>
      </header>

      <main className="main-content">
        <TimetableGrid />
        <ValidationPanel />
        <TeacherScheduleGrid />
      </main>

      {isSettingsOpen && (
        <SettingsModal onClose={() => setIsSettingsOpen(false)} />
      )}
      {isConstraintsOpen && (
        <ConstraintsModal onClose={() => setIsConstraintsOpen(false)} />
      )}
      {isChartOpen && (
        <SubjectHoursChart onClose={() => setIsChartOpen(false)} />
      )}
      {isSolverOpen && <SolverPanel onClose={() => setIsSolverOpen(false)} />}
    </div>
  );
}

export default App;
