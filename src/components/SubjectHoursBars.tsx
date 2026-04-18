import { useMemo } from "react";
import { useTimetableStore } from "@/store/useTimetableStore";

interface SubjectHoursBarsProps {
  grade: number;
  class_name: string;
}

export function SubjectHoursBars({ grade, class_name }: SubjectHoursBarsProps) {
  const { timetable, structure } = useTimetableStore();

  const reqKey = `${grade}_通常`;
  const reqHours: Record<string, number> =
    structure.required_hours[reqKey] ?? {};

  const actual = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of timetable) {
      if (e.grade === grade && e.class_name === class_name && e.subject) {
        counts[e.subject] = (counts[e.subject] ?? 0) + 1;
      }
    }
    return counts;
  }, [timetable, grade, class_name]);

  const subjects = Object.keys(reqHours).filter((s) => reqHours[s] > 0);

  if (subjects.length === 0) {
    return (
      <div className="ds-small ds-muted" style={{ padding: "8px 0" }}>
        規定時数が設定されていません
      </div>
    );
  }

  return (
    <div className="ds-stack ds-gap-4">
      {subjects.map((subj) => {
        const a = actual[subj] ?? 0;
        const t = reqHours[subj];
        const pct = t ? Math.min(100, (a / t) * 100) : 0;
        const status = a < t ? "warn" : a > t ? "caution" : "ok";
        return (
          <div key={subj} className="ds-bar-row">
            <div>{subj}</div>
            <div className="ds-bar-track">
              <div
                className={`ds-bar-fill ds-${status}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div
              className="ds-mono ds-small"
              style={{
                textAlign: "right",
                color:
                  status === "warn"
                    ? "var(--ds-warn-text)"
                    : status === "caution"
                      ? "var(--ds-caution-text)"
                      : "var(--ds-text)",
              }}
            >
              {a}/{t}
            </div>
          </div>
        );
      })}
    </div>
  );
}
