import { useMemo, useState } from "react";
import { DAYS, PERIODS } from "@/constants";
import { useTimetableStore } from "@/store/useTimetableStore";
import type { CellPosition, DayOfWeek, Period } from "@/types";

interface SelectedCell {
  grade: number;
  class_name: string;
  day_of_week: DayOfWeek;
  period: Period;
}

interface MatrixViewProps {
  selectedCell: SelectedCell | null;
  onSelectCell: (cell: SelectedCell) => void;
  conflictKeys: Set<string>;
  filterGrade: number | null;
}

export function MatrixView({
  selectedCell,
  onSelectCell,
  conflictKeys,
  filterGrade,
}: MatrixViewProps) {
  const { getEntry, swapTimetableEntries, structure } = useTimetableStore();
  const teachers = useTimetableStore((s) => s.teachers);

  const [dragOver, setDragOver] = useState<string | null>(null);

  const rows = useMemo(() => {
    const list: { grade: number; class_name: string; label: string }[] = [];
    for (const g of structure.grades) {
      if (filterGrade !== null && g.grade !== filterGrade) continue;
      for (const cn of g.classes ?? []) {
        list.push({
          grade: g.grade,
          class_name: cn,
          label: `${g.grade}-${cn}`,
        });
      }
      for (const cn of g.special_classes ?? []) {
        list.push({
          grade: g.grade,
          class_name: cn,
          label: `${g.grade}年 ${cn}`,
        });
      }
    }
    return list;
  }, [structure.grades, filterGrade]);

  return (
    <div className="ds-matrix-wrap" style={{ flex: 1, minHeight: 0 }}>
      <table className="ds-matrix-table">
        <thead>
          <tr className="ds-day-row">
            <th className="ds-corner" rowSpan={2}>
              クラス
            </th>
            {DAYS.map((d) => (
              <th key={d} className="ds-day-start" colSpan={PERIODS.length}>
                {d}曜日
              </th>
            ))}
          </tr>
          <tr className="ds-period-row">
            {DAYS.map((d, _di) =>
              PERIODS.map((p, pi) => (
                <th
                  key={`${d}-${p}`}
                  className={pi === 0 ? "ds-day-start" : ""}
                >
                  {p}
                </th>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ki) => {
            const prevGrade = ki > 0 ? rows[ki - 1].grade : null;
            const gradeBoundary = prevGrade !== null && prevGrade !== row.grade;
            return (
              <tr
                key={`${row.grade}-${row.class_name}`}
                className={gradeBoundary ? "ds-grade-boundary" : ""}
              >
                <td className="ds-row-head">{row.label}</td>
                {DAYS.map((d, _di) =>
                  PERIODS.map((p, pi) => {
                    const cellKey = `${row.grade}|${row.class_name}|${d}|${p}`;
                    const entry = getEntry(d, p, row.grade, row.class_name);
                    const isEmpty = !entry?.subject;
                    const isSelected =
                      selectedCell?.grade === row.grade &&
                      selectedCell.class_name === row.class_name &&
                      selectedCell.day_of_week === d &&
                      selectedCell.period === p;
                    const hasConflict = conflictKeys.has(cellKey);
                    const isDragOver = dragOver === cellKey;
                    const teacher = entry?.teacher_id
                      ? teachers.find((t) => t.id === entry.teacher_id)
                      : undefined;

                    const cls = [
                      "ds-matrix-cell",
                      pi === 0 ? "ds-day-start" : "",
                      isSelected ? "ds-selected" : "",
                      hasConflict && !isSelected ? "ds-conflict" : "",
                      isEmpty ? "ds-empty" : "",
                      isDragOver ? "ds-dragover" : "",
                    ]
                      .filter(Boolean)
                      .join(" ");

                    const handleSelect = () =>
                      onSelectCell({
                        grade: row.grade,
                        class_name: row.class_name,
                        day_of_week: d,
                        period: p,
                      });

                    return (
                      <td
                        key={cellKey}
                        className={cls}
                        draggable={!isEmpty}
                        onDragStart={(e) => {
                          if (!isEmpty) {
                            const pos: CellPosition = {
                              grade: row.grade,
                              class_name: row.class_name,
                              day_of_week: d,
                              period: p,
                            };
                            e.dataTransfer.setData(
                              "text/plain",
                              JSON.stringify(pos),
                            );
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
                            const src: CellPosition = JSON.parse(
                              e.dataTransfer.getData("text/plain"),
                            );
                            const dst: CellPosition = {
                              grade: row.grade,
                              class_name: row.class_name,
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
                          } catch {
                            /* ignore */
                          }
                        }}
                      >
                        <button
                          type="button"
                          className="ds-matrix-cell-btn"
                          onClick={handleSelect}
                        >
                          {!isEmpty && (
                            <>
                              <div className="ds-m-subj">{entry?.subject}</div>
                              {teacher && (
                                <div className="ds-m-sub">
                                  {teacher.name.split(" ")[0]}
                                </div>
                              )}
                              {hasConflict && (
                                <div className="ds-matrix-conflict-badge">
                                  !
                                </div>
                              )}
                            </>
                          )}
                        </button>
                      </td>
                    );
                  }),
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
