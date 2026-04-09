import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useTimetableStore } from "../store/useTimetableStore";
import CellDropdown from "./CellDropdown";
import styles from "./TimetableGrid.module.css";

const DAYS = ["月", "火", "水", "木", "金"];
const PERIODS = [1, 2, 3, 4, 5, 6];

// M3 Expressive — 曜日コンテナカラー（ハーモナイズド）
const DAY_COLOR = {
  月: {
    container: "var(--day-mon-container)",
    on: "var(--day-mon-on)",
    fixed: "var(--day-mon-fixed)",
  },
  火: {
    container: "var(--day-tue-container)",
    on: "var(--day-tue-on)",
    fixed: "var(--day-tue-fixed)",
  },
  水: {
    container: "var(--day-wed-container)",
    on: "var(--day-wed-on)",
    fixed: "var(--day-wed-fixed)",
  },
  木: {
    container: "var(--day-thu-container)",
    on: "var(--day-thu-on)",
    fixed: "var(--day-thu-fixed)",
  },
  金: {
    container: "var(--day-fri-container)",
    on: "var(--day-fri-on)",
    fixed: "var(--day-fri-fixed)",
  },
};

// 選択セルのキー: "grade|class_name|day|period"
const makeCellKey = (grade, class_name, day, period) =>
  `${grade}|${class_name}|${day}|${period}`;
