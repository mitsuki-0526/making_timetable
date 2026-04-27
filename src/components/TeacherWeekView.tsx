import { useMemo } from "react";
import { DAYS, PERIODS } from "@/constants";
import { entryIncludesTeacher, getEntryTeacherIds } from "@/lib/teamTeaching";
import { useTimetableStore } from "@/store/useTimetableStore";

interface TeacherWeekViewProps {
  teacherId: string;
}

type CellEntry = {
  class_name: string;
  grade: number;
  subject: string;
  isTeam?: boolean;
};

export function TeacherWeekView({ teacherId }: TeacherWeekViewProps) {
  const { timetable } = useTimetableStore();

  // キーごとに複数クラスを格納する配列マップ
  const cellMap = useMemo(() => {
    const m: Record<string, CellEntry[]> = {};

    const push = (key: string, entry: CellEntry) => {
      if (!m[key]) m[key] = [];
      // 同一クラスの重複は追加しない
      const already = m[key].some(
        (c) => c.grade === entry.grade && c.class_name === entry.class_name,
      );
      if (!already) m[key].push(entry);
    };

    for (const e of timetable) {
      const key = `${e.day_of_week}-${e.period}`;
      const primaryTeamSize = getEntryTeacherIds(e, "primary").length;
      const altTeamSize = getEntryTeacherIds(e, "alt").length;

      // A週（通常）側
      if (e.subject && entryIncludesTeacher(e, teacherId, "primary")) {
        push(key, {
          class_name: e.class_name,
          grade: e.grade,
          subject: e.subject,
          isTeam: primaryTeamSize > 1,
        });
      }

      // B週（隔週）側
      if (e.alt_subject && entryIncludesTeacher(e, teacherId, "alt")) {
        push(key, {
          class_name: e.class_name,
          grade: e.grade,
          subject: e.alt_subject,
          isTeam: altTeamSize > 1,
        });
      }
    }
    return m;
  }, [timetable, teacherId]);

  return (
    <div className="ds-tt-grid" style={{ alignItems: "stretch" }}>
      <div
        className="ds-tt-head"
        style={{ background: "var(--ds-surface-3)" }}
      />
      {DAYS.map((d) => (
        <div key={d} className="ds-tt-head">
          {d}
        </div>
      ))}
      {PERIODS.map((p) => (
        <div key={p} style={{ display: "contents" }}>
          <div className="ds-tt-rowhead">{p}</div>
          {DAYS.map((d) => {
            const cells = cellMap[`${d}-${p}`];
            if (!cells || cells.length === 0) {
              return <div key={d} className="ds-tt-cell ds-empty" />;
            }
            return (
              <div
                key={d}
                className="ds-tt-cell"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: cells.length > 1 ? 3 : 0,
                  padding: cells.length > 1 ? "3px 4px" : undefined,
                }}
              >
                {cells.map((cell) => (
                  <div
                    key={`${cell.grade}-${cell.class_name}-${cell.subject}-${cell.isTeam ? "tt" : "single"}`}
                    style={
                      cells.length > 1
                        ? {
                            background:
                              "var(--ds-surface-2, var(--ds-surface))",
                            borderRadius: 3,
                            padding: "2px 4px",
                            fontSize: 11,
                          }
                        : undefined
                    }
                  >
                    <div
                      className="ds-tt-subj"
                      style={cells.length > 1 ? { fontSize: 10 } : undefined}
                    >
                      {cell.grade}-{cell.class_name}
                      {cell.isTeam && (
                        <span
                          title="TT授業"
                          style={{ marginLeft: 2, opacity: 0.6, fontSize: 9 }}
                        >
                          TT
                        </span>
                      )}
                    </div>
                    <div className="ds-tt-sub">
                      <span>{cell.subject}</span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

interface TeacherListProps {
  selectedId: string;
  onSelect: (id: string) => void;
}

export function TeacherList({ selectedId, onSelect }: TeacherListProps) {
  const { timetable, teachers } = useTimetableStore();

  const hourMap = useMemo(() => {
    // 教員ごとに「担当している時限」のキー集合を管理する
    // （同一時限に複数クラスを担当していても 1コマとしてカウント）
    const slotSets: Record<string, Set<string>> = {};

    const addSlot = (teacherId: string, slotKey: string) => {
      if (!slotSets[teacherId]) slotSets[teacherId] = new Set();
      slotSets[teacherId].add(slotKey);
    };

    for (const e of timetable) {
      const key = `${e.day_of_week}-${e.period}`;
      if (e.subject) {
        for (const teacherId of getEntryTeacherIds(e, "primary")) {
          addSlot(teacherId, key);
        }
      }
      if (e.alt_subject) {
        for (const teacherId of getEntryTeacherIds(e, "alt")) {
          addSlot(teacherId, key);
        }
      }
    }

    // Set のサイズ（ユニーク時限数）をコマ数として返す
    return Object.fromEntries(
      Object.entries(slotSets).map(([id, slots]) => [id, slots.size]),
    );
  }, [timetable]);

  return (
    <div className="ds-stack" style={{ gap: 4 }}>
      {teachers.map((t) => {
        const hours = hourMap[t.id] ?? 0;
        return (
          <button
            key={t.id}
            type="button"
            className={`ds-teacher-btn${selectedId === t.id ? " ds-active" : ""}`}
            onClick={() => onSelect(t.id)}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {t.name}
              </div>
              <div className="ds-small ds-muted">{t.subjects.join("・")}</div>
            </div>
            <div className={`ds-chip${hours === 0 ? " ds-caution" : ""}`}>
              {hours}
            </div>
          </button>
        );
      })}
    </div>
  );
}
