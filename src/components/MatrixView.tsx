import { type CSSProperties, useMemo, useState } from "react";
import { TimetableEntryContent } from "@/components/TimetableEntryContent";
import { DAYS } from "@/constants";
import { getDisplayPeriods, isPeriodEnabled } from "@/lib/dayPeriods";
import { getEntryTeacherLabel } from "@/lib/teamTeaching";
import { useTimetableStore } from "@/store/useTimetableStore";
import type { CellPosition, DayOfWeek, Period } from "@/types";

interface SelectedCell {
  grade: number;
  class_name: string;
  day_of_week: DayOfWeek;
  period: Period;
}

interface SelectCellOptions {
  additive?: boolean;
}

interface MatrixViewProps {
  selectedCellKeys: Set<string>;
  onSelectCell: (cell: SelectedCell, options?: SelectCellOptions) => void;
  conflictKeys: Set<string>;
  filterGrade: number | null;
  zoomPercent: number;
  paintSubject: string | null;
  onPaintSubject: (cell: SelectedCell) => void;
}

export function MatrixView({
  selectedCellKeys,
  onSelectCell,
  conflictKeys,
  filterGrade,
  zoomPercent,
  paintSubject,
  onPaintSubject,
}: MatrixViewProps) {
  const {
    getEntry,
    setTimetableEntry,
    setTimetableTeacher,
    setEntryTtAssignment,
    swapTimetableEntries,
    settings,
    structure,
  } = useTimetableStore();
  const teachers = useTimetableStore((s) => s.teachers);

  const [dragOver, setDragOver] = useState<string | null>(null);
  const displayPeriods = useMemo(() => getDisplayPeriods(settings), [settings]);

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
    }
    return list;
  }, [structure.grades, filterGrade]);

  const matrixScaleStyle = {
    flex: 1,
    minHeight: 0,
    "--ds-matrix-scale": `${zoomPercent / 100}`,
  } as CSSProperties;

  return (
    <div className="ds-matrix-wrap" style={matrixScaleStyle}>
      <table className="ds-matrix-table">
        <thead>
          <tr className="ds-day-row">
            <th className="ds-corner" rowSpan={2}>
              クラス
            </th>
            {DAYS.map((d) => (
              <th
                key={d}
                className="ds-day-start"
                colSpan={displayPeriods.length}
              >
                {d}曜日
              </th>
            ))}
          </tr>
          <tr className="ds-period-row">
            {DAYS.map((d, _di) =>
              displayPeriods.map((p, pi) => (
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
                  displayPeriods.map((p, pi) => {
                    const cellKey = `${row.grade}|${row.class_name}|${d}|${p}`;
                    const entry = getEntry(d, p, row.grade, row.class_name);
                    const isDisabled = !isPeriodEnabled(settings, d, p);
                    const isEmpty = !entry?.subject;
                    const isSelected = selectedCellKeys.has(cellKey);
                    const hasConflict = conflictKeys.has(cellKey);
                    const isDragOver = dragOver === cellKey;
                    const displayTeacher = entry
                      ? (getEntryTeacherLabel(
                          entry,
                          teachers,
                          "primary",
                          true,
                        ) ?? undefined)
                      : undefined;
                    const altTeacherLabel = entry
                      ? (getEntryTeacherLabel(entry, teachers, "alt", true) ??
                        undefined)
                      : undefined;
                    const altSubject = entry?.alt_subject;

                    const handleSelect = (
                      event: React.MouseEvent<HTMLButtonElement>,
                    ) => {
                      const cell = {
                        grade: row.grade,
                        class_name: row.class_name,
                        day_of_week: d,
                        period: p,
                      };
                      const additive = event.ctrlKey || event.metaKey;
                      if (paintSubject && !additive) {
                        onPaintSubject(cell);
                      }
                      onSelectCell(cell, {
                        additive,
                      });
                    };

                    const cls = [
                      "ds-matrix-cell",
                      pi === 0 ? "ds-day-start" : "",
                      isSelected ? "ds-selected" : "",
                      hasConflict && !isSelected ? "ds-conflict" : "",
                      isEmpty ? "ds-empty" : "",
                      isDragOver ? "ds-dragover" : "",
                      isDisabled ? "ds-disabled" : "",
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <td
                        key={cellKey}
                        data-cell-key={cellKey}
                        className={cls}
                        onDragOver={(e) => {
                          if (isDisabled) return;
                          e.preventDefault();
                          setDragOver(cellKey);
                        }}
                        onDrop={(e) => {
                          if (isDisabled) return;
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
                                row.grade,
                                row.class_name,
                                null,
                                data.subject,
                              );
                            } else if (data.kind === "teacher") {
                              setTimetableTeacher(
                                d,
                                p,
                                row.grade,
                                row.class_name,
                                data.teacher_id,
                              );
                            } else if (data.kind === "tt_assignment") {
                              setEntryTtAssignment(
                                d,
                                p,
                                row.grade,
                                row.class_name,
                                data.tt_assignment_id,
                              );
                            } else {
                              const src: CellPosition = data;
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
                            }
                          } catch {
                            /* ignore */
                          }
                        }}
                      >
                        <button
                          type="button"
                          aria-label={`${row.label} ${d} ${p}限を選択`}
                          onClick={handleSelect}
                          draggable={!isEmpty && !isDisabled}
                          onDragStart={(e) => {
                            if (isDisabled) {
                              e.preventDefault();
                              return;
                            }
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
                          className="ds-matrix-cell-btn"
                          disabled={isDisabled}
                        >
                          {!isEmpty && (
                            <TimetableEntryContent
                              subject={entry.subject}
                              teacherName={displayTeacher}
                              altSubject={altSubject}
                              altTeacherName={altTeacherLabel}
                              dense
                              style={{
                                alignItems: "center",
                                textAlign: "center",
                              }}
                            />
                          )}
                        </button>

                        {hasConflict && (
                          <div className="ds-matrix-conflict-badge">!</div>
                        )}
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
