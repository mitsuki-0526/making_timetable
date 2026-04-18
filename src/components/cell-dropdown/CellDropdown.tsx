import { AlertCircle } from "lucide-react";
import { createPortal } from "react-dom";
import type {
  DayOfWeek,
  Period,
  Teacher,
  TeacherGroup,
  TimetableEntry,
} from "@/types";
import { Select, SelectContent, SelectItem, SelectTrigger } from "../ui/select";
import { AltForm } from "./AltForm";
import { ContextMenu } from "./ContextMenu";
import { TeacherPicker } from "./TeacherPicker";
import { useCellDropdown } from "./useCellDropdown";

interface CellDropdownProps {
  day_of_week: DayOfWeek;
  period: Period;
  grade: number;
  class_name: string;
  isSelected: boolean;
  onCtrlClick?: () => void;
  selectedCount: number;
  onGroupCells?: () => void;
}

// cell_group_id に応じた控えめな塗り（トークン参照、ダークモード自動適用）
const GROUP_TOKEN_COUNT = 8;
const groupTint = (idx: number) => ({
  bg: `var(--group-${(idx % GROUP_TOKEN_COUNT) + 1}-bg)`,
  accent: `var(--group-${(idx % GROUP_TOKEN_COUNT) + 1}-accent)`,
});
const EMPTY_SUBJECT_VALUE = "__empty_subject__";

