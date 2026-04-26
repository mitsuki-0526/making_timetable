import { useMemo } from "react";
import {
  getEntryTeacherIds,
  getEntryTeacherLabel,
  getTeacherNamesByIds,
} from "@/lib/teamTeaching";
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
  selectedCells: SelectedCell[];
  onClear: () => void;
  onClearSelectedCells: () => void;
}

export function Inspector({
  selection,
  selectedCells,
  onClear,
  onClearSelectedCells,
}: InspectorProps) {
  const {
    getEntry,
    getAvailableTeachers,
    setTimetableEntry,
    setTimetableTeacher,
    setAltEntry,
    setEntryGroup,
    groupCells,
    ungroupCells,
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
  const subject = entry?.subject ?? null;
  const altSubject = entry?.alt_subject ?? null;
  const availableTeachersMain = getAvailableTeachers(
    day_of_week,
    period,
    grade,
    class_name,
    subject,
  );
  const availableTeachersAlt = getAvailableTeachers(
    day_of_week,
    period,
    grade,
    class_name,
    altSubject,
  );
  const currentGroup = entry?.teacher_group_id
    ? teacher_groups.find((group) => group.id === entry.teacher_group_id)
    : undefined;
  const filteredGroups = teacher_groups.filter((group) => {
    const subjectOk =
      !subject || !group.subjects?.length || group.subjects.includes(subject);
    const gradeOk =
      !group.target_grades?.length || group.target_grades.includes(grade);
    return subjectOk && gradeOk;
  });
  const groupCandidates =
    currentGroup &&
    !filteredGroups.some((group) => group.id === currentGroup.id)
      ? [currentGroup, ...filteredGroups]
      : filteredGroups;
  const altCurrentGroup = entry?.alt_teacher_group_id
    ? teacher_groups.find((group) => group.id === entry.alt_teacher_group_id)
    : undefined;
  const altFilteredGroups = teacher_groups.filter((group) => {
    const subjectOk =
      !entry?.alt_subject ||
      !group.subjects?.length ||
      group.subjects.includes(entry.alt_subject as string);
    const gradeOk =
      !group.target_grades?.length || group.target_grades.includes(grade);
    return subjectOk && gradeOk;
  });
  const altGroupCandidates =
    altCurrentGroup &&
    !altFilteredGroups.some((group) => group.id === altCurrentGroup.id)
      ? [altCurrentGroup, ...altFilteredGroups]
      : altFilteredGroups;
  const altSubjectOptions = (() => {
    const options = new Set(allSubjects);
    if (entry?.alt_subject) {
      options.add(entry.alt_subject);
    }
    return Array.from(options).sort();
  })();

  const selectedCount = selectedCells.length;

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

  const handleAltSubjectChange = (subject: string) => {
    setAltEntry(
      day_of_week,
      period,
      grade,
      class_name,
      subject || null,
      subject ? (entry?.alt_teacher_id ?? null) : null,
      entry?.alt_teacher_group_id ?? null,
    );
  };

  const handleAltTeacherChange = (teacherId: string) => {
    setAltEntry(
      day_of_week,
      period,
      grade,
      class_name,
      entry?.alt_subject ?? null,
      teacherId || null,
      entry?.alt_teacher_group_id ?? null,
    );
  };

  const handleAltGroupChange = (groupId: string) => {
    setAltEntry(
      day_of_week,
      period,
      grade,
      class_name,
      entry?.alt_subject ?? null,
      null,
      groupId || null,
    );
  };

  const handleTeacherGroupChange = (groupId: string) => {
    setEntryGroup(day_of_week, period, grade, class_name, groupId || null);
  };

  const handleGroupSelectedCells = () => {
    if (selectedCount < 2) return;
    groupCells(
      selectedCells.map((cell) => ({
        grade: cell.grade,
        class_name: cell.class_name,
        day_of_week: cell.day_of_week,
        period: cell.period,
      })),
    );
    onClearSelectedCells();
  };

  const handleUngroupCurrentCell = () => {
    if (!entry?.cell_group_id) return;
    ungroupCells(entry.cell_group_id);
    onClearSelectedCells();
  };

  const tGroup = entry?.teacher_group_id
    ? teacher_groups.find((g) => g.id === entry.teacher_group_id)
    : undefined;
  const primaryTeamNames = entry
    ? getTeacherNamesByIds(getEntryTeacherIds(entry, teacher_groups), teachers)
    : [];
  const primaryTeacherLabel = entry
    ? getEntryTeacherLabel(entry, teachers, teacher_groups)
    : null;
  const altTeamNames = entry
    ? getTeacherNamesByIds(
        getEntryTeacherIds(entry, teacher_groups, "alt"),
        teachers,
      )
    : [];
  const altTeacherLabel = entry
    ? getEntryTeacherLabel(entry, teachers, teacher_groups, "alt")
    : null;

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
          {entry?.teacher_group_id || primaryTeamNames.length > 1 ? (
            <div style={{ fontSize: 12.5, color: "var(--ds-text)" }}>
              {primaryTeacherLabel ?? tGroup?.name ?? "(未割当)"}
              {primaryTeamNames.length > 1 ? "（TT）" : "（グループ）"}
            </div>
          ) : (
            <select
              value={entry?.teacher_id ?? ""}
              onChange={(e) => handleTeacherChange(e.target.value)}
            >
              <option value="">(未割当)</option>
              {availableTeachersMain.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
              {entry?.teacher_id &&
                !availableTeachersMain.find(
                  (t) => t.id === entry.teacher_id,
                ) && (
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

      <div className="ds-row">
        <div className="ds-k">グループ担当</div>
        <div className="ds-v">
          <select
            value={entry?.teacher_group_id ?? ""}
            onChange={(e) => handleTeacherGroupChange(e.target.value)}
            disabled={!entry?.subject}
          >
            <option value="">(個別担当)</option>
            {groupCandidates.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          {entry?.teacher_group_id && tGroup && (
            <div className="ds-small ds-muted" style={{ marginTop: 6 }}>
              {(primaryTeamNames.length > 0
                ? primaryTeamNames
                : tGroup.teacher_ids.map(
                    (teacherId) =>
                      teachers.find((teacher) => teacher.id === teacherId)
                        ?.name ?? teacherId,
                  )
              ).join("・")}
            </div>
          )}
        </div>
      </div>

      {primaryTeamNames.length > 1 && (
        <div className="ds-row">
          <div className="ds-k">TT参加</div>
          <div className="ds-v">
            <div className="ds-small ds-muted">{primaryTeamNames.join("・")}</div>
          </div>
        </div>
      )}

      <div className="ds-row">
        <div className="ds-k">B週教科</div>
        <div className="ds-v">
          <select
            value={entry?.alt_subject ?? ""}
            onChange={(e) => handleAltSubjectChange(e.target.value)}
            disabled={!entry?.subject}
          >
            <option value="">(設定しない)</option>
            {altSubjectOptions.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="ds-row">
        <div className="ds-k">B週担当</div>
        <div className="ds-v">
          {entry?.alt_teacher_group_id || altTeamNames.length > 1 ? (
            <div style={{ fontSize: 12.5, color: "var(--ds-text)" }}>
              {altTeacherLabel ?? "(未割当)"}
              {altTeamNames.length > 1 ? "（TT）" : "（グループ）"}
            </div>
          ) : (
            <select
              value={entry?.alt_teacher_id ?? ""}
              onChange={(e) => handleAltTeacherChange(e.target.value)}
              disabled={!entry?.subject || !entry?.alt_subject}
            >
              <option value="">(未割当)</option>
              {availableTeachersAlt.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </option>
              ))}
              {entry?.alt_teacher_id &&
                !availableTeachersAlt.find(
                  (teacher) => teacher.id === entry.alt_teacher_id,
                ) && (
                  <option value={entry.alt_teacher_id}>
                    {teachers.find(
                      (teacher) => teacher.id === entry.alt_teacher_id,
                    )?.name ?? entry.alt_teacher_id}{" "}
                    (現在)
                  </option>
                )}
            </select>
          )}
        </div>
      </div>

      <div className="ds-row">
        <div className="ds-k">B週グループ担当</div>
        <div className="ds-v">
          <select
            value={entry?.alt_teacher_group_id ?? ""}
            onChange={(e) => handleAltGroupChange(e.target.value)}
            disabled={!entry?.subject || !entry?.alt_subject}
          >
            <option value="">(個別担当)</option>
            {altGroupCandidates.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          {entry?.alt_teacher_group_id && altCurrentGroup && (
            <div className="ds-small ds-muted" style={{ marginTop: 6 }}>
              {(altTeamNames.length > 0
                ? altTeamNames
                : altCurrentGroup.teacher_ids.map(
                    (teacherId) =>
                      teachers.find((teacher) => teacher.id === teacherId)
                        ?.name ?? teacherId,
                  )
              ).join("・")}
            </div>
          )}
        </div>
      </div>

      {altTeamNames.length > 1 && (
        <div className="ds-row">
          <div className="ds-k">B週TT参加</div>
          <div className="ds-v">
            <div className="ds-small ds-muted">{altTeamNames.join("・")}</div>
          </div>
        </div>
      )}

      <div className="ds-row">
        <div className="ds-k">セルグループ</div>
        <div className="ds-v">
          <div className="ds-small ds-muted" style={{ marginBottom: 8 }}>
            {selectedCount > 1
              ? `${selectedCount}セル選択中。Ctrl/Cmd+クリックで追加選択できます。`
              : entry?.cell_group_id
                ? "このセルは合同コマに含まれています。"
                : "Ctrl/Cmd+クリックで複数セルを選ぶと合同コマにできます。"}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="ds-btn ds-btn-sm"
              onClick={handleGroupSelectedCells}
              disabled={selectedCount < 2}
            >
              選択中セルをグループ化
            </button>
            <button
              type="button"
              className="ds-btn ds-btn-sm ds-btn-ghost"
              onClick={onClearSelectedCells}
              disabled={selectedCount < 2}
            >
              複数選択を解除
            </button>
            <button
              type="button"
              className="ds-btn ds-btn-sm ds-btn-ghost"
              onClick={handleUngroupCurrentCell}
              disabled={!entry?.cell_group_id}
            >
              現在セルのグループ解除
            </button>
          </div>
        </div>
      </div>

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
