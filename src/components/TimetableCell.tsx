import type { MouseEvent } from "react";
import type { TimetableEntry } from "@/types";

interface TimetableCellProps {
  entry: TimetableEntry | undefined;
  selected: boolean;
  hasConflict: boolean;
  isFixed: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  isDragOver?: boolean;
  teacherName?: string;
  teacherGroupName?: string;
  altTeacherName?: string;
}

export function TimetableCell({
  entry,
  selected,
  hasConflict,
  isFixed,
  onClick,
  onDragStart,
  onDragOver,
  onDrop,
  isDragOver,
  teacherName,
  teacherGroupName,
  altTeacherName,
}: TimetableCellProps) {
  const isEmpty = !entry?.subject;
  const displayTeacher = teacherName ?? teacherGroupName;

  const cls = [
    "ds-tt-cell",
    isEmpty ? "ds-empty" : "",
    selected ? "ds-selected" : "",
    hasConflict && !selected ? "ds-conflict" : "",
    isFixed && !isEmpty ? "ds-fixed-cell" : "",
    isDragOver ? "ds-dragover" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      draggable={!isEmpty}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {!isEmpty && (
        <>
          <div
            className="ds-tt-subj"
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              fontSize: "11px",
              fontWeight: selected ? 700 : 600,
            }}
          >
            {entry?.subject}
          </div>
          {displayTeacher && (
            <div
              className="ds-tt-sub"
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                fontSize: "10px",
              }}
            >
              <span>{displayTeacher}</span>
            </div>
          )}
          {entry?.alt_subject && (
            <div
              className="ds-tt-sub"
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                fontSize: "10px",
                fontWeight: selected ? 700 : 600,
                color: "var(--ds-text)",
                fontStyle: "normal",
              }}
            >
              <span style={{ fontStyle: "italic", marginRight: 6 }}>B: {entry.alt_subject}</span>
              {altTeacherName && (
                <span style={{ fontSize: "10px", marginLeft: 4 }}>{altTeacherName}</span>
              )}
            </div>
          )}
          {hasConflict && <div className="ds-conflict-badge">!</div>}
          {isFixed && (
            <svg
              aria-hidden="true"
              className="ds-lock-badge"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          )}
        </>
      )}
    </button>
  );
}