export const CellDropdown = ({
  day_of_week,
  period,
  grade,
  class_name,
  selectedCount,
  onGroupCells,
}: CellDropdownProps) => {
  const logic = useCellDropdown({
    day_of_week,
    period,
    grade,
    class_name,
    selectedCount,
    onGroupCells,
  });

  const {
    currentEntry,
    contextMenu,
    subForm,
    formPos,
    groupWarnings,
    teacherCandidates,
    gradeSubjects,
    dailyCount,
    cellGroupId,
    hasAlt,
    hasGroup,
    assignedGroup,
    teachers,
    teacher_groups,
  } = logic;

  const groupColorIdx = cellGroupId ? logic.groupColorIdx : -1;
  const tint = groupColorIdx >= 0 ? groupTint(groupColorIdx) : null;

  const isDuplicateWarning = dailyCount > 1;
  const isTeacherMissing =
    !!currentEntry?.subject &&
    !currentEntry.teacher_id &&
    !currentEntry.teacher_group_id;

  const getTeacherDisplayName = (id: string | null) => {
    if (!id) return null;
    const t = teachers.find((t) => t.id === id);
    return t ? t.name.split(" ")[0] : null;
  };

  const hasContent = !!currentEntry?.subject;
  const teacherLabel =
    hasGroup && assignedGroup
      ? assignedGroup.name
      : getTeacherDisplayName(currentEntry?.teacher_id || null);
  const subjectOptions = currentEntry?.subject
    ? Array.from(new Set([currentEntry.subject, ...gradeSubjects]))
    : gradeSubjects;

  return (
    <>
      <div
        className="relative flex h-full w-full cursor-pointer flex-col items-stretch justify-center gap-0.5 bg-transparent px-1 py-0.5 text-left text-[11px] leading-tight focus-within:outline-none focus-within:ring-1 focus-within:ring-ring"
        style={
          tint
            ? {
                backgroundColor: tint.bg,
                boxShadow: `inset 2px 0 0 ${tint.accent}`,
              }
            : undefined
        }
      >
        <Select
          value={currentEntry?.subject || EMPTY_SUBJECT_VALUE}
          onValueChange={(value) =>
            logic.handleSubjectChange(
              value === EMPTY_SUBJECT_VALUE ? null : value,
            )
          }
        >
          <SelectTrigger
            aria-label="教科を選択"
            onContextMenu={logic.handleContextMenu}
            className="absolute inset-0 z-10 h-full w-full cursor-pointer border-0 bg-transparent p-0 opacity-0 shadow-none outline-none focus-visible:ring-0 [&_svg]:hidden"
          >
            <span className="sr-only">
              {currentEntry?.subject || "教科を選択"}
            </span>
          </SelectTrigger>
          <SelectContent
            align="start"
            position="popper"
            sideOffset={4}
            className="z-[10010] max-h-80 border-border-strong bg-popover text-popover-foreground shadow-lg"
          >
            <SelectItem value={EMPTY_SUBJECT_VALUE}>未設定に戻す</SelectItem>
            {subjectOptions.map((subject) => (
              <SelectItem key={subject} value={subject}>
                {subject}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 教科名 */}
        {hasContent ? (
          <span
            className={`pointer-events-none relative block truncate font-semibold ${
              isDuplicateWarning ? "text-destructive" : "text-foreground"
            }`}
            title={
              isDuplicateWarning
                ? `${currentEntry?.subject}（同日に重複）`
                : currentEntry?.subject || undefined
            }
          >
            {currentEntry?.subject}
          </span>
        ) : (
          <span className="pointer-events-none block h-[14px]" aria-hidden />
        )}

        {/* 教員または「未設定」（未設定はドットに任せて控えめなテキスト） */}
        {hasContent && (
          <span
            className="pointer-events-none relative block truncate text-[10px] text-muted-foreground"
            title={teacherLabel || "教員未設定"}
          >
            {teacherLabel || "未設定"}
            {hasAlt && (
              <span
                className="pointer-events-none ml-1 rounded-sm border border-border px-1 align-middle text-[9px] font-medium text-foreground"
                title={`B週: ${currentEntry?.alt_subject}`}
              >
                B
              </span>
            )}
          </span>
        )}

        {/* 状態マーカー（セル右上。色＋記号の二重符号で色覚代替） */}
        {isDuplicateWarning && (
          <span
            className="pointer-events-none absolute right-0.5 top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-destructive text-[9px] font-bold leading-none text-destructive-foreground"
            role="img"
            aria-label="同日内で重複"
            title="同日内で重複しています"
          >
            !<span className="sr-only">同日に重複しています</span>
          </span>
        )}
        {!isDuplicateWarning && isTeacherMissing && (
          <span
            className="pointer-events-none absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-warning"
            role="img"
            aria-label="教員未設定"
            title="教員が未設定です"
          >
            <span className="sr-only">教員が未設定です</span>
          </span>
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          selectedCount={selectedCount}
          cellGroupId={cellGroupId}
          teacherCandidates={teacherCandidates}
          hasAlt={hasAlt}
          hasGroup={hasGroup}
          subForm={subForm}
          onClose={() => logic.setContextMenu(null)}
          onGroupCells={onGroupCells}
          onUngroupCells={logic.ungroupCells}
          onSetSubForm={logic.setSubForm}
          onClear={() =>
            logic.setTimetableEntry(
              day_of_week,
              period,
              grade,
              class_name,
              null,
              null,
            )
          }
        />
      )}

      {subForm === "teacher" && currentEntry?.subject && (
        <TeacherPicker
          currentEntry={currentEntry as TimetableEntry}
          teacherCandidates={teacherCandidates}
          pos={formPos}
          onClose={() => logic.setSubForm(null)}
          onSelect={(tid) =>
            logic.setTimetableTeacher(
              day_of_week,
              period,
              grade,
              class_name,
              tid,
            )
          }
        />
      )}

      {subForm === "alt" && currentEntry?.subject && (
        <AltForm
          currentEntry={currentEntry as TimetableEntry}
          gradeSubjects={gradeSubjects}
          teachers={teachers}
          day={day_of_week}
          period={period}
          isSpecial={class_name.includes("特支")}
          pos={formPos}
          onClose={() => logic.setSubForm(null)}
          onSubjectChange={logic.handleAltSubjectChange}
          onTeacherChange={(tid) =>
            logic.setAltEntry(
              day_of_week,
              period,
              grade,
              class_name,
              currentEntry.alt_subject || null,
              tid,
            )
          }
        />
      )}

      {subForm === "group" && currentEntry?.subject && (
        <GroupForm
          currentEntry={currentEntry as TimetableEntry}
          teacherGroups={teacher_groups}
          teachers={teachers}
          pos={formPos}
          onClose={() => logic.setSubForm(null)}
          onGroupChange={logic.handleGroupChange}
        />
      )}

      {groupWarnings && (
        <GroupWarning
          conflicts={groupWarnings.conflicts}
          groupName={groupWarnings.groupName}
          day={groupWarnings.day}
          period={groupWarnings.period}
          onClose={() => logic.setGroupWarnings(null)}
        />
      )}
    </>
  );
};

interface GroupFormProps {
  currentEntry: TimetableEntry;
  teacherGroups: TeacherGroup[];
  teachers: Teacher[];
  pos: { x: number; y: number };
  onClose: () => void;
  onGroupChange: (groupId: string | null) => void;
}

const GroupForm = ({
  currentEntry,
  teacherGroups,
  teachers,
  pos,
  onClose,
  onGroupChange,
}: GroupFormProps) => {
  const assignedGroup = teacherGroups.find(
    (g) => g.id === currentEntry.teacher_group_id,
  );
  return createPortal(
    <div
      className="fixed z-[9999] min-w-[220px] rounded-md border border-border-strong bg-popover p-3 shadow-md"
      style={{ top: pos.y, left: pos.x }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] font-semibold text-foreground">
          グループ担当
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          閉じる
        </button>
      </div>
      <select
        value={currentEntry.teacher_group_id || ""}
        onChange={(e) => onGroupChange(e.target.value || null)}
        className="w-full rounded-md border border-input bg-background px-2 py-1 text-[12px]"
      >
        <option value="">個別担当に戻す</option>
        {teacherGroups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}（{g.teacher_ids.length}名）
          </option>
        ))}
      </select>
      {assignedGroup && (
        <div className="mt-2 text-[11px] text-muted-foreground">
          {assignedGroup.teacher_ids
            .map((id) => teachers.find((t) => t.id === id)?.name || id)
            .join("・")}
        </div>
      )}
    </div>,
    document.body,
  );
};

interface GroupWarningProps {
  conflicts: string[];
  groupName: string;
  day: DayOfWeek;
  period: Period;
  onClose: () => void;
}

const GroupWarning = ({
  conflicts,
  groupName,
  day,
  period,
  onClose,
}: GroupWarningProps) => {
  return createPortal(
    <>
      <button
        type="button"
        aria-label="警告を閉じる"
        className="fixed inset-0 z-[9998] bg-black/30"
        onClick={onClose}
      />
      <div className="fixed left-1/2 top-1/2 z-[9999] w-[min(420px,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-md border border-border-strong bg-popover p-4 shadow-lg">
        <div className="mb-2 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-warning" aria-hidden />
          <span className="text-[13px] font-semibold text-foreground">
            配置不可の先生が含まれています
          </span>
        </div>
        <p className="mb-2 text-[12px] text-foreground">
          グループ「{groupName}」の次の先生は {day}曜日 {period}
          限に配置できません。
        </p>
        <ul className="mb-4 list-disc pl-5 text-[12px] text-destructive">
          {conflicts.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground hover:opacity-90"
        >
          確認しました
        </button>
      </div>
    </>,
    document.body,
  );
};

export default CellDropdown;
