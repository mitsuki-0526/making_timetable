import { createPortal } from "react-dom";
import type { DayOfWeek, Period, Teacher, TimetableEntry } from "@/types";
import styles from "./CellDropdown.module.css";

interface AltFormProps {
  currentEntry: TimetableEntry;
  gradeSubjects: string[];
  teachers: Teacher[];
  day: DayOfWeek;
  period: Period;
  isSpecial: boolean;
  pos: { x: number; y: number };
  onClose: () => void;
  onSubjectChange: (subj: string | null) => void;
  onTeacherChange: (teacherId: string | null) => void;
}

export const AltForm = ({
  currentEntry,
  gradeSubjects,
  teachers,
  day,
  period,
  pos,
  onClose,
  onSubjectChange,
  onTeacherChange,
}: AltFormProps) => {
  const altTeacherCandidates = teachers.filter((t) => {
    if (
      t.unavailable_times.some(
        (u) => u.day_of_week === day && u.period === period,
      )
    )
      return false;
    if (t.id === currentEntry?.teacher_id) return false;
    return true;
  });

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      onMouseDown={(e) => e.stopPropagation()}
      className={styles.altPortal}
      style={{ top: pos.y, left: pos.x }}
    >
      <div className={styles.portalHeader}>
        <span className={`${styles.portalTitle} ${styles.portalTitleAlt}`}>
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "14px", marginRight: "4px" }}
          >
            calendar_today
          </span>
          B週の設定
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
        value={currentEntry.alt_subject || ""}
        onChange={(e) => onSubjectChange(e.target.value || null)}
        className={styles.selectInputAlt}
      >
        <option value="">B週なし（隔週解除）</option>
        {gradeSubjects
          .filter((s) => s !== currentEntry.subject)
          .map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
      </select>
      {currentEntry.alt_subject && (
        <select
          value={currentEntry.alt_teacher_id || ""}
          onChange={(e) => onTeacherChange(e.target.value || null)}
          className={styles.selectInputAlt}
        >
          <option value="">教員未定</option>
          {altTeacherCandidates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}
    </div>,
    document.body,
  );
};
