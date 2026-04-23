import { useMemo, useState } from "react";
import { DAYS, PERIODS } from "@/constants";
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
}: WeekGridProps) {
  const { getEntry, setTimetableEntry, setTimetableTeacher, setEntryGroup, swapTimetableEntries, fixed_slots, structure } =
    useTimetableStore();
  const teachers = useTimetableStore((s) => s.teachers);
  const teacher_groups = useTimetableStore((s) => s.teacher_groups);

  const [dragOver, setDragOver] = useState<string | null>(null);
  const [_dragSrc, setDragSrc] = useState<CellPosition | null>(null);

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
      {PERIODS.map((p) => (
        <div key={p} style={{ display: "contents" }}>
          <div className="ds-tt-rowhead">{p}</div>
          {DAYS.map((d) => {
            const entry = getEntry(d, p, grade, class_name);
            const cellKey = makeCellKey(grade, class_name, d, p);
            const isSelected = selectedCellKeys.has(cellKey);
            const isFixed = fixedKeys.has(cellKey);

            const teacher = entry?.teacher_id
              ? teachers.find((t) => t.id === entry.teacher_id)
              : undefined;
            const tGroup = entry?.teacher_group_id
              ? teacher_groups.find((g) => g.id === entry.teacher_group_id)
              : undefined;
            const altTeacher = entry?.alt_teacher_id
              ? teachers.find((t) => t.id === entry.alt_teacher_id)
              : undefined;

            return (
              <TimetableCell
                key={cellKey}
                entry={entry}
                selected={isSelected}
                hasConflict={conflictKeys.has(cellKey)}
                isFixed={isFixed}
                isDragOver={dragOver === cellKey}
                teacherName={teacher?.name}
                teacherGroupName={tGroup?.name}
                altTeacherName={altTeacher?.name}
                onClick={(event) =>
                  onSelectCell(
                    { grade, class_name, day_of_week: d, period: p },
                    { additive: event.ctrlKey || event.metaKey },
                  )
                }
                onDragStart={(e) => {
                  if (entry?.subject) {
                    const pos: CellPosition = {
                      grade,
                      class_name,
                      day_of_week: d,
                      period: p,
                    };
                    setDragSrc(pos);
                    e.dataTransfer.setData("text/plain", JSON.stringify(pos));
                    e.dataTransfer.effectAllowed = "move";
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(cellKey);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(null);
                  try {
                    const data = JSON.parse(
                      e.dataTransfer.getData("text/plain"),
                    );
                    if (data.kind === "subject") {
                      setTimetableEntry(d, p, grade, class_name, null, data.subject);
                    } else if (data.kind === "teacher") {
                      setTimetableTeacher(d, p, grade, class_name, data.teacher_id);
                    } else if (data.kind === "teacher_group") {
                      setEntryGroup(d, p, grade, class_name, data.teacher_group_id);
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
