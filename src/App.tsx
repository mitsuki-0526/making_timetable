import { useMemo, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { AppSidebar } from "./components/AppSidebar";
import { ConflictList } from "./components/ConflictList";
import ConstraintsModal from "./components/ConstraintsModal";
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

function App() {
  const { structure, clearNonFixed } = useTimetableStore();
  const teachers = useTimetableStore((s) => s.teachers);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isConstraintsOpen, setIsConstraintsOpen] = useState(false);
  const [isSolverOpen, setIsSolverOpen] = useState(false);

  const [panel, setPanel] = useState<PanelType>("class");
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

  const { violations, conflictKeys, totalCount } = useViolations();

  const selectedCells = useMemo(
    () => Array.from(selectedCellKeys).map(parseSelectedCellKey),
    [selectedCellKeys],
  );

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

  return (
    <>
      <Toaster />
      <div className="layout-a">
        <Topbar />

        <div className="la-main">
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
          />

          {/* 中央ペイン */}
          <div className="la-center-pane">
            <div style={{ padding: "12px 16px 0 16px", flexShrink: 0 }}>
              <WarnBanner
                violationCount={totalCount}
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
                        クリックでセル選択・右パネルで編集 / D&Dで入替
                      </div>
                    </div>
                  </div>
                  <WeekGrid
                    grade={selectedClass.grade}
                    class_name={selectedClass.class_name}
                    selectedCellKeys={selectedCellKeys}
                    onSelectCell={handleSelectCell}
                    conflictKeys={conflictKeys}
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
                      横: 曜日×時限 / 縦: クラス — クリックで選択、D&Dで入替
                    </div>
                  </div>
                  <MatrixView
                    selectedCellKeys={selectedCellKeys}
                    onSelectCell={handleSelectCell}
                    conflictKeys={conflictKeys}
                    filterGrade={filterGrade}
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
                              teachers.find((t) => t.id === selectedTeacherId)
                                ?.name
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
                            <SubjectHoursBars grade={g.grade} class_name={cn} />
                          </div>
                        </div>
                      )),
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

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
                  <span
                    style={{
                      marginLeft: 4,
                      background: "var(--ds-warn-border)",
                      color: "#fff",
                      borderRadius: 999,
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "1px 5px",
                      lineHeight: 1.4,
                    }}
                  >
                    {totalCount}
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
        {isSolverOpen && <SolverPanel onClose={() => setIsSolverOpen(false)} />}
      </div>
    </>
  );
}

export default App;
