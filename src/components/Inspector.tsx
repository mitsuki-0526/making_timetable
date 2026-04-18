import { useMemo } from "react";
import { useTimetableStore } from "@/store/useTimetableStore";
import type { DayOfWeek, Period } from "@/types";

interface SelectedCell {
  grade: number;
  class_name: string;
  day_of_week: DayOfWeek;
  period: Period;
}

interface InspectorProps {
  selection: SelectedCell | null;
  onClear: () => void;
}

export function Inspector({ selection, onClear }: InspectorProps) {
  const {
    getEntry,
    getAvailableTeachers,
    setTimetableEntry,
    setTimetableTeacher,
    structure,
  } = useTimetableStore();
  const teachers = useTimetableStore((s) => s.teachers);
  const teacher_groups = useTimetableStore((s) => s.teacher_groups);

  const allSubjects = useMemo(() => {
    const subjs = new Set<string>();
    for (const g of structure.grades) {
      const reqKey = `${g.grade}_通常`;
      const req = structure.required_hours[reqKey] ?? {};
      for (const s of Object.keys(req)) subjs.add(s);
    }
    return Array.from(subjs).sort();
  }, [structure]);

  if (!selection) {
    return (
      <div
        className="ds-small ds-muted"
        style={{ textAlign: "center", padding: "32px 14px" }}
      >
        セルを選択すると
        <br />
        詳細がここに表示されます
      </div>
    );
  }

  const { grade, class_name, day_of_week, period } = selection;
  const entry = getEntry(day_of_week, period, grade, class_name);
  const availableTeachers = getAvailableTeachers(
    day_of_week,
    period,
    grade,
    class_name,
  );

  const handleSubjectChange = (subject: string) => {
    setTimetableEntry(
      day_of_week,
      period,
      grade,
      class_name,
      entry?.teacher_id ?? null,
      subject || null,
    );
  };

  const handleTeacherChange = (teacherId: string) => {
    setTimetableTeacher(
      day_of_week,
      period,
      grade,
      class_name,
      teacherId || null,
    );
  };

  const handleClear = () => {
    setTimetableEntry(day_of_week, period, grade, class_name, null, null);
  };

  const tGroup = entry?.teacher_group_id
    ? teacher_groups.find((g) => g.id === entry.teacher_group_id)
    : undefined;

  return (
    <div className="ds-inspector">
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 6,
          color: "var(--ds-text)",
        }}
      >
        {grade}-{class_name} / {day_of_week} {period}限
      </div>

      <div className="ds-row">
        <div className="ds-k">教科</div>
        <div className="ds-v">
          <select
            value={entry?.subject ?? ""}
            onChange={(e) => handleSubjectChange(e.target.value)}
          >
            <option value="">(空き)</option>
            {allSubjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="ds-row">
        <div className="ds-k">担当</div>
        <div className="ds-v">
          {tGroup ? (
            <div style={{ fontSize: 12.5, color: "var(--ds-text)" }}>
              {tGroup.name}（グループ）
            </div>
          ) : (
            <select
              value={entry?.teacher_id ?? ""}
              onChange={(e) => handleTeacherChange(e.target.value)}
            >
              <option value="">(未割当)</option>
              {availableTeachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
              {entry?.teacher_id &&
                !availableTeachers.find((t) => t.id === entry.teacher_id) && (
                  <option value={entry.teacher_id}>
                    {teachers.find((t) => t.id === entry.teacher_id)?.name ??
                      entry.teacher_id}{" "}
                    (現在)
                  </option>
                )}
            </select>
          )}
        </div>
      </div>

      {entry?.alt_subject && (
        <div className="ds-row">
          <div className="ds-k">B週教科</div>
          <div className="ds-v" style={{ fontSize: 12 }}>
            {entry.alt_subject}
            {entry.alt_teacher_id && (
              <span className="ds-muted">
                {" "}
                / {teachers.find((t) => t.id === entry.alt_teacher_id)?.name}
              </span>
            )}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          type="button"
          className="ds-btn ds-btn-sm"
          onClick={handleClear}
          disabled={!entry?.subject}
        >
          空きに戻す
        </button>
        <button
          type="button"
          className="ds-btn ds-btn-sm ds-btn-ghost"
          onClick={onClear}
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
