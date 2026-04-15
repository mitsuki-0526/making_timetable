import { createPortal } from "react-dom";
import type { Teacher, TimetableEntry } from "@/types";
import styles from "./CellDropdown.module.css";

interface TeacherPickerProps {
  currentEntry: TimetableEntry;
  teacherCandidates: Teacher[];
  pos: { x: number; y: number };
  onClose: () => void;
  onSelect: (teacherId: string | null) => void;
}

export const TeacherPicker = ({
  currentEntry,
  teacherCandidates,
  pos,
  onClose,
  onSelect,
}: TeacherPickerProps) => {
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      onMouseDown={(e) => e.stopPropagation()}
      className={styles.portalDialog}
      style={{ top: pos.y, left: pos.x }}
    >
      <div className={styles.portalHeader}>
        <span className={`${styles.portalTitle} ${styles.portalTitleDefault}`}>
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "14px", marginRight: "4px" }}
          >
            person
          </span>
          担当教員を選択
        </span>
        <button
          type="button"
          onClick={onClose}
          className={styles.portalCloseButton}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "16px" }}
          >
            close
          </span>
        </button>
      </div>
      <select
        value={currentEntry.teacher_id || ""}
        onChange={(e) => onSelect(e.target.value || null)}
        className={styles.selectInput}
      >
        <option value="">担当なし</option>
        {teacherCandidates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <div className={styles.portalText}>
        {currentEntry.subject} の担当教員（{teacherCandidates.length}名）
      </div>
    </div>,
    document.body,
  );
};
