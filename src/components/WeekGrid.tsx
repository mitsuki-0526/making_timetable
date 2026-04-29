import { useMemo, useState } from "react";
import { DAYS } from "@/constants";
import { getDisplayPeriods, isPeriodEnabled } from "@/lib/dayPeriods";
import { getEntryTeacherLabel } from "@/lib/teamTeaching";
import { useTimetableStore } from "@/store/useTimetableStore";
import type { CellPosition, DayOfWeek, Period } from "@/types";
import { TimetableCell } from "./TimetableCell";

interface SelectedCell {
  grade: number;
  class_name: string;
  day_of_week: DayOfWeek;
  period: Period;
}

interface SelectCellOptions {
  additive?: boolean;
}

interface WeekGridProps {
  grade: number;
  class_name: string;
  selectedCellKeys: Set<string>;
  onSelectCell: (cell: SelectedCell, options?: SelectCellOptions) => void;
  conflictKeys: Set<string>;
  paintSubject: string | null;
  onPaintSubject: (cell: SelectedCell) => void;
}

function makeCellKey(
  grade: number,
  class_name: string,
  day: DayOfWeek,
  period: Period,
) {
  return `${grade}|${class_name}|${day}|${period}`;
}

export function WeekGrid({
  grade,
  class_name,
  selectedCellKeys,
  onSelectCell,
  conflictKeys,
  paintSubject,
  onPaintSubject,
}: WeekGridProps) {
  const {
    getEntry,
    setTimetableEntry,
    setTimetableTeacher,
    setEntryTtAssignment,
    swapTimetableEntries,
    fixed_slots,
    settings,
    structure,
  } = useTimetableStore();
  const teachers = useTimetableStore((s) => s.teachers);

  const [dragOver, setDragOver] = useState<string | null>(null);
  const [_dragSrc, setDragSrc] = useState<CellPosition | null>(null);
  const displayPeriods = useMemo(() => getDisplayPeriods(settings), [settings]);

  const fixedKeys = useMemo(() => {
    const s = new Set<string>();
    for (const slot of fixed_slots ?? []) {
      for (const g of structure.grades) {
        const all = [...(g.classes ?? [])];
        for (const cn of all) {
          const match =
            slot.scope === "all" ||
            (slot.scope === "grade" && g.grade === slot.grade) ||
            (slot.scope === "class" &&
              g.grade === slot.grade &&
              cn === slot.class_name);
          if (match)
            s.add(makeCellKey(g.grade, cn, slot.day_of_week, slot.period));
        }
      }
    }
    return s;
  }, [fixed_slots, structure.grades]);

  return (
    <div className="ds-tt-grid">
      <div
        className="ds-tt-head"
        style={{ background: "var(--ds-surface-3)" }}
      />
      {DAYS.map((d) => (
        <div key={d} className="ds-tt-head">
          {d}
        </div>
      ))}
      {displayPeriods.map((p) => (
        <div key={p} style={{ display: "contents" }}>
          <div className="ds-tt-rowhead">{p}</div>
          {DAYS.map((d) => {
            const entry = getEntry(d, p, grade, class_name);
            const cellKey = makeCellKey(grade, class_name, d, p);
            const disabled = !isPeriodEnabled(settings, d, p);
            const isSelected = selectedCellKeys.has(cellKey);
            const isFixed = fixedKeys.has(cellKey);

            const teacherLabel = entry
              ? getEntryTeacherLabel(entry, teachers, "primary", true)
              : undefined;
            const altTeacherLabel = entry
              ? getEntryTeacherLabel(entry, teachers, "alt", true)
              : undefined;

            return (
              <TimetableCell
                key={cellKey}
                cellKey={cellKey}
                entry={entry}
                selected={isSelected}
                hasConflict={conflictKeys.has(cellKey)}
                isFixed={isFixed}
                disabled={disabled}
                isDragOver={dragOver === cellKey}
                teacherName={teacherLabel ?? undefined}
                altTeacherName={altTeacherLabel ?? undefined}
                onClick={(event) =>
                  (() => {
                    const cell = {
                      grade,
                      class_name,
                      day_of_week: d,
                      period: p,
                    };
                    const additive = event.ctrlKey || event.metaKey;
                    if (paintSubject && !additive) {
                      onPaintSubject(cell);
                    }
                    onSelectCell(cell, { additive });
                  })()
                }
                onDragStart={(e) => {
                  if (disabled) {
                    e.preventDefault();
                    return;
                  }
                  if (entry?.subject) {
                    const pos: CellPosition = {
                      grade,
                      class_name,
                      day_of_week: d,
                      period: p,
                    };
                    setDragSrc(pos);
                    e.dataTransfer.setData("text/plain", JSON.stringify(pos));
                    e.dataTransfer.effectAllowed = "all";
                  }
                }}
                onDragOver={(e) => {
                  if (disabled) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                  setDragOver(cellKey);
                }}
                onDrop={(e) => {
                  if (disabled) return;
                  e.preventDefault();
                  setDragOver(null);
                  try {
                    const data = JSON.parse(
                      e.dataTransfer.getData("text/plain"),
                    );
                    if (data.kind === "subject") {
                      setTimetableEntry(
                        d,
                        p,
                        grade,
                        class_name,
                        null,
                        data.subject,
                      );
                    } else if (data.kind === "teacher") {
                      setTimetableTeacher(
                        d,
                        p,
                        grade,
                        class_name,
                        data.teacher_id,
                      );
                    } else if (data.kind === "tt_assignment") {
                      setEntryTtAssignment(
                        d,
                        p,
                        grade,
                        class_name,
                        data.tt_assignment_id,
                      );
                    } else {
                      const src: CellPosition = data;
                      const dst: CellPosition = {
                        grade,
                        class_name,
                        day_of_week: d,
                        period: p,
                      };
                      if (
                        src.grade !== dst.grade ||
                        src.class_name !== dst.class_name ||
                        src.day_of_week !== dst.day_of_week ||
                        src.period !== dst.period
                      ) {
                        swapTimetableEntries(src, dst);
                      }
                    }
                  } catch {
                    /* ignore */
                  }
                  setDragSrc(null);
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
