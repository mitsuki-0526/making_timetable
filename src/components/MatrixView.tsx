import { useMemo, useState } from "react";
import { DAYS, PERIODS } from "@/constants";
import { useTimetableStore } from "@/store/useTimetableStore";
import type { CellPosition, DayOfWeek, Period } from "@/types";
import { TimetableEntryContent } from "@/components/TimetableEntryContent";

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
}

export function MatrixView({
  selectedCellKeys,
  onSelectCell,
  conflictKeys,
  filterGrade,
}: MatrixViewProps) {
  const { getEntry, setTimetableEntry, setTimetableTeacher, setEntryGroup, swapTimetableEntries, structure } = useTimetableStore();
  const teachers = useTimetableStore((s) => s.teachers);
  const teacher_groups = useTimetableStore((s) => s.teacher_groups);

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
    }
    return list;
  }, [structure.grades, filterGrade]);
  return (
    <div className="ds-matrix-wrap" style={{ flex: 1, minHeight: 0 }} onDragOver={(e) => e.preventDefault()}>
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
                    const isSelected = selectedCellKeys.has(cellKey);
                    const hasConflict = conflictKeys.has(cellKey);
                    const isDragOver = dragOver === cellKey;
                    const teacher = entry?.teacher_id
                      ? teachers.find((t) => t.id === entry.teacher_id)
                      : undefined;
                    const tGroup = entry?.teacher_group_id
                      ? teacher_groups.find(
                          (group) => group.id === entry.teacher_group_id,
                        )
                      : undefined;
                    const displayTeacher = teacher
                      ? teacher.name.split(" ")[0]
                      : tGroup?.name;
                    const altSubject = entry?.alt_subject;

                    const handleSelect = (
                      event: React.MouseEvent<HTMLButtonElement>,
                    ) =>
                      onSelectCell(
                        {
                          grade: row.grade,
                          class_name: row.class_name,
                          day_of_week: d,
                          period: p,
                        },
                        {
                          additive: event.ctrlKey || event.metaKey,
                        },
                      );

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

                    return (
                      <td
                        key={cellKey}
                        data-cell-key={cellKey}
                        className={cls}
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
                              setTimetableEntry(d, p, row.grade, row.class_name, null, data.subject);
                            } else if (data.kind === "teacher") {
                              setTimetableTeacher(d, p, row.grade, row.class_name, data.teacher_id);
                            } else if (data.kind === "teacher_group") {
                              setEntryGroup(d, p, row.grade, row.class_name, data.teacher_group_id);
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
                          className="ds-matrix-cell-btn"
                        >
                          {!isEmpty && (
                            <TimetableEntryContent
                              subject={entry.subject}
                              teacherName={displayTeacher}
                              altSubject={altSubject}
                              altTeacherName={entry?.alt_teacher_id
                                ? (useTimetableStore.getState().teachers.find((t) => t.id === entry.alt_teacher_id)?.name ?? undefined)
                                : undefined}
                              dense
                              style={{ alignItems: "center", textAlign: "center" }}
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
