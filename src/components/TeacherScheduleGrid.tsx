import { Fragment, useEffect, useRef, useState } from "react";
import {
  GripVertical,
  Users,
  GraduationCap,
  Check,
  Info,
  Calendar,
} from "lucide-react";
import { DAYS, PERIODS } from "@/constants";
import type { DayOfWeek, Period, Teacher, TimetableEntry } from "@/types";
import { useTimetableStore } from "../store/useTimetableStore";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

// 曜日ごとのアクセントカラー（Tailwindクラス名）
const DAY_THEME: Record<
  DayOfWeek,
  { bg: string; text: string; border: string }
> = {
  月: {
    bg: "bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-500/20",
  },
  火: {
    bg: "bg-rose-500/10",
    text: "text-rose-600 dark:text-rose-400",
    border: "border-rose-500/20",
  },
  水: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/20",
  },
  木: {
    bg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-500/20",
  },
  金: {
    bg: "bg-indigo-500/10",
    text: "text-indigo-600 dark:text-indigo-400",
    border: "border-indigo-500/20",
  },
};

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
    if (isSpecial) return `${entry.grade}年 ${entry.class_name}`;
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
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="px-0 pt-0 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-primary" />
            先生ごとのコマ数確認
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            各コマの担当クラスが表示されます。行をドラッグして並び替え可能です。
          </p>
        </div>
      </CardHeader>

      <CardContent className="px-0">
        <div className="flex flex-col h-full bg-background overflow-hidden">
          <div className="flex-1 overflow-auto no-scrollbar">
            <table className="w-full border-collapse table-fixed min-w-[1600px]">
              <thead className="sticky top-0 z-20">
                <tr className="bg-muted/80 backdrop-blur-md">
                  <th
                    rowSpan={2}
                    className="w-10 border bg-muted/90 p-0 sticky left-0 z-40"
                  />
                  <th
                    rowSpan={2}
                    className="w-48 border bg-muted/90 p-4 text-sm font-bold text-muted-foreground uppercase sticky left-10 z-30 shadow-[2px_0_5px_rgba(0,0,0,0.05)]"
                  >
                    先生
                  </th>
                  <th
                    rowSpan={2}
                    className="w-20 border bg-muted/90 p-4 text-sm font-bold text-muted-foreground uppercase text-center sticky left-[232px] z-30"
                  >
                    週計
                  </th>
                  {DAYS.map((day) => {
                    const theme = DAY_THEME[day as DayOfWeek];
                    return (
                      <th
                        key={day}
                        colSpan={PERIODS.length}
                        className={`border p-3 text-sm font-black uppercase text-center ${theme.bg} ${theme.text}`}
                      >
                        {day}曜日
                      </th>
                    );
                  })}
                </tr>
                <tr className="bg-muted/50 backdrop-blur-sm">
                  {DAYS.map((day) => (
                    <Fragment key={`periods-${day}`}>
                      {PERIODS.map((period) => (
                        <th
                          key={`${day}-${period}`}
                          className="border p-2 text-xs font-bold text-muted-foreground text-center w-16"
                        >
                          {period}
                        </th>
                      ))}
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {displayTeachers.map((teacher, idx) => {
                  const total = countPeriods(teacher.id);
                  const isDragging = draggingIdx === idx;
                  const isDropTarget =
                    dragOverIdx === idx && draggingIdx !== idx;

                  return (
                    <tr
                      key={teacher.id}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={() => handleDrop(idx)}
                      onDragEnd={handleDragEnd}
                      className={`group transition-all ${
                        isDragging
                          ? "opacity-30 bg-muted/50"
                          : "hover:bg-muted/5"
                      } ${isDropTarget ? "ring-2 ring-primary ring-inset z-10" : ""}`}
                    >
                      <td className="border p-0 text-center sticky left-0 z-10 bg-background group-hover:bg-muted/5 transition-colors shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                        <div className="flex items-center justify-center cursor-grab active:cursor-grabbing text-muted-foreground/50 group-hover:text-primary transition-colors">
                          <GripVertical className="h-4 w-4" />
                        </div>
                      </td>
                      <td className="border p-4 text-sm font-bold sticky left-10 z-10 bg-background group-hover:bg-muted/5 transition-colors shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                        <div className="flex flex-col gap-1">
                          <span className="text-foreground">
                            {teacher.name.split("(")[0].trim()}
                          </span>
                          <span className="text-xs font-normal text-muted-foreground line-clamp-1">
                            {teacher.subjects.join("・")}
                          </span>
                        </div>
                      </td>
                      <td className="border p-4 text-sm font-mono font-bold text-center sticky left-[232px] z-10 bg-background group-hover:bg-muted/5 transition-colors">
                        {total > 0 ? (
                          <Badge variant="outline" className="font-mono">
                            {total}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/30">－</span>
                        )}
                      </td>
                      {DAYS.map((day) =>
                        PERIODS.map((period) => {
                          const result = getEntries(
                            teacher.id,
                            day as DayOfWeek,
                            period as Period,
                          );
                          if (!result)
                            return (
                              <td
                                key={`${day}-${period}`}
                                className="border p-0 text-center align-middle"
                              >
                                <span className="text-muted-foreground/10 text-xs">
                                  －
                                </span>
                              </td>
                            );

                          const { first, role, allEntries, isGrouped } = result;
                          const isAlt = role === "alt";

                          return (
                            <td
                              key={`${day}-${period}`}
                              className={`border p-2 align-middle min-h-[72px] ${
                                isGrouped ? "bg-primary/5" : ""
                              }`}
                            >
                              <div className="flex flex-col items-center justify-center text-center gap-1">
                                <div className="text-xs font-bold leading-tight flex flex-col gap-1">
                                  {isGrouped ? (
                                    allEntries.map((e, ei) => (
                                      <span
                                        key={ei}
                                        className="px-1 bg-primary/10 rounded-sm"
                                      >
                                        {classLabel(e)}
                                      </span>
                                    ))
                                  ) : (
                                    <span
                                      className={
                                        first.class_name.includes("特支")
                                          ? "text-amber-600 dark:text-amber-400"
                                          : ""
                                      }
                                    >
                                      {classLabel(first)}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs font-medium text-muted-foreground line-clamp-1 opacity-80 uppercase tracking-tighter">
                                  {subjectLabel(first, role)}
                                </div>
                                <div className="flex flex-wrap items-center justify-center gap-1">
                                  {isGrouped && (
                                    <Badge
                                      variant="default"
                                      className="text-xs h-5 px-1.5 py-0.5 font-normal"
                                    >
                                      合同
                                    </Badge>
                                  )}
                                  {first.alt_subject && (
                                    <Badge
                                      variant={
                                        isAlt ? "destructive" : "secondary"
                                      }
                                      className="text-xs h-5 px-1.5 py-0.5 font-normal"
                                    >
                                      {isAlt ? "B週" : "A週"}
                                    </Badge>
                                  )}
                                </div>
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
        </div>
      </CardContent>
    </Card>
  );
};
export default TeacherScheduleGrid;
