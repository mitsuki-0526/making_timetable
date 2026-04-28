import { useState } from "react";
import { touchDragEnd, touchDragMove, touchDragStart } from "@/lib/touchDrag";
import {
  getTtAssignmentGrades,
  getTtAssignmentSubjects,
  getTtAssignmentTargetClassMap,
} from "@/lib/ttAssignments";
import { useTimetableStore } from "@/store/useTimetableStore";
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
  onOverwriteSave: () => void;
  onSaveAs: () => void;
  onLoad: () => void;
  onExcelExport: () => void;
  hasFileHandle: boolean;
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
  onOverwriteSave,
  onSaveAs,
  onLoad,
  onExcelExport,
  hasFileHandle,
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
            className={panel === "matrix" ? "la-active" : ""}
            onClick={() => onPanelChange("matrix")}
          >
            <GridIcon /> 全校時間割
          </button>
          <button
            type="button"
            className={panel === "class" ? "la-active" : ""}
            onClick={() => onPanelChange("class")}
          >
            <GridIcon /> クラス別時間割
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
        <div className="la-side-title">パレット</div>
        <Palette structure={structure} />
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
              <SettingsIcon /> 基礎構成
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
          <div className="ds-stack ds-gap-4">
            <button
              type="button"
              className="ds-btn ds-btn-sm"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={onOverwriteSave}
              title={
                hasFileHandle
                  ? "現在のファイルに上書き保存 (Ctrl+S)"
                  : "名前を付けて保存 (Ctrl+S)"
              }
            >
              <SaveIcon /> 上書き保存
            </button>
            <button
              type="button"
              className="ds-btn ds-btn-sm"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={onSaveAs}
            >
              名前を付けて保存
            </button>
            <button
              type="button"
              className="ds-btn ds-btn-sm"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={onLoad}
            >
              開く
            </button>
            <button
              type="button"
              className="ds-btn ds-btn-sm"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={onExcelExport}
            >
              Excel書き出し
            </button>
          </div>
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

