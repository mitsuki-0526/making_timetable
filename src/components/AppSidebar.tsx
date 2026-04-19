import { useTimetableStore } from "@/store/useTimetableStore";
import FileActions from "./FileActions";
import PdfExport from "./PdfExport";

type PanelType = "class" | "matrix" | "teacher" | "hours";

interface ClassOption {
  grade: number;
  class_name: string;
  label: string;
}

interface AppSidebarProps {
  panel: PanelType;
  onPanelChange: (p: PanelType) => void;
  selectedClass: ClassOption | null;
  onClassChange: (c: ClassOption) => void;
  selectedTeacherId: string;
  onTeacherChange: (id: string) => void;
  filterGrade: number | null;
  onFilterGradeChange: (g: number | null) => void;
  onOpenSettings: () => void;
  onOpenConstraints: () => void;
  onOpenSolver: () => void;
  onClearNonFixed: () => void;
}

function GridIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: 14, height: 14, flexShrink: 0 }}
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: 14, height: 14, flexShrink: 0 }}
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function BarIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: 14, height: 14, flexShrink: 0 }}
    >
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: 14, height: 14, flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68h.09A1.65 1.65 0 0 0 9 4.6V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
function SparklesIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: 14, height: 14, flexShrink: 0 }}
    >
      <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
    </svg>
  );
}
function SaveIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: 14, height: 14, flexShrink: 0 }}
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: 14, height: 14, flexShrink: 0 }}
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