const parseCellKey = (key) => {
  const [gradeStr, class_name, day_of_week, periodStr] = key.split("|");
  return {
    grade: parseInt(gradeStr, 10),
    class_name,
    day_of_week,
    period: parseInt(periodStr, 10),
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

  const [selectedCells, setSelectedCells] = useState(new Set());
  const [dragSrc, setDragSrc] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  // クラス行の設定
  const rowConfig = grades.flatMap((g) => {
    const rows = [];
    g.classes.forEach((c) => {
      rows.push({
        type: "normal",
        grade: g.grade,
        class_name: c,
        label: `${g.grade}-${c}`,
      });
    });
    if (g.special_classes) {
      g.special_classes.forEach((c) => {
        rows.push({
          type: "special",
          grade: g.grade,
          class_name: c,
          label: `${g.grade}特支\n${c}`,
        });
      });
    }
    return rows;
  });

  // 固定コマのルックアップセット（効率化）
  const fixedSlotsLookup = useMemo(() => {
    const s = new Set();
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

  // Ctrl+クリックでセルをトグル選択
  const handleCtrlClick = useCallback((grade, class_name, day, period) => {
    const key = makeCellKey(grade, class_name, day, period);
    setSelectedCells((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // 選択セルをグループ化
  const handleGroupSelected = useCallback(() => {
    const cells = Array.from(selectedCells).map(parseCellKey);
    groupCells(cells);
    setSelectedCells(new Set());
  }, [selectedCells, groupCells]);

  // Escapeで選択解除
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") setSelectedCells(new Set());
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const selectedCount = selectedCells.size;

  return (
    <div className={`grid-container ${styles.gridContainer}`}>
      {selectedCount > 0 && (
        <div className={styles.selectionBanner}>
          <span className={styles.selectionCount}>{selectedCount} セル選択中</span>
          <span className={styles.selectionBannerSecondary}>
            右クリック → グループ化 ／ Esc で解除
          </span>
          <button
            type="button"
            onClick={() => setSelectedCells(new Set())}
            className={styles.selectionCloseButton}
          >
            ✕
          </button>
        </div>
      )}
      <div className={styles.gridWrapper}>
        <table className={`grid-table ${styles.gridTable}`}>
          <thead>
            <tr>
              <th rowSpan={2} className={styles.stickyHeader}>
                クラス
              </th>
              {DAYS.map((day) => {
                const dc = DAY_COLOR[day];
                return (
                  <th
                    key={day}
                    colSpan={PERIODS.length}
                    className={styles.dayHeader}
                    style={{
                      background: dc.container,
                      color: dc.on,
                      borderBottom: `2px solid color-mix(in srgb, ${dc.container} 60%, ${dc.fixed})`,
                    }}
                  >
                    {day}曜日
                  </th>
                );
              })}
            </tr>
            <tr>
              {DAYS.map((day) => {
                const dc = DAY_COLOR[day];
                return (
                  <Fragment key={`periods-${day}`}>
                    {PERIODS.map((period) => (
                      <th
                        key={`${day}-${period}`}
                        className={styles.periodHeader}
                        style={{
                          color: dc.on,
                          background: `color-mix(in srgb, ${dc.container} 70%, white)`,
                          borderRight:
                            period === PERIODS[PERIODS.length - 1]
                              ? `1px solid var(--md-outline-variant)`
                              : undefined,
                        }}
                      >
                        {period}
                      </th>
                    ))}
                  </Fragment>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rowConfig.map((rowObj) => (
              <tr key={`${rowObj.grade}-${rowObj.class_name}`}>
                <td
                  className={styles.rowLabelCell}
                  style={{
                    background:
                      rowObj.type === "special"
                        ? "var(--md-tertiary-container)"
                        : "var(--md-surface-container-low)",
                    color:
                      rowObj.type === "special"
                        ? "var(--md-on-tertiary-container)"
                        : "var(--md-on-surface-variant)",
                  }}
                >
                  {rowObj.label}
                </td>
                {DAYS.map((day) => (
                  <Fragment key={`${rowObj.class_name}-${day}`}>
                    {PERIODS.map((period) => {
                      const key = makeCellKey(
                        rowObj.grade,
                        rowObj.class_name,
                        day,
                        period,
                      );
                      const isSelected = selectedCells.has(key);
                      const isFixed = fixedSlotsLookup.has(key);
                      const isDragTarget = dragOver === key;
                      const hasEntry = timetable.some(
                        (e) =>
                          e.grade === rowObj.grade &&
                          e.class_name === rowObj.class_name &&
                          e.day_of_week === day &&
                          e.period === period,
                      );
                      return (
                        <td
                          key={`${rowObj.class_name}-${day}-${period}`}
                          draggable={!isFixed}
                          onDragStart={(e) => {
                            if (isFixed) {
                              e.preventDefault();
                              return;
                            }
                            setDragSrc({
                              grade: rowObj.grade,
                              class_name: rowObj.class_name,
                              day_of_week: day,
                              period,
                            });
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                            setDragOver(
                              `${rowObj.grade}|${rowObj.class_name}|${day}|${period}`,
                            );
                          }}
                          onDragLeave={() => setDragOver(null)}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (!dragSrc) return;
                            const dest = {
                              grade: rowObj.grade,
                              class_name: rowObj.class_name,
                              day_of_week: day,
                              period,
                            };
                            const isSameCell =
                              dragSrc.grade === dest.grade &&
                              dragSrc.class_name === dest.class_name &&
                              dragSrc.day_of_week === dest.day_of_week &&
                              dragSrc.period === dest.period;
                            if (!isSameCell) {
                              swapTimetableEntries(dragSrc, dest);
                            }
                            setDragSrc(null);
                            setDragOver(null);
                          }}
                          onDragEnd={() => {
                            setDragSrc(null);
                            setDragOver(null);
                          }}
                          className={styles.timetableCell}
                          style={{
                            borderRight:
                              period === PERIODS[PERIODS.length - 1]
                                ? `1px solid var(--md-outline-variant)`
                                : undefined,
                            outline: isDragTarget
                              ? `2px solid var(--md-primary)`
                              : isSelected
                                ? `2px solid var(--md-primary)`
                                : undefined,
                            background: isDragTarget
                              ? "var(--md-primary-container)"
                              : undefined,
                            cursor: isFixed
                              ? "default"
                              : hasEntry
                                ? "grab"
                                : undefined,
                          }}
                        >
                          {isFixed && (
                            <div className={styles.cellLock}>
                              🔒
                            </div>
                          )}
                          {!isFixed && hasEntry && (
                            <div className={styles.cellHandle}>
                              ⠿
                            </div>
                          )}
                          <div className="cell-content">
                            <CellDropdown
                              day_of_week={day}
                              period={period}
                              grade={rowObj.grade}
                              class_name={rowObj.class_name}
                              isSelected={isSelected}
                              onCtrlClick={() =>
                                handleCtrlClick(
                                  rowObj.grade,
                                  rowObj.class_name,
                                  day,
                                  period,
                                )
                              }
                              selectedCount={selectedCount}
                              onGroupCells={handleGroupSelected}
                            />
                          </div>
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
