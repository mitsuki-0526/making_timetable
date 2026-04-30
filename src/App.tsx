import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { Toaster } from "@/components/ui/sonner";
import { AppSidebar } from "./components/AppSidebar";
import { ConflictList } from "./components/ConflictList";
import ConstraintsModal from "./components/ConstraintsModal";
import FileActions from "./components/FileActions";
import { Inspector } from "./components/Inspector";
import { MatrixView } from "./components/MatrixView";
import SettingsModal from "./components/SettingsModal";
import SolverPanel from "./components/SolverPanel";
import { StatusBar } from "./components/StatusBar";
import { SubjectHoursBars } from "./components/SubjectHoursBars";
import { TeacherList, TeacherWeekView } from "./components/TeacherWeekView";
import { Topbar } from "./components/Topbar";
import { WarnBanner } from "./components/WarnBanner";
import { WeekGrid } from "./components/WeekGrid";
import { useViolations, type ViolationItem } from "./hooks/useViolations";
import { useTimetableStore } from "./store/useTimetableStore";
import type { DayOfWeek, Period } from "./types";

type PanelType = "class" | "matrix" | "teacher" | "hours";
type RightTab = "insp" | "conf" | "hist";

interface SelectedCell {
  grade: number;
  class_name: string;
  day_of_week: DayOfWeek;
  period: Period;
}

const makeSelectedCellKey = ({
  grade,
  class_name,
  day_of_week,
  period,
}: SelectedCell) => `${grade}|${class_name}|${day_of_week}|${period}`;

const parseSelectedCellKey = (key: string): SelectedCell => {
  const [grade, class_name, day_of_week, period] = key.split("|");
  return {
    grade: Number(grade),
    class_name,
    day_of_week: day_of_week as DayOfWeek,
    period: Number(period) as Period,
  };
};

interface ClassOption {
  grade: number;
  class_name: string;
  label: string;
}

const DEFAULT_INSPECTOR_WIDTH = 300;
const MIN_INSPECTOR_WIDTH = 240;
const MAX_INSPECTOR_WIDTH = 520;
const FALLBACK_LEFT_SIDEBAR_WIDTH = 240;
const MIN_LEFT_SIDEBAR_WIDTH = 180;
const MAX_LEFT_SIDEBAR_WIDTH = 420;
const DEFAULT_MATRIX_ZOOM = 100;
const MIN_MATRIX_ZOOM = 50;
const MAX_MATRIX_ZOOM = 200;
const MATRIX_ZOOM_STEP = 10;

const clampInspectorWidth = (width: number) =>
  Math.min(MAX_INSPECTOR_WIDTH, Math.max(MIN_INSPECTOR_WIDTH, width));

const clampLeftSidebarWidth = (width: number) =>
  Math.min(MAX_LEFT_SIDEBAR_WIDTH, Math.max(MIN_LEFT_SIDEBAR_WIDTH, width));

const getDefaultLeftSidebarWidth = () => {
  if (typeof window === "undefined") {
    return FALLBACK_LEFT_SIDEBAR_WIDTH;
  }
  return clampLeftSidebarWidth(window.innerWidth * 0.2);
};

const clampMatrixZoom = (zoomPercent: number) =>
  Math.min(MAX_MATRIX_ZOOM, Math.max(MIN_MATRIX_ZOOM, zoomPercent));