export function AppSidebar({
  panel,
  onPanelChange,
  selectedClass,
  onClassChange,
  selectedTeacherId,
  onTeacherChange,
  filterGrade,
  onFilterGradeChange,
  onOpenSettings,
  onOpenConstraints,
  onOpenSolver,
  onClearNonFixed,
}: AppSidebarProps) {
  const { structure } = useTimetableStore();
  const teachers = useTimetableStore((s) => s.teachers);

  const classOptions: ClassOption[] = [];
  for (const g of structure.grades) {
    if (filterGrade !== null && g.grade !== filterGrade) continue;
    for (const cn of g.classes ?? []) {
      classOptions.push({
        grade: g.grade,
        class_name: cn,
        label: `${g.grade}年${cn}`,
      });
    }
  }

  const gradeOptions = structure.grades.map((g) => g.grade);

  const selectedClassKey = selectedClass
    ? `${selectedClass.grade}|${selectedClass.class_name}`
    : "";

  return (
    <div className="la-sidebar">
      {/* メニュー */}
      <div className="la-side-sec">
        <div className="la-side-title">メニュー</div>
        <div className="la-side-nav ds-stack" style={{ gap: 2 }}>
          <button
            type="button"
            className={panel === "class" ? "la-active" : ""}
            onClick={() => onPanelChange("class")}
          >
            <GridIcon /> クラス別時間割
          </button>
          <button
            type="button"
            className={panel === "matrix" ? "la-active" : ""}
            onClick={() => onPanelChange("matrix")}
          >
            <GridIcon /> 全校時間割
          </button>
          <button
            type="button"
            className={panel === "teacher" ? "la-active" : ""}
            onClick={() => onPanelChange("teacher")}
          >
            <UserIcon /> 教員別時間割
          </button>
          <button
            type="button"
            className={panel === "hours" ? "la-active" : ""}
            onClick={() => onPanelChange("hours")}
          >
            <BarIcon /> 授業時数
          </button>
        </div>
      </div>

      {/* フィルタ */}
      <div className="la-side-sec">
        <div className="la-side-title">フィルタ</div>
        <div className="ds-stack ds-gap-8">
          <div className="ds-field" style={{ width: "100%" }}>
            <span className="ds-label">学年</span>
            <select
              value={filterGrade ?? ""}
              onChange={(e) =>
                onFilterGradeChange(
                  e.target.value ? Number(e.target.value) : null,
                )
              }
            >
              <option value="">全て</option>
              {gradeOptions.map((g) => (
                <option key={g} value={g}>
                  {g}年
                </option>
              ))}
            </select>
          </div>
          {panel === "class" && (
            <div className="ds-field" style={{ width: "100%" }}>
              <span className="ds-label">クラス</span>
              <select
                value={selectedClassKey}
                onChange={(e) => {
                  const opt = classOptions.find(
                    (c) => `${c.grade}|${c.class_name}` === e.target.value,
                  );
                  if (opt) onClassChange(opt);
                }}
              >
                {classOptions.map((c) => (
                  <option
                    key={`${c.grade}|${c.class_name}`}
                    value={`${c.grade}|${c.class_name}`}
                  >
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {panel === "teacher" && (
            <div className="ds-field" style={{ width: "100%" }}>
              <span className="ds-label">教員</span>
              <select
                value={selectedTeacherId}
                onChange={(e) => onTeacherChange(e.target.value)}
              >
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 教科パレット */}
      <div
        className="la-side-sec"
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div className="la-side-title">教科パレット</div>
        <SubjectPalette structure={structure} />
      </div>

      {/* 操作 */}
      <div className="la-side-sec">
        <div className="la-side-title">操作</div>
        <div className="ds-stack ds-gap-8">
          <button
            type="button"
            className="ds-btn ds-btn-sm ds-btn-primary"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={onOpenSolver}
          >
            <SparklesIcon /> 自動生成
          </button>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}
          >
            <button
              type="button"
              className="ds-btn ds-btn-sm"
              style={{ justifyContent: "center" }}
              onClick={onOpenSettings}
            >
              <SettingsIcon /> マスタ
            </button>
            <button
              type="button"
              className="ds-btn ds-btn-sm"
              style={{ justifyContent: "center" }}
              onClick={onOpenConstraints}
            >
              <SettingsIcon /> 制約
            </button>
          </div>
          <FileActions>
            {({ handleSaveAs, handleLoad, handleExcelExport }) => (
              <div className="ds-stack ds-gap-4">
                <button
                  type="button"
                  className="ds-btn ds-btn-sm"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={handleSaveAs}
                >
                  <SaveIcon /> 名前を付けて保存
                </button>
                <button
                  type="button"
                  className="ds-btn ds-btn-sm"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={handleLoad}
                >
                  開く
                </button>
                <button
                  type="button"
                  className="ds-btn ds-btn-sm"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={handleExcelExport}
                >
                  Excel書き出し
                </button>
              </div>
            )}
          </FileActions>
          <PdfExport>
            {({ open }) => (
              <button
                type="button"
                className="ds-btn ds-btn-sm"
                style={{ width: "100%", justifyContent: "center" }}
                onClick={open}
              >
                PDF書き出し
              </button>
            )}
          </PdfExport>
          <button
            type="button"
            className="ds-btn ds-btn-sm ds-btn-destructive"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={onClearNonFixed}
          >
            <TrashIcon /> 配置をリセット
          </button>
        </div>
      </div>
    </div>
  );
}

function SubjectPalette({
  structure,
}: {
  structure: {
    required_hours: Record<string, Record<string, number>>;
    grades: { grade: number }[];
  };
}) {
  const subjects = new Set<string>();
  for (const g of structure.grades) {
    const reqKey = `${g.grade}_通常`;
    const req = structure.required_hours[reqKey] ?? {};
    for (const s of Object.keys(req)) {
      if (req[s] > 0) subjects.add(s);
    }
  }
  const subjList = Array.from(subjects).sort();

  return (
    <div className="ds-scroll-y ds-stack ds-gap-4" style={{ flex: 1 }}>
      {subjList.map((s) => (
        <button
          key={s}
          type="button"
          tabIndex={0}
          className="ds-palette-item"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(
              "text/plain",
              JSON.stringify({ kind: "subject", subject: s }),
            );
            e.dataTransfer.effectAllowed = "copy";
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter")
              e.currentTarget.dispatchEvent(new MouseEvent("dragstart"));
          }}
        >
          <span className="ds-code">{s}</span>
        </button>
      ))}
    </div>
  );
}
