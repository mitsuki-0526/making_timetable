import { useEffect, useRef, useState } from "react";
import { useTimetableStore } from "../store/useTimetableStore";
import styles from "./TeacherScheduleGrid.module.css";

const DAYS = ["月", "火", "水", "木", "金"];
const PERIODS = [1, 2, 3, 4, 5, 6];

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

const TeacherScheduleGrid = () => {
  const { teachers, teacher_groups, timetable } = useTimetableStore();
  const [orderedTeachers, setOrderedTeachers] = useState([]);
  const [draggingIdx, setDraggingIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const dragIdxRef = useRef(null);

  useEffect(() => {
    setOrderedTeachers(teachers);
  }, [teachers]);

  const handleDragStart = (idx) => {
    setDraggingIdx(idx);
    dragIdxRef.current = idx;
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (idx) => {
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

  // 指定の先生・曜日・時限の全エントリを取得（グループ対応）
  const getEntries = (teacherId, day, period) => {
    const matched = timetable.filter((entry) => {
      if (entry.day_of_week !== day || entry.period !== period) return false;
      if (entry.teacher_id === teacherId || entry.alt_teacher_id === teacherId)
        return true;
      if (entry.teacher_group_id) {
        const grp = (teacher_groups || []).find(
          (g) => g.id === entry.teacher_group_id,
        );
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

    // cell_group_id があれば同じグループの全エントリを収集
    // ただし、この教員が実際に担当しているエントリのみ含める
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
          const grp = (teacher_groups || []).find(
            (g) => g.id === e.teacher_group_id,
          );
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

  // クラス表示ラベル
  const classLabel = (entry) => {
    if (!entry) return "";
    const isSpecial = entry.class_name.includes("特支");
    if (isSpecial) return `${entry.grade}年\n${entry.class_name}`;
    return `${entry.grade}-${entry.class_name}`;
  };

  // 教科ラベル
  const subjectLabel = (entry, role) => {
    if (!entry) return "";
    return role === "alt" ? entry.alt_subject || "" : entry.subject || "";
  };

  // 週コマ数の集計
  // 色がついているマス（getEntries が null でないスロット）の個数を数える
  // → 合同グループは1マスに複数クラスが表示されるが1コマとカウント
  // → 教員グループ経由も色付きマスに含まれるためカウント対象
  const countPeriods = (teacherId) => {
    let count = 0;
    DAYS.forEach((day) => {
      PERIODS.forEach((period) => {
        if (getEntries(teacherId, day, period) !== null) count++;
      });
    });
    return count;
  };

  if (teachers.length === 0) return null;
  const displayTeachers =
    orderedTeachers.length === teachers.length ? orderedTeachers : teachers;

  return (
    <div className={`validation-panel ${styles.teacherSchedulePanel}`}>
      <div className={styles.validationHeader}>
        <h3 className={styles.validationHeaderTitle}>先生ごとのコマ数</h3>
        <span className={styles.validationHeaderSubtitle}>
          各コマの担当クラスが表示されます
        </span>
      </div>

      <div className={styles.tableWrapper}>
        <table className={`grid-table ${styles.gridTable}`}>
          <thead>
            <tr>
              <th rowSpan={2} className={styles.dragHandleHeader} />
              <th rowSpan={2} className={styles.stickyHeader}>
                先生
              </th>
              <th rowSpan={2} className={styles.weekTotalHeader}>
                週計
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
                return PERIODS.map((period) => (
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
                ));
              })}
            </tr>
          </thead>
          <tbody>
            {displayTeachers.map((teacher, idx) => {
              const total = countPeriods(teacher.id);
              const isDragging = draggingIdx === idx;
              const isDropTarget = dragOverIdx === idx && draggingIdx !== idx;
              return (
                <tr
                  key={teacher.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={() => handleDrop(idx)}
                  onDragEnd={handleDragEnd}
                  style={{
                    opacity: isDragging ? 0.4 : 1,
                    outline: isDropTarget ? "2px solid #2563eb" : undefined,
                  }}
                >
                  <td className={styles.dragHandleCell}>
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontSize: "16px",
                        cursor: "grab",
                        color: "var(--md-on-surface-variant)",
                      }}
                    >
                      drag_indicator
                    </span>
                  </td>
                  <td className={styles.teacherCell}>
                    {teacher.name.split("(")[0].trim()}
                    <div className={styles.teacherMeta}>
                      {teacher.subjects.join("・")}
                    </div>
                  </td>
                  <td
                    className={styles.weekTotalCell}
                    style={{
                      background:
                        total > 0
                          ? "var(--md-primary-container)"
                          : "transparent",
                      color:
                        total > 0
                          ? "var(--md-on-primary-container)"
                          : "var(--md-on-surface-variant)",
                    }}
                  >
                    {total > 0 ? total : "－"}
                  </td>
                  {DAYS.map((day) =>
                    PERIODS.map((period) => {
                      const result = getEntries(teacher.id, day, period);
                      if (!result) {
                        return (
                          <td
                            key={`${day}-${period}`}
                            className={styles.emptyCell}
                            style={{
                              borderRight:
                                period === PERIODS[PERIODS.length - 1]
                                  ? `1px solid var(--md-outline-variant)`
                                  : undefined,
                            }}
                          >
                            –
                          </td>
                        );
                      }
                      const { first, role, allEntries, isGrouped } = result;
                      const isAlt = role === "alt";
                      const isGroup = role === "group";

                      const bgColor = isGrouped
                        ? "var(--md-tertiary-container)"
                        : isGroup
                          ? "var(--day-wed-container)"
                          : isAlt
                            ? "var(--md-secondary-container)"
                            : first.class_name?.includes("特支")
                              ? "var(--md-tertiary-container)"
                              : "var(--md-primary-container)";
                      const textColor = isGrouped
                        ? "var(--md-on-tertiary-container)"
                        : isGroup
                          ? "var(--day-wed-on)"
                          : isAlt
                            ? "var(--md-on-secondary-container)"
                            : first.class_name?.includes("特支")
                              ? "var(--md-on-tertiary-container)"
                              : "var(--md-on-primary-container)";

                      return (
                        <td
                          key={`${day}-${period}`}
                          className={styles.entryCell}
                          style={{
                            background: bgColor,
                            color: textColor,
                            borderRight:
                              period === PERIODS[PERIODS.length - 1]
                                ? `1px solid var(--md-outline-variant)`
                                : undefined,
                          }}
                        >
                          {isGrouped ? (
                            <>
                              <div className={styles.entryLabelSmall}>
                                {allEntries
                                  .map((e) => classLabel(e))
                                  .join("\n")}
                              </div>
                              <div className={styles.entrySubject}>
                                {subjectLabel(first, role)}
                              </div>
                              <div className={styles.groupBadge}>合同</div>
                            </>
                          ) : (
                            <>
                              <div>{classLabel(first)}</div>
                              <div className={styles.entrySubject}>
                                {subjectLabel(first, role)}
                              </div>
                              {first.alt_subject && (
                                <div
                                  className={styles.altBadge}
                                  style={{
                                    background: isAlt
                                      ? "var(--md-tertiary-container)"
                                      : "var(--md-primary-container)",
                                    color: isAlt
                                      ? "var(--md-on-tertiary-container)"
                                      : "var(--md-on-primary-container)",
                                  }}
                                >
                                  {isAlt ? "B週" : "A週"}
                                </div>
                              )}
                            </>
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
    </div>
  );
};

export default TeacherScheduleGrid;
