import { useRef } from "react";
import { createPortal } from "react-dom";
import type {
  DayOfWeek,
  Period,
  Teacher,
  TeacherGroup,
  TimetableEntry,
} from "@/types";
import { AltForm } from "./AltForm";
import styles from "./CellDropdown.module.css";
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

export const CellDropdown = ({
  day_of_week,
  period,
  grade,
  class_name,
  isSelected,
  selectedCount,
  onGroupCells,
}: CellDropdownProps) => {
  const cellRef = useRef<HTMLButtonElement>(null);
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

  // グループカラー
  const GROUP_COLORS = [
    "#3B82F6",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
    "#EC4899",
    "#06B6D4",
    "#84CC16",
  ];
  const groupColorIdx = cellGroupId ? logic.groupColorIdx : -1;
  const groupColor =
    groupColorIdx >= 0
      ? GROUP_COLORS[groupColorIdx % GROUP_COLORS.length]
      : null;

  const isDuplicateWarning = dailyCount > 1;
  const isTeacherMissing =
    currentEntry?.subject &&
    !currentEntry.teacher_id &&
    !currentEntry.teacher_group_id;

  const getTeacherDisplayName = (id: string | null) => {
    if (!id) return null;
    const t = teachers.find((t) => t.id === id);
    return t ? t.name.split(" ")[0] : null;
  };

  return (
    <>
      <button
        type="button"
        ref={cellRef}
        tabIndex={0}
        className={styles.cellButton}
        onContextMenu={logic.handleContextMenu}
      >
        <div
          className="cell-display"
          style={{
            border: isSelected
              ? "2px solid #3B82F6"
              : isDuplicateWarning
                ? "2px solid #EF4444"
                : "1px solid #E5E7EB",
            backgroundColor: groupColor || (isSelected ? "#EFF6FF" : "#fff"),
            color: groupColor ? "#fff" : "inherit",
          }}
        >
          <div className={styles.subjectRow}>
            <select
              value={currentEntry?.subject || ""}
              onChange={(e) => logic.handleSubjectChange(e.target.value)}
              className={styles.hiddenSelect}
              style={{ color: groupColor ? "#fff" : "inherit" }}
            >
              <option value="">(空き)</option>
              {gradeSubjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <span className={styles.subjectText}>
              {currentEntry?.subject || ""}
            </span>
          </div>

          <div className={styles.teacherRow}>
            {hasGroup && assignedGroup ? (
              <span className={styles.groupLabel}>
                [G] {assignedGroup.name}
              </span>
            ) : (
              <span className={styles.teacherName}>
                {getTeacherDisplayName(currentEntry?.teacher_id || null)}
              </span>
            )}
            {hasAlt && (
              <span className={styles.altBadge}>
                B:{currentEntry?.alt_subject}
              </span>
            )}
          </div>

          {isDuplicateWarning && (
            <div className={styles.warningIcon} title="1日重複警告">
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "12px" }}
              >
                warning
              </span>
            </div>
          )}
          {isTeacherMissing && (
            <div className={styles.missingIcon} title="教員未設定">
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "12px" }}
              >
                person_off
              </span>
            </div>
          )}
        </div>
      </button>

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
    <div className={styles.groupPortal} style={{ top: pos.y, left: pos.x }}>
      <div className={styles.portalHeader}>
        <span className={`${styles.portalTitle} ${styles.portalTitleGroup}`}>
          グループ担当設定
        </span>
        <button
          type="button"
          onClick={onClose}
          className={styles.portalCloseButton}
        >
          close
        </button>
      </div>
      <select
        value={currentEntry.teacher_group_id || ""}
        onChange={(e) => onGroupChange(e.target.value || null)}
        className={styles.selectInputGroup}
      >
        <option value="">個別担当に戻す（解除）</option>
        {teacherGroups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}（{g.teacher_ids.length}名）
          </option>
        ))}
      </select>
      {assignedGroup && (
        <div className={styles.portalTextGroup}>
          メンバー:{" "}
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
      <div className={styles.warningOverlay} onClick={onClose} />
      <div className={styles.warningDialog}>
        <div className={styles.warningTitle}>
          配置不可の先生が含まれています
        </div>
        <div className={styles.warningText}>
          グループ「{groupName}」の以下の先生は {day}曜日 {period}限
          が配置不可です：
        </div>
        <ul className={styles.warningList}>
          {conflicts.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onClose}
          className={styles.warningButton}
        >
          確認しました
        </button>
      </div>
    </>,
    document.body,
  );
};

export default CellDropdown;
