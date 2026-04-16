import { Fragment, useEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { DAYS, PERIODS } from "@/constants";
import type { DayOfWeek, Period, Teacher, TimetableEntry } from "@/types";
import { useTimetableStore } from "../store/useTimetableStore";

const TeacherScheduleGrid = () => {
  const { teachers, teacher_groups, timetable } = useTimetableStore();
  const [orderedTeachers, setOrderedTeachers] = useState<Teacher[]>([]);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragIdxRef = useRef<number | null>(null);

  useEffect(() => {
    setOrderedTeachers(teachers);
  }, [teachers]);

  const handleDragStart = (idx: number) => {
    setDraggingIdx(idx);
    dragIdxRef.current = idx;
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (idx: number) => {
    if (dragIdxRef.current === null || dragIdxRef.current === idx) {
      setDraggingIdx(null);
      setDragOverIdx(null);
      return;
    }
    const newOrder = [...orderedTeachers];
    const [removed] = newOrder.splice(dragIdxRef.current, 1);
    newOrder.splice(idx, 0, removed);
    setOrderedTeachers(newOrder);
    setDraggingIdx(null);
    setDragOverIdx(null);
    dragIdxRef.current = null;
  };

  const handleDragEnd = () => {
    setDraggingIdx(null);
    setDragOverIdx(null);
    dragIdxRef.current = null;
  };

  const getEntries = (teacherId: string, day: DayOfWeek, period: Period) => {
    const matched = timetable.filter((entry) => {
      if (entry.day_of_week !== day || entry.period !== period) return false;
      if (entry.teacher_id === teacherId || entry.alt_teacher_id === teacherId)
        return true;
      if (entry.teacher_group_id) {
        const grp = teacher_groups.find((g) => g.id === entry.teacher_group_id);
        if (grp?.teacher_ids?.includes(teacherId)) return true;
      }
      return false;
    });
    if (matched.length === 0) return null;

    const first = matched[0];
    const role =
      first.teacher_id === teacherId
        ? "primary"
        : first.alt_teacher_id === teacherId
          ? "alt"
          : "group";

    let allEntries = matched;
    if (first.cell_group_id) {
      const inCellGroup = timetable.filter(
        (e) =>
          e.day_of_week === day &&
          e.period === period &&
          e.cell_group_id === first.cell_group_id,
      );
      allEntries = inCellGroup.filter((e) => {
        if (e.teacher_id === teacherId || e.alt_teacher_id === teacherId)
          return true;
        if (e.teacher_group_id) {
          const grp = teacher_groups.find((g) => g.id === e.teacher_group_id);
          return grp?.teacher_ids?.includes(teacherId) ?? false;
        }
        return false;
      });
      if (allEntries.length === 0) allEntries = [first];
    }
    return {
      first,
      role,
      allEntries,
      isGrouped: first.cell_group_id && allEntries.length > 1,
    };
  };

  const classLabel = (entry: TimetableEntry) => {
    if (!entry) return "";
    const isSpecial = entry.class_name.includes("特支");
    if (isSpecial) return `${entry.grade} ${entry.class_name}`;
    return `${entry.grade}-${entry.class_name}`;
  };

  const subjectLabel = (entry: TimetableEntry, role: string) => {
    if (!entry) return "";
    return role === "alt" ? entry.alt_subject || "" : entry.subject || "";
  };

  const countPeriods = (teacherId: string) => {
    let count = 0;
    for (const day of DAYS) {
      for (const period of PERIODS) {
        if (getEntries(teacherId, day as DayOfWeek, period as Period) !== null)
          count++;
      }
    }
    return count;
  };

  if (teachers.length === 0) return null;
  const displayTeachers =
    orderedTeachers.length === teachers.length ? orderedTeachers : teachers;

  return (
    <section>
      <div className="flex items-baseline justify-between pb-2">
        <h2 className="text-[13px] font-semibold text-foreground">
          先生別スケジュール
        </h2>
        <p className="text-[11px] text-muted-foreground">
          行をドラッグで並び替え／縦列は時限
        </p>
      </div>

      <div className="overflow-auto border border-border-strong bg-background">
        <table className="w-full border-collapse table-fixed min-w-[1400px] text-[12px]">
          <colgroup>
            <col style={{ width: 24 }} />
            <col style={{ width: 128 }} />
            <col style={{ width: 56 }} />
            {DAYS.map((day) => (
              <Fragment key={day}>
                {PERIODS.map((period) => (
                  <col key={`${day}-${period}`} />
                ))}
              </Fragment>
            ))}
          </colgroup>
          <thead>
            <tr>
              <th
                rowSpan={2}
                className="sticky left-0 top-0 z-30 border-b border-r border-border bg-surface"
              />
              <th
                rowSpan={2}
                className="sticky left-[24px] top-0 z-30 border-b border-r border-border bg-surface px-2 py-1.5 text-left text-[11px] font-semibold text-muted-foreground"
              >
                先生
              </th>
              <th
                rowSpan={2}
                className="sticky left-[152px] top-0 z-30 border-b border-r-2 border-border-strong bg-surface px-2 py-1.5 text-right text-[11px] font-semibold text-muted-foreground"
              >
                週計
              </th>
              {DAYS.map((day, dayIdx) => (
                <th
                  key={day}
                  colSpan={PERIODS.length}
                  className={`sticky top-0 z-20 border-b border-border bg-surface px-2 py-1.5 text-center text-[12px] font-semibold text-foreground ${
                    dayIdx > 0 ? "border-l-2 border-l-border-strong" : ""
                  }`}
                >
                  {day}曜日
                </th>
              ))}
            </tr>
            <tr>
              {DAYS.map((day, dayIdx) =>
                PERIODS.map((period, pIdx) => (
                  <th
                    key={`${day}-${period}`}
                    className={`sticky top-[30px] z-20 border-b-2 border-border-strong bg-surface px-1 py-1 text-center text-[10px] font-normal text-muted-foreground tabular-nums ${
                      pIdx === 0 && dayIdx > 0
                        ? "border-l-2 border-l-border-strong"
                        : ""
                    }`}
                  >
                    {period}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {displayTeachers.map((teacher, idx) => {
              const total = countPeriods(teacher.id);
              const isDragging = draggingIdx === idx;
              const isDropTarget = dragOverIdx === idx && draggingIdx !== idx;
              const isLastRow = idx === displayTeachers.length - 1;

              return (
                <tr
                  key={teacher.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={() => handleDrop(idx)}
                  onDragEnd={handleDragEnd}
                  className={`${isDragging ? "opacity-40" : ""} ${
                    isDropTarget
                      ? "outline outline-2 outline-selection outline-offset-[-2px]"
                      : ""
                  }`}
                >
                  <td
                    className={`sticky left-0 z-10 bg-background text-center align-middle ${
                      !isLastRow ? "border-b border-border" : ""
                    } border-r border-border`}
                  >
                    <span className="flex cursor-grab items-center justify-center text-muted-foreground/60 hover:text-foreground">
                      <GripVertical className="h-3.5 w-3.5" />
                    </span>
                  </td>
                  <td
                    className={`sticky left-[24px] z-10 bg-background px-2 py-1.5 align-middle ${
                      !isLastRow ? "border-b border-border" : ""
                    } border-r border-border`}
                  >
                    <div className="flex flex-col leading-tight">
                      <span className="text-[12px] font-semibold text-foreground">
                        {teacher.name.split("(")[0].trim()}
                      </span>
                      <span className="truncate text-[10px] text-muted-foreground">
                        {teacher.subjects.join("・")}
                      </span>
                    </div>
                  </td>
                  <td
                    className={`sticky left-[152px] z-10 bg-background px-2 py-1.5 text-right align-middle tabular-nums ${
                      !isLastRow ? "border-b border-border" : ""
                    } border-r-2 border-border-strong`}
                  >
                    {total > 0 ? (
                      <span className="font-semibold text-foreground">
                        {total}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/30">–</span>
                    )}
                  </td>
                  {DAYS.map((day, dayIdx) =>
                    PERIODS.map((period, pIdx) => {
                      const isDayStart = pIdx === 0 && dayIdx > 0;
                      const result = getEntries(
                        teacher.id,
                        day as DayOfWeek,
                        period as Period,
                      );
                      if (!result) {
                        return (
                          <td
                            key={`${day}-${period}`}
                            className={`h-10 px-1 py-1 text-center align-middle ${
                              !isLastRow ? "border-b border-border" : ""
                            } ${
                              isDayStart
                                ? "border-l-2 border-l-border-strong"
                                : "border-l border-border"
                            }`}
                          />
                        );
                      }

                      const { first, role, allEntries, isGrouped } = result;
                      const isAlt = role === "alt";

                      return (
                        <td
                          key={`${day}-${period}`}
                          className={`h-10 px-1 py-1 align-middle ${
                            !isLastRow ? "border-b border-border" : ""
                          } ${
                            isDayStart
                              ? "border-l-2 border-l-border-strong"
                              : "border-l border-border"
                          } ${isGrouped ? "bg-selection-subtle" : ""}`}
                        >
                          <div className="flex flex-col items-center justify-center text-center leading-tight">
                            <span
                              className={`text-[11px] font-semibold ${
                                isAlt ? "text-warning" : "text-foreground"
                              }`}
                            >
                              {isGrouped
                                ? allEntries
                                    .map((e) => classLabel(e))
                                    .join("＋")
                                : classLabel(first)}
                            </span>
                            <span className="truncate text-[10px] text-muted-foreground">
                              {subjectLabel(first, role)}
                              {isAlt && " (B)"}
                            </span>
                          </div>
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
    </section>
  );
};
export default TeacherScheduleGrid;