function App() {
  const { structure, clearNonFixed } = useTimetableStore();
  const teachers = useTimetableStore((s) => s.teachers);
  const setTimetableEntry = useTimetableStore((s) => s.setTimetableEntry);
  const mainPaneRef = useRef<HTMLDivElement | null>(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isConstraintsOpen, setIsConstraintsOpen] = useState(false);
  const [isSolverOpen, setIsSolverOpen] = useState(false);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [activePaletteSubject, setActivePaletteSubject] = useState<
    string | null
  >(null);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(() =>
    getDefaultLeftSidebarWidth(),
  );
  const [isLeftSidebarResizing, setIsLeftSidebarResizing] = useState(false);
  const [inspectorWidth, setInspectorWidth] = useState(DEFAULT_INSPECTOR_WIDTH);
  const [isInspectorResizing, setIsInspectorResizing] = useState(false);
  const [matrixZoomPercent, setMatrixZoomPercent] =
    useState(DEFAULT_MATRIX_ZOOM);

  const [panel, setPanel] = useState<PanelType>("matrix");
  const [rightTab, setRightTab] = useState<RightTab>("insp");
  const [filterGrade, setFilterGrade] = useState<number | null>(null);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [selectedCellKeys, setSelectedCellKeys] = useState<Set<string>>(
    new Set(),
  );

  const defaultClass = useMemo<ClassOption | null>(() => {
    const g = structure.grades[0];
    if (!g) return null;
    const cn = g.classes[0];
    if (!cn) return null;
    return { grade: g.grade, class_name: cn, label: `${g.grade}年${cn}` };
  }, [structure.grades]);

  const [selectedClass, setSelectedClass] = useState<ClassOption | null>(
    defaultClass,
  );
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(
    teachers[0]?.id ?? "",
  );

  const { violations, conflictKeys, totalCount, hardCount, softCount } =
    useViolations();

  const selectedCells = useMemo(
    () => Array.from(selectedCellKeys).map(parseSelectedCellKey),
    [selectedCellKeys],
  );

  const mainLayoutStyle = useMemo(
    () =>
      ({
        "--la-left-sidebar-width": `${leftSidebarWidth}px`,
        "--la-inspector-width": `${inspectorWidth}px`,
      }) as CSSProperties,
    [inspectorWidth, leftSidebarWidth],
  );

  const mainLayoutClassName = `la-main${isLeftSidebarOpen ? "" : " la-main-left-collapsed"}${isRightSidebarOpen ? "" : " la-main-right-collapsed"}`;

  const handleSelectCell = (
    cell: SelectedCell,
    options?: { additive?: boolean },
  ) => {
    const key = makeSelectedCellKey(cell);
    setSelectedCell(cell);
    setRightTab("insp");
    setSelectedCellKeys((current) => {
      if (options?.additive) {
        return new Set([...current, key]);
      }
      return new Set([key]);
    });
  };

  const handleClearSelection = () => {
    setSelectedCell(null);
    setSelectedCellKeys(new Set());
  };

  const handleClearMultiSelection = () => {
    if (selectedCell) {
      setSelectedCellKeys(new Set([makeSelectedCellKey(selectedCell)]));
      return;
    }
    setSelectedCellKeys(new Set());
  };

  const handleClearNonFixed = () => {
    if (
      window.confirm(
        "固定コマ以外のすべての教科・教員配置を削除します。よろしいですか？",
      )
    ) {
      clearNonFixed();
    }
  };

  const handleJumpToConflict = (item: ViolationItem) => {
    if (item.grade && item.class_name && item.day && item.period) {
      setPanel("class");
      const g = structure.grades.find((gr) => gr.grade === item.grade);
      if (g) {
        setSelectedClass({
          grade: item.grade,
          class_name: item.class_name,
          label: `${item.grade}年${item.class_name}`,
        });
        setSelectedCell({
          grade: item.grade,
          class_name: item.class_name,
          day_of_week: item.day,
          period: item.period,
        });
        setSelectedCellKeys(
          new Set([
            makeSelectedCellKey({
              grade: item.grade,
              class_name: item.class_name,
              day_of_week: item.day,
              period: item.period,
            }),
          ]),
        );
        setRightTab("insp");
      }
    }
  };

  const applySubjectToCells = (cells: SelectedCell[], subject: string) => {
    for (const cell of cells) {
      setTimetableEntry(
        cell.day_of_week,
        cell.period,
        cell.grade,
        cell.class_name,
        null,
        subject,
      );
    }
  };

  const handlePaletteSubjectSelect = (subject: string) => {
    if (selectedCells.length > 0) {
      applySubjectToCells(selectedCells, subject);
    }
    setActivePaletteSubject((current) =>
      current === subject ? null : subject,
    );
  };

  const handlePaintSubjectOnCell = (cell: SelectedCell) => {
    if (!activePaletteSubject) return;
    applySubjectToCells([cell], activePaletteSubject);
  };

  const updateLeftSidebarWidthFromClientX = (clientX: number) => {
    const mainPane = mainPaneRef.current;
    if (!mainPane) return;
    const nextWidth = clientX - mainPane.getBoundingClientRect().left;
    setLeftSidebarWidth(clampLeftSidebarWidth(nextWidth));
  };

  const handleLeftSidebarResizePointerDown = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsLeftSidebarResizing(true);
    updateLeftSidebarWidthFromClientX(event.clientX);
  };

  const handleLeftSidebarResizePointerMove = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (!isLeftSidebarResizing) return;
    updateLeftSidebarWidthFromClientX(event.clientX);
  };

  const handleLeftSidebarResizePointerUp = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsLeftSidebarResizing(false);
  };

  const handleLeftSidebarResizeKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
  ) => {
    const step = event.shiftKey ? 24 : 12;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setLeftSidebarWidth((current) => clampLeftSidebarWidth(current - step));
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setLeftSidebarWidth((current) => clampLeftSidebarWidth(current + step));
    }
    if (event.key === "Home") {
      event.preventDefault();
      setLeftSidebarWidth(MIN_LEFT_SIDEBAR_WIDTH);
    }
    if (event.key === "End") {
      event.preventDefault();
      setLeftSidebarWidth(MAX_LEFT_SIDEBAR_WIDTH);
    }
  };

  const updateInspectorWidthFromClientX = (clientX: number) => {
    const mainPane = mainPaneRef.current;
    if (!mainPane) return;
    const nextWidth = mainPane.getBoundingClientRect().right - clientX;
    setInspectorWidth(clampInspectorWidth(nextWidth));
  };

  const handleInspectorResizePointerDown = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsInspectorResizing(true);
    updateInspectorWidthFromClientX(event.clientX);
  };

  const handleInspectorResizePointerMove = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (!isInspectorResizing) return;
    updateInspectorWidthFromClientX(event.clientX);
  };

  const handleInspectorResizePointerUp = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsInspectorResizing(false);
  };

  const handleInspectorResizeKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
  ) => {
    const step = event.shiftKey ? 24 : 12;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setInspectorWidth((current) => clampInspectorWidth(current + step));
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setInspectorWidth((current) => clampInspectorWidth(current - step));
    }
    if (event.key === "Home") {
      event.preventDefault();
      setInspectorWidth(MIN_INSPECTOR_WIDTH);
    }
    if (event.key === "End") {
      event.preventDefault();
      setInspectorWidth(MAX_INSPECTOR_WIDTH);
    }
  };

  return (
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
          <Toaster />
          <div
            className={`layout-a${
              isLeftSidebarResizing || isInspectorResizing ? " la-resizing" : ""
            }`}
          >
            <Topbar
              fileName={fileName}
              isLeftSidebarOpen={isLeftSidebarOpen}
              isRightSidebarOpen={isRightSidebarOpen}
              onSave={handleOverwriteSave}
              onToggleLeftSidebar={() =>
                setIsLeftSidebarOpen((current) => !current)
              }
              onToggleRightSidebar={() =>
                setIsRightSidebarOpen((current) => !current)
              }
            />

            <div
              className={mainLayoutClassName}
              ref={mainPaneRef}
              style={mainLayoutStyle}
            >
              {/* 左サイドバー */}
              <AppSidebar
                panel={panel}
                onPanelChange={setPanel}
                selectedClass={selectedClass}
                onClassChange={setSelectedClass}
                selectedTeacherId={selectedTeacherId}
                onTeacherChange={setSelectedTeacherId}
                filterGrade={filterGrade}
                onFilterGradeChange={setFilterGrade}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onOpenConstraints={() => setIsConstraintsOpen(true)}
                onOpenSolver={() => setIsSolverOpen(true)}
                onClearNonFixed={handleClearNonFixed}
                onOverwriteSave={handleOverwriteSave}
                onSaveAs={handleSaveAs}
                onLoad={handleLoad}
                onExcelExport={handleExcelExport}
                hasFileHandle={!!fileHandle}
                activePaletteSubject={activePaletteSubject}
                selectedCellCount={selectedCells.length}
                onSelectPaletteSubject={handlePaletteSubjectSelect}
                onClearPaletteSubject={() => setActivePaletteSubject(null)}
              />

              <button
                aria-label="左サイドバーの幅を調整"
                className="la-left-sidebar-resizer"
                onDoubleClick={() =>
                  setLeftSidebarWidth(getDefaultLeftSidebarWidth())
                }
                onKeyDown={handleLeftSidebarResizeKeyDown}
                onLostPointerCapture={() => setIsLeftSidebarResizing(false)}
                onPointerDown={handleLeftSidebarResizePointerDown}
                onPointerMove={handleLeftSidebarResizePointerMove}
                onPointerUp={handleLeftSidebarResizePointerUp}
                tabIndex={0}
                title="左右ドラッグで左サイドバーの幅を変更 / ダブルクリックで初期幅に戻す"
                type="button"
              >
                <span
                  aria-hidden="true"
                  className="la-sidebar-resizer-grip"
                />
              </button>

              {/* 中央ペイン */}
              <section
                className="la-center-pane"
                aria-label="時間割エリア"
                onDragOver={(e) => e.preventDefault()}
              >
                <div style={{ padding: "12px 16px 0 16px", flexShrink: 0 }}>
                  <WarnBanner
                    hardCount={hardCount}
                    softCount={softCount}
                    onShowConflicts={() => setRightTab("conf")}
                  />
                </div>
                <div className="la-center-scroll">
                  {panel === "class" && selectedClass && (
                    <div className="ds-stack ds-gap-12">
                      <div className="ds-flex ds-between ds-center">
                        <div>
                          <div
                            style={{
                              fontSize: 16,
                              fontWeight: 700,
                              color: "var(--ds-text)",
                            }}
                          >
                            {selectedClass.label} 週間時間割
                          </div>
                          <div className="ds-small ds-muted">
                            {activePaletteSubject
                              ? `「${activePaletteSubject}」をクリック配置中 / Ctrl・Cmd+クリックで複数選択 / D&Dで入替`
                              : "クリックでセル選択・右パネルで編集 / D&Dで入替"}
                          </div>
                        </div>
                      </div>
                      <WeekGrid
                        grade={selectedClass.grade}
                        class_name={selectedClass.class_name}
                        selectedCellKeys={selectedCellKeys}
                        onSelectCell={handleSelectCell}
                        conflictKeys={conflictKeys}
                        paintSubject={activePaletteSubject}
                        onPaintSubject={handlePaintSubjectOnCell}
                      />
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 14,
                          marginTop: 4,
                        }}
                      >
                        <div
                          style={{
                            background: "var(--ds-surface)",
                            border: "1px solid var(--ds-border)",
                            borderRadius: "var(--ds-radius-lg)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              padding: "10px 14px",
                              borderBottom: "1px solid var(--ds-border)",
                              fontSize: 12,
                              fontWeight: 600,
                              color: "var(--ds-text)",
                            }}
                          >
                            教科別 時数
                          </div>
                          <div style={{ padding: "12px 14px" }}>
                            <SubjectHoursBars
                              grade={selectedClass.grade}
                              class_name={selectedClass.class_name}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {panel === "matrix" && (
                    <div
                      className="ds-stack ds-gap-12"
                      style={{ height: "100%", minHeight: 0 }}
                    >
                      <div
                        className="ds-flex ds-between ds-center"
                        style={{ gap: 12, flexWrap: "wrap" }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 16,
                              fontWeight: 700,
                              color: "var(--ds-text)",
                            }}
                          >
                            全校 時間割マトリクス
                          </div>
                          <div className="ds-small ds-muted">
                            {activePaletteSubject
                              ? `横: 曜日×時限 / 縦: クラス — 「${activePaletteSubject}」をクリック配置中、D&Dでも入替可能`
                              : "横: 曜日×時限 / 縦: クラス — クリックで選択、D&Dで入替"}
                          </div>
                        </div>
                        <div
                          className="ds-flex ds-center"
                          style={{
                            gap: 8,
                            flexWrap: "wrap",
                            marginLeft: "auto",
                          }}
                        >
                          <span className="ds-small ds-muted">表示倍率</span>
                          <button
                            type="button"
                            className="ds-btn ds-btn-sm"
                            onClick={() =>
                              setMatrixZoomPercent((current) =>
                                clampMatrixZoom(current - MATRIX_ZOOM_STEP),
                              )
                            }
                            disabled={matrixZoomPercent <= MIN_MATRIX_ZOOM}
                            title="全校時間割を縮小"
                          >
                            縮小
                          </button>
                          <div
                            style={{
                              minWidth: 58,
                              padding: "0 6px",
                              textAlign: "center",
                              fontFamily: "var(--ds-font-num)",
                              fontSize: 12,
                              fontWeight: 700,
                              color: "var(--ds-text)",
                            }}
                          >
                            {matrixZoomPercent}%
                          </div>
                          <button
                            type="button"
                            className="ds-btn ds-btn-sm"
                            onClick={() =>
                              setMatrixZoomPercent((current) =>
                                clampMatrixZoom(current + MATRIX_ZOOM_STEP),
                              )
                            }
                            disabled={matrixZoomPercent >= MAX_MATRIX_ZOOM}
                            title="全校時間割を拡大"
                          >
                            拡大
                          </button>
                          <button
                            type="button"
                            className="ds-btn ds-btn-sm"
                            onClick={() =>
                              setMatrixZoomPercent(DEFAULT_MATRIX_ZOOM)
                            }
                            disabled={matrixZoomPercent === DEFAULT_MATRIX_ZOOM}
                            title="表示倍率を100%に戻す"
                          >
                            100%に戻す
                          </button>
                        </div>
                      </div>
                      <MatrixView
                        selectedCellKeys={selectedCellKeys}
                        onSelectCell={handleSelectCell}
                        conflictKeys={conflictKeys}
                        filterGrade={filterGrade}
                        zoomPercent={matrixZoomPercent}
                        paintSubject={activePaletteSubject}
                        onPaintSubject={handlePaintSubjectOnCell}
                      />
                    </div>
                  )}

                  {panel === "teacher" && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "200px 1fr",
                        gap: 14,
                        height: "100%",
                      }}
                    >
                      <div
                        style={{
                          background: "var(--ds-surface)",
                          border: "1px solid var(--ds-border)",
                          borderRadius: "var(--ds-radius-lg)",
                          overflow: "hidden",
                          display: "flex",
                          flexDirection: "column",
                        }}
                      >
                        <div
                          style={{
                            padding: "10px 14px",
                            borderBottom: "1px solid var(--ds-border)",
                            fontSize: 12,
                            fontWeight: 600,
                            color: "var(--ds-text)",
                          }}
                        >
                          教員一覧
                        </div>
                        <div className="ds-scroll-y" style={{ padding: "8px" }}>
                          <TeacherList
                            selectedId={selectedTeacherId}
                            onSelect={setSelectedTeacherId}
                          />
                        </div>
                      </div>
                      <div className="ds-stack ds-gap-12">
                        {selectedTeacherId && (
                          <>
                            <div>
                              <div
                                style={{
                                  fontSize: 16,
                                  fontWeight: 700,
                                  color: "var(--ds-text)",
                                }}
                              >
                                {
                                  teachers.find(
                                    (t) => t.id === selectedTeacherId,
                                  )?.name
                                }{" "}
                                先生
                              </div>
                            </div>
                            <TeacherWeekView teacherId={selectedTeacherId} />
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {panel === "hours" && (
                    <div>
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 700,
                          color: "var(--ds-text)",
                          marginBottom: 12,
                        }}
                      >
                        授業時数 一覧
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fill, minmax(300px, 1fr))",
                          gap: 14,
                        }}
                      >
                        {structure.grades.map((g) =>
                          (g.classes ?? []).map((cn) => (
                            <div
                              key={`${g.grade}-${cn}`}
                              style={{
                                background: "var(--ds-surface)",
                                border: "1px solid var(--ds-border)",
                                borderRadius: "var(--ds-radius-lg)",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  padding: "10px 14px",
                                  borderBottom: "1px solid var(--ds-border)",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: "var(--ds-text)",
                                }}
                              >
                                {g.grade}年{cn}
                              </div>
                              <div style={{ padding: "12px 14px" }}>
                                <SubjectHoursBars
                                  grade={g.grade}
                                  class_name={cn}
                                />
                              </div>
                            </div>
                          )),
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <button
                aria-label="右サイドバーの幅を調整"
                className="la-inspector-resizer"
                onDoubleClick={() => setInspectorWidth(DEFAULT_INSPECTOR_WIDTH)}
                onKeyDown={handleInspectorResizeKeyDown}
                onLostPointerCapture={() => setIsInspectorResizing(false)}
                onPointerDown={handleInspectorResizePointerDown}
                onPointerMove={handleInspectorResizePointerMove}
                onPointerUp={handleInspectorResizePointerUp}
                tabIndex={0}
                title="左右ドラッグで右サイドバーの幅を変更 / ダブルクリックで初期幅に戻す"
                type="button"
              >
                <span
                  aria-hidden="true"
                  className="la-inspector-resizer-grip"
                />
              </button>

              {/* 右インスペクタペイン */}
              <div className="la-inspector-pane">
                <div className="ds-tabs">
                  <button
                    type="button"
                    className={`ds-tab${rightTab === "insp" ? " ds-active" : ""}`}
                    onClick={() => setRightTab("insp")}
                  >
                    詳細
                  </button>
                  <button
                    type="button"
                    className={`ds-tab${rightTab === "conf" ? " ds-active" : ""}`}
                    onClick={() => setRightTab("conf")}
                  >
                    競合
                    {totalCount > 0 && (
                      <span className="ds-tab-badges">
                        {hardCount > 0 && (
                          <span className="ds-violation-pill ds-hard">
                            {hardCount}
                          </span>
                        )}
                        {softCount > 0 && (
                          <span className="ds-violation-pill ds-soft">
                            {softCount}
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                </div>
                <div className="la-inspector-body">
                  {rightTab === "insp" && (
                    <Inspector
                      selection={selectedCell}
                      selectedCells={selectedCells}
                      onClear={handleClearSelection}
                      onClearSelectedCells={handleClearMultiSelection}
                    />
                  )}
                  {rightTab === "conf" && (
                    <ConflictList
                      items={violations}
                      onJump={handleJumpToConflict}
                    />
                  )}
                </div>
              </div>
            </div>

            <StatusBar />

            {isSettingsOpen && (
              <SettingsModal onClose={() => setIsSettingsOpen(false)} />
            )}
            {isConstraintsOpen && (
              <ConstraintsModal onClose={() => setIsConstraintsOpen(false)} />
            )}
            {isSolverOpen && (
              <SolverPanel onClose={() => setIsSolverOpen(false)} />
            )}
          </div>
        </>
      )}
    </FileActions>
  );
}

export default App;
