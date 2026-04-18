import { useMemo } from "react";
import { DAYS, PERIODS } from "@/constants";
import { useTimetableStore } from "@/store/useTimetableStore";

interface TeacherWeekViewProps {
  teacherId: string;
}

export function TeacherWeekView({ teacherId }: TeacherWeekViewProps) {
  const { timetable } = useTimetableStore();

  const cellMap = useMemo(() => {
    const m: Record<
      string,
      { class_name: string; grade: number; subject: string }
    > = {};
    for (const e of timetable) {
      if (e.teacher_id === teacherId && e.subject) {
        const key = `${e.day_of_week}-${e.period}`;
        m[key] = {
          class_name: e.class_name,
          grade: e.grade,
          subject: e.subject,
        };
      }
    }
    return m;
  }, [timetable, teacherId]);

  return (
    <div className="ds-tt-grid">
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
            const cell = cellMap[`${d}-${p}`];
            if (!cell) {
              return <div key={d} className="ds-tt-cell ds-empty" />;
            }
            return (
              <div key={d} className="ds-tt-cell">
                <div className="ds-tt-subj">
                  {cell.grade}-{cell.class_name}
                </div>
                <div className="ds-tt-sub">
                  <span>{cell.subject}</span>
                </div>
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
    const m: Record<string, number> = {};
    for (const e of timetable) {
      if (e.teacher_id && e.subject) {
        m[e.teacher_id] = (m[e.teacher_id] ?? 0) + 1;
      }
    }
    return m;
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
