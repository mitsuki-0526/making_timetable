import { useMemo } from "react";
import { useTimetableStore } from "@/store/useTimetableStore";
import type { DayOfWeek, Period } from "@/types";

interface CellDropdownProps {
  day_of_week: DayOfWeek;
  period: Period;
  grade: number;
  class_name: string;
  isSelected: boolean;
  onCtrlClick?: () => void;
  selectedCount: number;
  onGroupCells?: () => void;
  onClickCell?: () => void;
}

const EMPTY_VALUE = "__empty__";

export const CellDropdown = ({
  day_of_week,
  period,
  grade,
  class_name,
  isSelected,
  onCtrlClick,
  selectedCount,
  onGroupCells,
  onClickCell,
}: CellDropdownProps) => {
  const { getEntry, setTimetableEntry, structure } = useTimetableStore();
  const teachers = useTimetableStore((state) => state.teachers);
  const teacherGroups = useTimetableStore((state) => state.teacher_groups);

  const entry = getEntry(day_of_week, period, grade, class_name);
  const requiredHoursKey = `${grade}_通常`;
  const subjectOptions = useMemo(() => {
    const subjects = new Set(
      Object.keys(structure.required_hours[requiredHoursKey] ?? {}),
    );
    if (entry?.subject) {
      subjects.add(entry.subject);
    }
    return Array.from(subjects).sort();
  }, [entry?.subject, requiredHoursKey, structure.required_hours]);

  const teacherLabel = entry?.teacher_group_id
    ? teacherGroups.find((group) => group.id === entry.teacher_group_id)?.name
    : teachers.find((teacher) => teacher.id === entry?.teacher_id)?.name;

  const handleSubjectChange = (value: string) => {
    setTimetableEntry(
      day_of_week,
      period,
      grade,
      class_name,
      entry?.teacher_id ?? null,
      value === EMPTY_VALUE ? null : value,
    );
  };

  return (
    <div className="relative h-full w-full">
      <select
        aria-label="教科を選択"
        value={entry?.subject ?? EMPTY_VALUE}
        onChange={(event) => handleSubjectChange(event.target.value)}
        onMouseDown={(event) => {
          if (event.ctrlKey || event.metaKey) {
            // ctrl/meta click is handled in onClick to toggle selection/grouping
            return;
          }
          onClickCell?.();
        }}
        onClick={(event) => {
          if (!(event.ctrlKey || event.metaKey)) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          onCtrlClick?.();
        }}
        onContextMenu={(event) => {
          if (selectedCount < 2 || !onGroupCells) {
            return;
          }
          event.preventDefault();
          onGroupCells();
        }}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
      >
        <option value={EMPTY_VALUE}>未設定に戻す</option>
        {subjectOptions.map((subject) => (
          <option key={subject} value={subject}>
            {subject}
          </option>
        ))}
      </select>

      {entry?.subject ? (
        <div
          className="pointer-events-none flex h-full w-full flex-col justify-center px-1 py-0.5 text-left"
          style={{ opacity: 1 }}
        >
          <div
            className="truncate text-[11px] leading-tight"
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              fontSize: "11px",
              fontWeight: isSelected ? 700 : 600,
              color: "var(--ds-text)",
            }}
          >
            {entry?.subject}
          </div>
          {entry?.alt_subject && (
            <div
              className="truncate text-[10px] leading-tight"
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                fontSize: "10px",
                color: "var(--ds-text-2)",
                fontStyle: "italic",
              }}
            >
              {`B: ${entry.alt_subject}`}
            </div>
          )}
          <div
            className="truncate text-[10px] leading-tight"
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              fontSize: "10px",
              color: "var(--ds-text-2)",
            }}
          >
            {teacherLabel || "担当未設定"}
          </div>
        </div>
      ) : (
        <div className="pointer-events-none flex h-full w-full items-center justify-center text-center px-1">
            <div
              className="text-[11px] leading-tight"
              style={{ color: "var(--ds-text-2)", whiteSpace: "nowrap" }}
            >
              クリックで設定
            </div>
        </div>
      )}
    </div>
  );
};

export default CellDropdown;