function Palette({
  structure,
}: {
  structure: {
    required_hours: Record<string, Record<string, number>>;
    grades: { grade: number }[];
  };
}) {
  const [tab, setTab] = useState<"subject" | "teacher" | "tt">("subject");
  const [filter, setFilter] = useState("");
  const teachers = useTimetableStore((s) => s.teachers);
  const tt_assignments = useTimetableStore((s) => s.tt_assignments);

  // 教科一覧（重複排除・ソート）
  const subjects = new Set<string>();
  for (const g of structure.grades) {
    const reqKey = `${g.grade}_通常`;
    const req = structure.required_hours[reqKey] ?? {};
    for (const s of Object.keys(req)) {
      if (req[s] > 0) subjects.add(s);
    }
  }
  const subjList = Array.from(subjects)
    .sort()
    .filter((s) => s.includes(filter));

  // 先生一覧（フィルター適用）
  const teacherList = teachers.filter(
    (t) =>
      t.name.includes(filter) || t.subjects.some((s) => s.includes(filter)),
  );

  const enabledTtAssignments = tt_assignments.filter(
    (assignment) => assignment.enabled,
  );

  // TT設定一覧（フィルター適用）
  const ttList = enabledTtAssignments.filter((assignment) => {
    if (assignment.name.includes(filter)) return true;
    if (
      getTtAssignmentSubjects(assignment).some((subject) =>
        subject.includes(filter),
      )
    ) {
      return true;
    }
    if (
      getTtAssignmentGrades(assignment).some(
        (grade) => `${grade}`.includes(filter) || `${grade}年`.includes(filter),
      )
    ) {
      return true;
    }
    if (getTtClassSummary(assignment.id).includes(filter)) return true;
    return assignment.teacher_ids.some((tid) => {
      const t = teachers.find((t) => t.id === tid);
      return t?.name.includes(filter);
    });
  });

  const getTeacherNames = (teacher_ids: string[]) =>
    teacher_ids
      .map((tid) =>
        teachers
          .find((t) => t.id === tid)
          ?.name.split("(")[0]
          .trim(),
      )
      .filter(Boolean)
      .join("・");

  const getTtClassSummary = (assignmentId: string) => {
    const assignment = enabledTtAssignments.find(
      (item) => item.id === assignmentId,
    );
    if (!assignment) return "";
    return Object.entries(getTtAssignmentTargetClassMap(assignment))
      .sort(([left], [right]) => Number(left) - Number(right))
      .map(([grade, classNames]) => `${grade}年:${classNames.join("・")}`)
      .join(" / ");
  };

  const getTtSummary = (teacherIds: string[], assignmentId: string) => {
    const assignment = enabledTtAssignments.find(
      (item) => item.id === assignmentId,
    );
    if (!assignment) return "";
    const grades = getTtAssignmentGrades(assignment)
      .map((grade) => `${grade}年`)
      .join("・");
    const subjects = getTtAssignmentSubjects(assignment).join("・");
    const classes = getTtClassSummary(assignmentId);
    const teachersLabel = getTeacherNames(teacherIds);
    return [grades, subjects, classes, teachersLabel]
      .filter(Boolean)
      .join(" / ");
  };

  const handleTabChange = (next: "subject" | "teacher" | "tt") => {
    setTab(next);
    setFilter("");
  };

  const placeholderMap = {
    subject: "教科を絞り込み…",
    teacher: "先生名・教科で絞り込み…",
    tt: "TT名・教科・先生名で絞り込み…",
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      {/* タブ */}
      <div
        className="ds-tabs"
        style={{ marginBottom: 6, justifyContent: "center", gap: 4 }}
      >
        <button
          type="button"
          className={`ds-tab${tab === "subject" ? " ds-active" : ""}`}
          onClick={() => handleTabChange("subject")}
          style={{ flex: 1, justifyContent: "center", minWidth: 0 }}
        >
          教科
        </button>
        <button
          type="button"
          className={`ds-tab${tab === "teacher" ? " ds-active" : ""}`}
          onClick={() => handleTabChange("teacher")}
          style={{ flex: 1, justifyContent: "center", minWidth: 0 }}
        >
          先生
        </button>
        <button
          type="button"
          className={`ds-tab${tab === "tt" ? " ds-active" : ""}`}
          onClick={() => handleTabChange("tt")}
          style={{ flex: 1, justifyContent: "center", minWidth: 0 }}
        >
          TT
        </button>
      </div>

      {/* フィルター */}
      <input
        type="text"
        placeholder={placeholderMap[tab]}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{
          width: "100%",
          padding: "4px 8px",
          marginBottom: 6,
          fontSize: 12,
          border: "1px solid var(--ds-border)",
          borderRadius: "var(--ds-radius)",
          background: "var(--ds-bg)",
          color: "var(--ds-text)",
          outline: "none",
          boxSizing: "border-box",
        }}
      />

      {/* アイテム一覧 */}
      <div className="ds-scroll-y ds-stack ds-gap-4" style={{ flex: 1 }}>
        {/* 教科タブ */}
        {tab === "subject" &&
          subjList.map((s) => (
            <button
              key={s}
              type="button"
              tabIndex={0}
              className="ds-palette-item"
              style={{ touchAction: "none" }}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  "text/plain",
                  JSON.stringify({ kind: "subject", subject: s }),
                );
                e.dataTransfer.effectAllowed = "copy";
              }}
              onTouchStart={(e) => {
                const t = e.touches[0];
                touchDragStart(
                  { kind: "subject", subject: s },
                  s,
                  t.clientX,
                  t.clientY,
                );
              }}
              onTouchMove={(e) => {
                e.preventDefault();
                const t = e.touches[0];
                touchDragMove(t.clientX, t.clientY);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                const t = e.changedTouches[0];
                touchDragEnd(t.clientX, t.clientY);
              }}
            >
              <span className="ds-code">{s}</span>
            </button>
          ))}
        {tab === "subject" && subjList.length === 0 && (
          <div
            style={{
              fontSize: 12,
              color: "var(--ds-muted)",
              padding: "4px 2px",
            }}
          >
            一致する教科がありません
          </div>
        )}

        {/* 先生タブ */}
        {tab === "teacher" &&
          teacherList.map((t) => (
            <button
              key={t.id}
              type="button"
              tabIndex={0}
              className="ds-palette-item"
              style={{ touchAction: "none" }}
              draggable
              title={`担当: ${t.subjects.join("・")}`}
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  "text/plain",
                  JSON.stringify({ kind: "teacher", teacher_id: t.id }),
                );
                e.dataTransfer.effectAllowed = "copy";
              }}
              onTouchStart={(e) => {
                const touch = e.touches[0];
                touchDragStart(
                  { kind: "teacher", teacher_id: t.id },
                  t.name.split("(")[0].trim(),
                  touch.clientX,
                  touch.clientY,
                );
              }}
              onTouchMove={(e) => {
                e.preventDefault();
                const touch = e.touches[0];
                touchDragMove(touch.clientX, touch.clientY);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                const touch = e.changedTouches[0];
                touchDragEnd(touch.clientX, touch.clientY);
              }}
            >
              <span style={{ fontWeight: 500 }}>
                {t.name.split("(")[0].trim()}
              </span>
              {t.subjects.length > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--ds-muted)",
                    marginLeft: 4,
                  }}
                >
                  {t.subjects.join("・")}
                </span>
              )}
            </button>
          ))}
        {tab === "teacher" && teacherList.length === 0 && (
          <div
            style={{
              fontSize: 12,
              color: "var(--ds-muted)",
              padding: "4px 2px",
            }}
          >
            一致する先生がいません
          </div>
        )}

        {/* TTタブ */}
        {tab === "tt" &&
          ttList.map((assignment) => (
            <button
              key={assignment.id}
              type="button"
              tabIndex={0}
              className="ds-palette-item"
              style={{ touchAction: "none" }}
              draggable
              title={getTtSummary(assignment.teacher_ids, assignment.id)}
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  "text/plain",
                  JSON.stringify({
                    kind: "tt_assignment",
                    tt_assignment_id: assignment.id,
                  }),
                );
                e.dataTransfer.effectAllowed = "copy";
              }}
              onTouchStart={(e) => {
                const touch = e.touches[0];
                touchDragStart(
                  { kind: "tt_assignment", tt_assignment_id: assignment.id },
                  assignment.name,
                  touch.clientX,
                  touch.clientY,
                );
              }}
              onTouchMove={(e) => {
                e.preventDefault();
                const touch = e.touches[0];
                touchDragMove(touch.clientX, touch.clientY);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                const touch = e.changedTouches[0];
                touchDragEnd(touch.clientX, touch.clientY);
              }}
            >
              <span style={{ fontWeight: 500 }}>{assignment.name}</span>
              <span
                style={{
                  fontSize: 10,
                  color: "var(--ds-muted)",
                  marginLeft: 4,
                }}
              >
                {getTtSummary(assignment.teacher_ids, assignment.id) ||
                  `${assignment.teacher_ids.length}名`}
              </span>
            </button>
          ))}
        {tab === "tt" && ttList.length === 0 && (
          <div
            style={{
              fontSize: 12,
              color: "var(--ds-muted)",
              padding: "4px 2px",
            }}
          >
            {enabledTtAssignments.length === 0
              ? "TT設定が未登録です"
              : "一致するTT設定がありません"}
          </div>
        )}
      </div>
    </div>
  );
}
