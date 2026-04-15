import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  X,
  GripVertical,
  CheckCircle2,
  AlertTriangle,
  MousePointer2,
} from "lucide-react";
import { DAYS, PERIODS } from "@/constants";
import type { CellPosition, ClassRowConfig, DayOfWeek, Period } from "@/types";
import { useTimetableStore } from "../store/useTimetableStore";
import { CellDropdown } from "./cell-dropdown/CellDropdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

const makeCellKey = (
  grade: number,
  class_name: string,
  day: DayOfWeek,
  period: Period,
) => `${grade}|${class_name}|${day}|${period}`;

const parseCellKey = (key: string): CellPosition => {
  const [gradeStr, class_name, day_of_week, periodStr] = key.split("|");
  return {
    grade: parseInt(gradeStr, 10),
    class_name,
    day_of_week: day_of_week as DayOfWeek,
    period: parseInt(periodStr, 10) as Period,
  };
};

const TimetableGrid = () => {
  const {
    structure,
    groupCells,
    fixed_slots,
    timetable,
    swapTimetableEntries,
  } = useTimetableStore();
  const { grades } = structure;

  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [dragSrc, setDragSrc] = useState<CellPosition | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const rowConfig = useMemo(() => {
    const config: ClassRowConfig[] = [];
    for (const g of grades) {
      for (const c of g.classes) {
        config.push({
          type: "normal",
          grade: g.grade,
          class_name: c,
          label: `${g.grade}-${c}`,
        });
      }
      if (g.special_classes) {
        for (const c of g.special_classes) {
          config.push({
            type: "special",
            grade: g.grade,
            class_name: c,
            label: `${g.grade}年特支 ${c}`,
          });
        }
      }
    }
    return config;
  }, [grades]);

  const fixedSlotsLookup = useMemo(() => {
    const s = new Set<string>();
    for (const slot of fixed_slots || []) {
      for (const g of grades) {
        const allClasses = [...(g.classes || []), ...(g.special_classes || [])];
        for (const cn of allClasses) {
          const match =
            slot.scope === "all" ||
            (slot.scope === "grade" && g.grade === slot.grade) ||
            (slot.scope === "class" &&
              g.grade === slot.grade &&
              cn === slot.class_name);
          if (match)
            s.add(`${g.grade}|${cn}|${slot.day_of_week}|${slot.period}`);
        }
      }
    }
    return s;
  }, [fixed_slots, grades]);

  const handleGroupSelected = useCallback(() => {
    const cells = Array.from(selectedCells).map(parseCellKey);
    groupCells(cells);
    setSelectedCells(new Set());
  }, [selectedCells, groupCells]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedCells(new Set());
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const selectedCount = selectedCells.size;

  return (
    <div className="relative flex flex-col h-full bg-background overflow-hidden border rounded-xl shadow-sm">
      {/* 選択バナー */}
      {selectedCount > 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-primary text-primary-foreground px-6 py-2 rounded-full shadow-lg animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-2">
            <MousePointer2 className="h-4 w-4" />
            <span className="text-sm font-bold">
              {selectedCount} セル選択中
            </span>
          </div>
          <div className="h-4 w-px bg-primary-foreground/30" />
          <span className="text-xs opacity-90">
            右クリックでグループ化 ／ Esc で解除
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-full hover:bg-white/20 ml-2"
            onClick={() => setSelectedCells(new Set())}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* グリッド本体 */}
      <div className="flex-1 overflow-auto no-scrollbar">
        <table className="w-full border-collapse table-fixed min-w-[1200px]">
          <thead className="sticky top-0 z-20">
            <tr className="bg-muted/80 backdrop-blur-md">
              <th
                rowSpan={2}
                className="w-32 border bg-muted/90 p-3 text-xs font-bold text-muted-foreground uppercase sticky left-0 z-30"
              >
                クラス
              </th>
              {DAYS.map((day) => {
                const theme = DAY_THEME[day as DayOfWeek];
                return (
                  <th
                    key={day}
                    colSpan={PERIODS.length}
                    className={`border p-2 text-xs font-black uppercase text-center ${theme.bg} ${theme.text}`}
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
                      className="border p-1 text-[10px] font-bold text-muted-foreground text-center w-12"
                    >
                      {period}
                    </th>
                  ))}
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rowConfig.map((rowObj) => (
              <tr
                key={`${rowObj.grade}-${rowObj.class_name}`}
                className="group hover:bg-muted/5 transition-colors"
              >
                <td
                  className={`border p-3 text-xs font-bold text-center sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)] ${
                    rowObj.type === "special"
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      : "bg-background text-foreground"
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="whitespace-pre-line leading-tight">
                      {rowObj.label}
                    </span>
                    {rowObj.type === "special" && (
                      <Badge
                        variant="outline"
                        className="text-[8px] h-3 px-1 py-0 font-normal border-amber-500/30"
                      >
                        特支
                      </Badge>
                    )}
                  </div>
                </td>
                {DAYS.map((day) => (
                  <Fragment key={`${rowObj.class_name}-${day}`}>
                    {PERIODS.map((period) => {
                      const key = makeCellKey(
                        rowObj.grade,
                        rowObj.class_name,
                        day as DayOfWeek,
                        period as Period,
                      );
                      const isSelected = selectedCells.has(key);
                      const isFixed = fixedSlotsLookup.has(key);
                      const isDragTarget = dragOver === key;

                      return (
                        <td
                          key={key}
                          draggable={!isFixed}
                          onDragStart={(e) => {
                            if (isFixed) {
                              e.preventDefault();
                              return;
                            }
                            setDragSrc({
                              grade: rowObj.grade,
                              class_name: rowObj.class_name,
                              day_of_week: day as DayOfWeek,
                              period: period as Period,
                            });
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragOver(key);
                          }}
                          onDragLeave={() => setDragOver(null)}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (!dragSrc) return;
                            const dest = {
                              grade: rowObj.grade,
                              class_name: rowObj.class_name,
                              day_of_week: day as DayOfWeek,
                              period: period as Period,
                            };
                            if (
                              dragSrc.grade !== dest.grade ||
                              dragSrc.class_name !== dest.class_name ||
                              dragSrc.day_of_week !== dest.day_of_week ||
                              dragSrc.period !== dest.period
                            ) {
                              swapTimetableEntries(dragSrc, dest);
                            }
                            setDragSrc(null);
                            setDragOver(null);
                          }}
                          className={`border relative p-0 h-[64px] transition-all ${
                            isDragTarget
                              ? "bg-primary/20 ring-2 ring-primary ring-inset z-10"
                              : isSelected
                                ? "bg-primary/10 ring-1 ring-primary/40 z-10"
                                : isFixed
                                  ? "bg-muted/20"
                                  : "hover:bg-muted/5"
                          }`}
                        >
                          <div className="h-full w-full">
                            <CellDropdown
                              day_of_week={day as DayOfWeek}
                              period={period as Period}
                              grade={rowObj.grade}
                              class_name={rowObj.class_name}
                              isSelected={isSelected}
                              selectedCount={selectedCount}
                              onGroupCells={handleGroupSelected}
                            />
                          </div>
                          {isFixed && (
                            <div className="absolute top-0 right-0 p-0.5 pointer-events-none opacity-30">
                              <X className="h-2 w-2" />
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default TimetableGrid;
