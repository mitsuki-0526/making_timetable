import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { DAYS, PERIODS } from "@/constants";
import type { CellPosition, ClassRowConfig, DayOfWeek, Period } from "@/types";
import { useTimetableStore } from "../store/useTimetableStore";
import { CellDropdown } from "./cell-dropdown/CellDropdown";

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
    swapTimetableEntries,
    setTimetableEntry,
    setTimetableTeacher,
    setEntryTtAssignment,
  } = useTimetableStore();
  const { grades } = structure;

  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [dragSrc, setDragSrc] = useState<CellPosition | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  // キーボード操作での入れ替えマーク（`x` で元をマーク、別セルで `v` で入れ替え）
  const [keySwapSrc, setKeySwapSrc] = useState<CellPosition | null>(null);
  const [focusedCell, setFocusedCell] = useState<string | null>(null);

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
            label: `${g.grade}年 ${c}`,
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

  const handleToggleCellSelection = useCallback((key: string) => {
    setSelectedCells((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
    setFocusedCell(key);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedCells(new Set());
        setKeySwapSrc(null);
      }
      // キーボード操作のみのユーザー向けセル入れ替え
      if (!focusedCell) return;
      const pos = parseCellKey(focusedCell);
      if (e.key === "x" || e.key === "X") {
        e.preventDefault();
        setKeySwapSrc(pos);
      }
      if (e.key === "v" || e.key === "V") {
        if (!keySwapSrc) return;
        e.preventDefault();
        const sameCell =
          keySwapSrc.grade === pos.grade &&
          keySwapSrc.class_name === pos.class_name &&
          keySwapSrc.day_of_week === pos.day_of_week &&
          keySwapSrc.period === pos.period;
        if (!sameCell) swapTimetableEntries(keySwapSrc, pos);
        setKeySwapSrc(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [focusedCell, keySwapSrc, swapTimetableEntries]);

  const selectedCount = selectedCells.size;

  return (
    <section className="relative">
      {/* ヘッダー */}
      <div className="flex items-baseline justify-between pb-2">
        <h2 className="text-[13px] font-semibold text-foreground">時間割</h2>
        <p className="text-[11px] text-muted-foreground">
          クリックで編集／ドラッグ、または
          <kbd className="mx-1 rounded-sm border border-border bg-background px-1 font-mono text-[10px]">
            X
          </kbd>
          →
          <kbd className="mx-1 rounded-sm border border-border bg-background px-1 font-mono text-[10px]">
            V
          </kbd>
          で入れ替え
        </p>
      </div>

      {keySwapSrc && (
        <div
          className="mb-px flex items-center gap-2 border border-border bg-selection-subtle px-3 py-1.5 text-[12px]"
          role="status"
        >
          <span className="font-semibold">入れ替え元</span>
          <span className="tabular-nums text-muted-foreground">
            {keySwapSrc.grade}-{keySwapSrc.class_name} {keySwapSrc.day_of_week}
            曜 {keySwapSrc.period}限
          </span>
          <span className="text-muted-foreground">
            ／別のセルで
            <kbd className="mx-1 rounded-sm border border-border bg-background px-1 font-mono text-[10px]">
              V
            </kbd>
            を押して入れ替え、
            <kbd className="mx-1 rounded-sm border border-border bg-background px-1 font-mono text-[10px]">
              Esc
            </kbd>
            で解除
          </span>
        </div>
      )}

      {/* 選択状態の情報バー */}
      {selectedCount > 0 && (
        <div className="sticky top-12 z-40 mb-px flex items-center gap-3 border border-border bg-selection-subtle px-3 py-1.5 text-[12px] text-foreground">
          <span className="font-semibold tabular-nums">
            {selectedCount} セル選択中
          </span>
          <span className="text-muted-foreground">
            右クリックでグループ化／Esc で解除
          </span>
        </div>
      )}

      {/* グリッド本体 */}
      <div className="overflow-auto border border-border-strong bg-background">
        <table className="w-full border-collapse table-fixed min-w-[1200px] text-[12px]">
          <colgroup>
            <col className="w-[112px]" />
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
                className="sticky left-0 top-0 z-40 border-b border-r-2 border-border-strong bg-surface px-2 py-2 text-left align-middle text-[11px] font-semibold text-muted-foreground"
              >
                クラス
              </th>
              {DAYS.map((day, idx) => (
                <th
                  key={day}
                  colSpan={PERIODS.length}
                  className={`sticky top-0 z-30 border-b border-border bg-surface px-2 py-1.5 text-center text-[12px] font-semibold text-foreground ${
                    idx > 0 ? "border-l-2 border-l-border-strong" : ""
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
                    className={`sticky top-[30px] z-30 border-b-2 border-border-strong bg-surface px-1 py-1 text-center text-[10px] font-normal text-muted-foreground tabular-nums ${
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
            {rowConfig.map((rowObj, rowIdx) => (
              <tr key={`${rowObj.grade}-${rowObj.class_name}`}>
                <td
                  className={`sticky left-0 z-20 bg-background border-r-2 border-border-strong px-2 py-1 text-[12px] font-semibold text-foreground whitespace-nowrap ${
                    rowIdx !== rowConfig.length - 1
                      ? "border-b border-border"
                      : ""
                  }`}
                >
                  {rowObj.label}
                </td>
                {DAYS.map((day, dayIdx) =>
                  PERIODS.map((period, pIdx) => {
                    const key = makeCellKey(
                      rowObj.grade,
                      rowObj.class_name,
                      day as DayOfWeek,
                      period as Period,
                    );
                    const isSelected = selectedCells.has(key);
                    const isFixed = fixedSlotsLookup.has(key);
                    const isDragTarget = dragOver === key;
                    const isLastRow = rowIdx === rowConfig.length - 1;
                    const isDayStart = pIdx === 0 && dayIdx > 0;
                    const isKeySwapSrc =
                      keySwapSrc &&
                      keySwapSrc.grade === rowObj.grade &&
                      keySwapSrc.class_name === rowObj.class_name &&
                      keySwapSrc.day_of_week === day &&
                      keySwapSrc.period === period;

                    return (
                      <td
                        key={key}
                        data-cell-key={key}
                        draggable={!isFixed}
                        onFocus={() => setFocusedCell(key)}
                        onBlur={(e) => {
                          // focus が子から外へ出た時だけ null に
                          if (
                            !e.currentTarget.contains(
                              e.relatedTarget as Node | null,
                            )
                          ) {
                            setFocusedCell(null);
                          }
                        }}
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
                          e.dataTransfer.dropEffect = "copy";
                          setDragOver(key);
                        }}
                        onDragLeave={() => setDragOver(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          const dest = {
                            grade: rowObj.grade,
                            class_name: rowObj.class_name,
                            day_of_week: day as DayOfWeek,
                            period: period as Period,
                          };
                          try {
                            const data = JSON.parse(
                              e.dataTransfer.getData("text/plain"),
                            );
                            if (data.kind === "subject") {
                              setTimetableEntry(
                                dest.day_of_week,
                                dest.period,
                                dest.grade,
                                dest.class_name,
                                null,
                                data.subject,
                              );
                            } else if (data.kind === "teacher") {
                              setTimetableTeacher(
                                dest.day_of_week,
                                dest.period,
                                dest.grade,
                                dest.class_name,
                                data.teacher_id,
                              );
                            } else if (data.kind === "tt_assignment") {
                              setEntryTtAssignment(
                                dest.day_of_week,
                                dest.period,
                                dest.grade,
                                dest.class_name,
                                data.tt_assignment_id,
                              );
                            } else if (dragSrc) {
                              if (
                                dragSrc.grade !== dest.grade ||
                                dragSrc.class_name !== dest.class_name ||
                                dragSrc.day_of_week !== dest.day_of_week ||
                                dragSrc.period !== dest.period
                              ) {
                                swapTimetableEntries(dragSrc, dest);
                              }
                            }
                          } catch {
                            if (dragSrc) swapTimetableEntries(dragSrc, dest);
                          }
                          setDragSrc(null);
                          setDragOver(null);
                        }}
                        className={`relative h-[76px] p-0 transition-colors
                          ${!isLastRow ? "border-b border-border" : ""}
                          ${isDayStart ? "border-l-2 border-l-border-strong" : "border-l border-border"}
                          ${isDragTarget ? "bg-selection-subtle outline outline-2 outline-selection outline-offset-[-2px]" : ""}
                          ${!isDragTarget && isKeySwapSrc ? "bg-selection-subtle outline outline-2 outline-dashed outline-selection outline-offset-[-2px]" : ""}
                          ${!isDragTarget && !isKeySwapSrc && isSelected ? "bg-selection-subtle outline outline-1 outline-selection outline-offset-[-1px]" : ""}
                          ${!isDragTarget && !isKeySwapSrc && !isSelected && isFixed ? "bg-surface" : ""}
                          ${!isDragTarget && !isKeySwapSrc && !isSelected && !isFixed ? "hover:bg-surface" : ""}
                        `}
                      >
                        <div className="h-full w-full">
                          <CellDropdown
                            day_of_week={day as DayOfWeek}
                            period={period as Period}
                            grade={rowObj.grade}
                            class_name={rowObj.class_name}
                            isSelected={isSelected}
                            onCtrlClick={() => handleToggleCellSelection(key)}
                            selectedCount={selectedCount}
                            onGroupCells={handleGroupSelected}
                          />
                        </div>
                        {isFixed && (
                          <span
                            className="pointer-events-none absolute right-0.5 top-0.5 text-[8px] font-semibold text-muted-foreground"
                            title="固定コマ"
                          >
                            固
                          </span>
                        )}
                      </td>
                    );
                  }),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
export default TimetableGrid;
