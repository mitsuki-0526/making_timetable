import { useTimetableStore } from "../store/useTimetableStore";

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
    let allEntries = matched;
    if (first.cell_group_id) {
      allEntries = timetable.filter(
        (e) =>
          e.day_of_week === day &&
          e.period === period &&
          e.cell_group_id === first.cell_group_id,
      );
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

  return (
    <div className="validation-panel" style={{ marginTop: "1.5rem" }}>
      <div className="validation-header">
        <h3
          style={{
            fontSize: "16px",
            fontWeight: 500,
            color: "var(--md-on-surface)",
            margin: 0,
            letterSpacing: "0.15px",
          }}
        >
          先生ごとのコマ数
        </h3>
        <span
          style={{
            fontSize: "12px",
            color: "var(--md-on-surface-variant)",
            letterSpacing: "0.4px",
          }}
        >
          各コマの担当クラスが表示されます
        </span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="grid-table" style={{ fontSize: "0.82rem" }}>
          <thead>
            <tr>
              <th
                rowSpan={2}
                style={{
                  minWidth: "100px",
                  position: "sticky",
                  left: 0,
                  zIndex: 20,
                  background: "var(--md-surface-container-high)",
                  borderRight: `1px solid var(--md-outline-variant)`,
                  fontSize: "11px",
                  fontWeight: 500,
                  letterSpacing: "0.5px",
                  color: "var(--md-on-surface-variant)",
                  textAlign: "center",
                }}
              >
                先生
              </th>
              <th
                rowSpan={2}
                style={{
                  minWidth: "52px",
                  textAlign: "center",
                  background: "var(--md-surface-container-high)",
                  borderRight: `1px solid var(--md-outline-variant)`,
                  fontSize: "11px",
                  fontWeight: 500,
                  letterSpacing: "0.5px",
                  color: "var(--md-on-surface-variant)",
                  fontFamily: "var(--md-font-mono)",
                }}
              >
                週計
              </th>
              {DAYS.map((day) => {
                const dc = DAY_COLOR[day];
                return (
                  <th
                    key={day}
                    colSpan={PERIODS.length}
                    style={{
                      textAlign: "center",
                      background: dc.container,
                      color: dc.on,
                      fontSize: "13px",
                      fontWeight: 700,
                      padding: "6px 4px",
                      letterSpacing: "0.1px",
                      borderBottom: `2px solid color-mix(in srgb, ${dc.container} 60%, ${dc.fixed})`,
                      borderRight: `1px solid var(--md-outline-variant)`,
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
                    style={{
                      minWidth: "46px",
                      textAlign: "center",
                      fontSize: "11px",
                      fontWeight: 500,
                      padding: "4px 2px",
                      fontFamily: "var(--md-font-mono)",
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
            {teachers.map((teacher) => {
              const total = countPeriods(teacher.id);
              return (
                <tr key={teacher.id}>
                  <td
                    style={{
                      background: "var(--md-surface-container-low)",
                      fontWeight: 500,
                      color: "var(--md-on-surface)",
                      position: "sticky",
                      left: 0,
                      zIndex: 5,
                      borderRight: `1px solid var(--md-outline-variant)`,
                      fontSize: "13px",
                      fontFamily: "var(--md-font-plain)",
                      padding: "4px 8px",
                      whiteSpace: "pre-line",
                    }}
                  >
                    {teacher.name.split("(")[0].trim()}
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--md-on-surface-variant)",
                        fontWeight: 400,
                        fontFamily: "var(--md-font-mono)",
                        letterSpacing: "0.3px",
                      }}
                    >
                      {teacher.subjects.join("・")}
                    </div>
                  </td>
                  <td
                    style={{
                      textAlign: "center",
                      fontWeight: 500,
                      background:
                        total > 0
                          ? "var(--md-primary-container)"
                          : "transparent",
                      color:
                        total > 0
                          ? "var(--md-on-primary-container)"
                          : "var(--md-on-surface-variant)",
                      borderRight: `1px solid var(--md-outline-variant)`,
                      fontSize: "13px",
                      fontFamily: "var(--md-font-mono)",
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
                            style={{
                              color: "var(--md-outline-variant)",
                              textAlign: "center",
                              padding: "3px 2px",
                              fontSize: "13px",
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
                          style={{
                            background: bgColor,
                            color: textColor,
                            textAlign: "center",
                            padding: "3px 2px",
                            fontSize: "11px",
                            fontWeight: 500,
                            whiteSpace: "pre-line",
                            lineHeight: 1.3,
                            fontFamily: "var(--md-font-mono)",
                            borderRight:
                              period === PERIODS[PERIODS.length - 1]
                                ? `1px solid var(--md-outline-variant)`
                                : undefined,
                          }}
                        >
                          {isGrouped ? (
                            <>
                              <div
                                style={{ fontSize: "0.65rem", lineHeight: 1.2 }}
                              >
                                {allEntries
                                  .map((e) => classLabel(e))
                                  .join("\n")}
                              </div>
                              <div
                                style={{
                                  fontSize: "0.65rem",
                                  opacity: 0.85,
                                  fontWeight: 400,
                                }}
                              >
                                {subjectLabel(first, role)}
                              </div>
                              <div
                                style={{
                                  display: "inline-block",
                                  fontSize: "10px",
                                  background: "var(--md-secondary-container)",
                                  color: "var(--md-on-secondary-container)",
                                  borderRadius: "var(--md-shape-xs)",
                                  padding: "0 4px",
                                  fontWeight: 500,
                                }}
                              >
                                合同
                              </div>
                            </>
                          ) : (
                            <>
                              <div>{classLabel(first)}</div>
                              <div
                                style={{
                                  fontSize: "0.68rem",
                                  opacity: 0.85,
                                  fontWeight: 400,
                                }}
                              >
                                {subjectLabel(first, role)}
                              </div>
                              {first.alt_subject && (
                                <div
                                  style={{
                                    display: "inline-block",
                                    fontSize: "10px",
                                    background: isAlt
                                      ? "var(--md-tertiary-container)"
                                      : "var(--md-primary-container)",
                                    color: isAlt
                                      ? "var(--md-on-tertiary-container)"
                                      : "var(--md-on-primary-container)",
                                    borderRadius: "var(--md-shape-xs)",
                                    padding: "0 4px",
                                    fontWeight: 500,
                                    fontFamily: "var(--md-font-mono)",
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
