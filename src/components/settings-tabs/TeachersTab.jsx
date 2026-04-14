import { useState } from "react";
import { useTimetableStore } from "../../store/useTimetableStore";
import sharedStyles from "../shared.module.css";
import tabStyles from "./TeachersTab.module.css";

const DAYS = ["月", "火", "水", "木", "金"];
const PERIODS = [1, 2, 3, 4, 5, 6];

const TeachersTab = () => {
  const {
    structure,
    teachers,
    teacher_groups,
    addTeacher,
    removeTeacher,
    updateTeacher,
    addTeacherGroup,
    updateTeacherGroup,
    removeTeacherGroup,
    moveTeacherGroup,
  } = useTimetableStore();

  const [teacherName, setTeacherName] = useState("");
  const [teacherSubjsArr, setTeacherSubjsArr] = useState([]);
  const [teacherGradesArr, setTeacherGradesArr] = useState([]);
  const [expandedTeacherId, setExpandedTeacherId] = useState(null);

  const [editingTeacherId, setEditingTeacherId] = useState(null);
  const [editTeacherName, setEditTeacherName] = useState("");
  const [editTeacherSubjsArr, setEditTeacherSubjsArr] = useState([]);
  const [editTeacherGradesArr, setEditTeacherGradesArr] = useState([]);

  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupTeacherIds, setNewGroupTeacherIds] = useState([]);
  const [newGroupSubjects, setNewGroupSubjects] = useState([]);
  const [newGroupGrades, setNewGroupGrades] = useState([]);

  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editGroupName, setEditGroupName] = useState("");
  const [editGroupTeacherIds, setEditGroupTeacherIds] = useState([]);
  const [editGroupSubjects, setEditGroupSubjects] = useState([]);
  const [editGroupGrades, setEditGroupGrades] = useState([]);

  const subjectList = Array.from(
    new Set(
      Object.values(structure.required_hours).flatMap((gradeObj) =>
        Object.keys(gradeObj),
      ),
    ),
  );

  const toggleTeacherSubj = (subj) =>
    setTeacherSubjsArr((prev) =>
      prev.includes(subj) ? prev.filter((s) => s !== subj) : [...prev, subj],
    );

  const toggleTeacherGrade = (grade) =>
    setTeacherGradesArr((prev) =>
      prev.includes(grade) ? prev.filter((g) => g !== grade) : [...prev, grade],
    );

  const toggleEditSubj = (subj) =>
    setEditTeacherSubjsArr((prev) =>
      prev.includes(subj) ? prev.filter((s) => s !== subj) : [...prev, subj],
    );

  const toggleEditGrade = (grade) =>
    setEditTeacherGradesArr((prev) =>
      prev.includes(grade) ? prev.filter((g) => g !== grade) : [...prev, grade],
    );

  const startEditTeacher = (t) => {
    setEditingTeacherId(t.id);
    setEditTeacherName(t.name);
    setEditTeacherSubjsArr([...t.subjects]);
    setEditTeacherGradesArr([...t.target_grades]);
    setExpandedTeacherId(null);
  };

  const cancelEditTeacher = () => {
    setEditingTeacherId(null);
    setEditTeacherName("");
    setEditTeacherSubjsArr([]);
    setEditTeacherGradesArr([]);
  };

  const saveEditTeacher = () => {
    if (!editTeacherName.trim()) return;
    updateTeacher(editingTeacherId, {
      name: editTeacherName.trim(),
      subjects: editTeacherSubjsArr,
      target_grades: editTeacherGradesArr.length
        ? editTeacherGradesArr
        : structure.grades.map((g) => g.grade),
    });
    cancelEditTeacher();
  };

  const handleAddTeacher = () => {
    if (teacherName.trim()) {
      addTeacher({
        name: teacherName.trim(),
        subjects: teacherSubjsArr,
        target_grades: teacherGradesArr.length
          ? teacherGradesArr
          : structure.grades.map((g) => g.grade),
        unavailable_times: [],
      });
      setTeacherName("");
      setTeacherSubjsArr([]);
      setTeacherGradesArr([]);
    }
  };

  const toggleUnavailable = (teacherId, day, period) => {
    const teacher = teachers.find((t) => t.id === teacherId);
    const exists = teacher.unavailable_times.some(
      (u) => u.day_of_week === day && u.period === period,
    );
    const newTimes = exists
      ? teacher.unavailable_times.filter(
          (u) => !(u.day_of_week === day && u.period === period),
        )
      : [...teacher.unavailable_times, { day_of_week: day, period }];
    updateTeacher(teacherId, { unavailable_times: newTimes });
  };

  const isUnavailable = (teacher, day, period) =>
    teacher.unavailable_times.some(
      (u) => u.day_of_week === day && u.period === period,
    );

  const toggleGroupTeacher = (tid) =>
    setNewGroupTeacherIds((prev) =>
      prev.includes(tid) ? prev.filter((id) => id !== tid) : [...prev, tid],
    );

  const toggleGroupSubject = (s) =>
    setNewGroupSubjects((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );

  const toggleGroupGrade = (g) =>
    setNewGroupGrades((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
    );

  const handleAddGroup = () => {
    if (!newGroupName.trim() || newGroupTeacherIds.length === 0) return;
    addTeacherGroup({
      name: newGroupName.trim(),
      teacher_ids: newGroupTeacherIds,
      subjects: newGroupSubjects,
      target_grades: newGroupGrades,
    });
    setNewGroupName("");
    setNewGroupTeacherIds([]);
    setNewGroupSubjects([]);
    setNewGroupGrades([]);
  };

  const startEditGroup = (g) => {
    setEditingGroupId(g.id);
    setEditGroupName(g.name);
    setEditGroupTeacherIds([...g.teacher_ids]);
    setEditGroupSubjects([...(g.subjects || [])]);
    setEditGroupGrades([...(g.target_grades || [])]);
  };

  const cancelEditGroup = () => {
    setEditingGroupId(null);
    setEditGroupName("");
    setEditGroupTeacherIds([]);
    setEditGroupSubjects([]);
    setEditGroupGrades([]);
  };

  const saveEditGroup = () => {
    if (!editGroupName.trim() || editGroupTeacherIds.length === 0) return;
    updateTeacherGroup(editingGroupId, {
      name: editGroupName.trim(),
      teacher_ids: editGroupTeacherIds,
      subjects: editGroupSubjects,
      target_grades: editGroupGrades,
    });
    cancelEditGroup();
  };

  const toggleEditGroupTeacher = (tid) =>
    setEditGroupTeacherIds((prev) =>
      prev.includes(tid) ? prev.filter((id) => id !== tid) : [...prev, tid],
    );

  const toggleEditGroupSubject = (s) =>
    setEditGroupSubjects((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );

  const toggleEditGroupGrade = (g) =>
    setEditGroupGrades((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
    );

  return (
    <>
      <section className={sharedStyles.settingsSection}>
        <h3>教員リストの管理</h3>
        <div className={sharedStyles.infoPanel}>
          <p className="help-text help-text--no-top">
            新しい教員を登録します。
          </p>

          <div className={tabStyles.fieldRow}>
            <label htmlFor="teacherName" className={tabStyles.fieldLabel}>
              教員名
            </label>
            <input
              id="teacherName"
              type="text"
              placeholder="例: 山田"
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              className={`input-base ${tabStyles.fieldInput}`}
            />
          </div>

          <div>
            <div className={tabStyles.labelBlock}>
              担当教科
              {teacherSubjsArr.length > 0 && (
                <span className={sharedStyles.textHint}>
                  {teacherSubjsArr.join("・")}
                </span>
              )}
            </div>
            <div className={tabStyles.chipRow}>
              {subjectList.map((subj) => {
                const selected = teacherSubjsArr.includes(subj);
                return (
                  <button
                    key={subj}
                    type="button"
                    onClick={() => toggleTeacherSubj(subj)}
                    className={`${tabStyles.chipButton} ${selected ? tabStyles.chipButtonSelected : ""}`}
                  >
                    {selected && (
                      <span
                        className={`${tabStyles.chipCheck} material-symbols-outlined`}
                        style={{ fontSize: "12px" }}
                      >
                        check
                      </span>
                    )}
                    {subj}
                  </button>
                );
              })}
              {subjectList.length === 0 && (
                <span className={sharedStyles.textHint}>
                  先に教科タブで教科を登録してください
                </span>
              )}
            </div>
          </div>

          <div>
            <div className={tabStyles.labelBlock}>
              対象学年
              {teacherGradesArr.length === 0 && (
                <span className={sharedStyles.textHint}>
                  （未選択の場合は全学年）
                </span>
              )}
            </div>
            <div className={tabStyles.chipRow}>
              {structure.grades.map((g) => {
                const selected = teacherGradesArr.includes(g.grade);
                return (
                  <button
                    key={g.grade}
                    type="button"
                    onClick={() => toggleTeacherGrade(g.grade)}
                    className={`${tabStyles.chipButton} ${tabStyles.chipButtonSecondary} ${selected ? tabStyles.chipButtonSecondarySelected : ""}`}
                  >
                    {selected && (
                      <span
                        className={`${tabStyles.chipCheck} material-symbols-outlined`}
                        style={{ fontSize: "12px" }}
                      >
                        check
                      </span>
                    )}
                    {g.grade}年
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <button
              type="button"
              className={`btn-primary ${!teacherName.trim() ? sharedStyles.disabledButton : ""}`}
              onClick={handleAddTeacher}
              disabled={!teacherName.trim()}
            >
              教員を追加
            </button>
          </div>
        </div>

        <ul className={sharedStyles.rulesList}>
          {teachers.map((t) => {
            const isExpanded = expandedTeacherId === t.id;
            const isEditing = editingTeacherId === t.id;
            return (
              <li key={t.id} className={tabStyles.listCardItem}>
                {isEditing ? (
                  <div
                    className={`${tabStyles.cardBorderTight} ${isExpanded ? tabStyles.teacherCardBorderBottom : ""}`}
                  >
                    <div>
                      <label
                        htmlFor="editTeacherName"
                        className={tabStyles.labelBlock}
                      >
                        教員名
                      </label>
                      <input
                        id="editTeacherName"
                        type="text"
                        value={editTeacherName}
                        onChange={(e) => setEditTeacherName(e.target.value)}
                        className="input-base"
                      />
                    </div>

                    <div>
                      <div className={tabStyles.labelBlock}>
                        担当教科
                        {editTeacherSubjsArr.length > 0 && (
                          <span className={sharedStyles.textHint}>
                            {editTeacherSubjsArr.join("・")}
                          </span>
                        )}
                      </div>
                      <div className={tabStyles.chipRow}>
                        {subjectList.map((subj) => {
                          const selected = editTeacherSubjsArr.includes(subj);
                          return (
                            <button
                              key={subj}
                              type="button"
                              onClick={() => toggleEditSubj(subj)}
                              className={`${tabStyles.chipButton} ${selected ? tabStyles.chipButtonSelected : ""}`}
                            >
                              {selected && (
                                <span
                                  className={`${tabStyles.chipCheck} material-symbols-outlined`}
                                  style={{ fontSize: "12px" }}
                                >
                                  check
                                </span>
                              )}
                              {subj}
                            </button>
                          );
                        })}
                        {subjectList.length === 0 && (
                          <span className={sharedStyles.textHint}>
                            先に教科タブで教科を登録してください
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className={tabStyles.labelBlock}>
                        対象学年
                        {editTeacherGradesArr.length === 0 && (
                          <span className={sharedStyles.textHint}>
                            （未選択の場合は全学年）
                          </span>
                        )}
                      </div>
                      <div className={tabStyles.chipRow}>
                        {structure.grades.map((g) => {
                          const selected = editTeacherGradesArr.includes(
                            g.grade,
                          );
                          return (
                            <button
                              key={g.grade}
                              type="button"
                              onClick={() => toggleEditGrade(g.grade)}
                              className={`${tabStyles.chipButton} ${tabStyles.chipButtonSecondary} ${selected ? tabStyles.chipButtonSecondarySelected : ""}`}
                            >
                              {selected && (
                                <span
                                  className={`${tabStyles.chipCheck} material-symbols-outlined`}
                                  style={{ fontSize: "12px" }}
                                >
                                  check
                                </span>
                              )}
                              {g.grade}年
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className={sharedStyles.rowBetween}>
                      <button
                        type="button"
                        className={`btn-primary ${!editTeacherName.trim() ? sharedStyles.disabledButton : ""}`}
                        onClick={saveEditTeacher}
                        disabled={!editTeacherName.trim()}
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditTeacher}
                        className={tabStyles.btnOutline}
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={`${sharedStyles.rowBetween} ${tabStyles.clickableRow} ${isExpanded ? tabStyles.teacherHeaderExpanded : tabStyles.teacherHeaderDefault}`}
                    onClick={() =>
                      setExpandedTeacherId(isExpanded ? null : t.id)
                    }
                  >
                    <div>
                      <strong className={tabStyles.sectionTitle}>
                        {t.name}
                      </strong>
                      <span className={sharedStyles.smallText}>
                        {t.subjects.join(", ")} / {t.target_grades.join(", ")}年
                      </span>
                      {t.unavailable_times.length > 0 && (
                        <span className={tabStyles.warningText}>
                          配置不可: {t.unavailable_times.length}コマ
                        </span>
                      )}
                    </div>
                    <div className={sharedStyles.rowAlignTop}>
                      <span className={sharedStyles.smallText}>
                        {isExpanded ? "▲ 閉じる" : "▼ スケジュール設定"}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditTeacher(t);
                        }}
                        className={tabStyles.btnPrimaryOutline}
                      >
                        編集
                      </button>
                      <button
                        type="button"
                        className={`btn-danger ${tabStyles.tableSmallButton}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTeacher(t.id);
                        }}
                      >
                        削除
                      </button>
                    </div>
                  </button>
                )}

                {isExpanded && (
                  <div className={tabStyles.teacherExpandedPanel}>
                    <p className={tabStyles.teacherUnavailableNotice}>
                      配置不可な時間をクリックして設定してください（赤 =
                      配置不可）
                    </p>
                    <div className={tabStyles.tableOverflowAuto}>
                      <table className={tabStyles.teacherUnavailableTable}>
                        <thead>
                          <tr>
                            <th className={tabStyles.teacherUnavailableHeader}>
                              時限
                            </th>
                            {DAYS.map((d) => (
                              <th
                                key={d}
                                className={
                                  tabStyles.teacherUnavailableHeaderSmall
                                }
                              >
                                {d}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {PERIODS.map((p) => (
                            <tr key={p}>
                              <td
                                className={
                                  tabStyles.teacherUnavailableLabelCell
                                }
                              >
                                {p}限
                              </td>
                              {DAYS.map((d) => {
                                const unavail = isUnavailable(t, d, p);
                                return (
                                  <td key={d}>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        toggleUnavailable(t.id, d, p)
                                      }
                                      className={`${tabStyles.teacherUnavailableTimeCell} ${unavail ? tabStyles.teacherUnavailableTimeOff : tabStyles.teacherUnavailableTimeOn}`}
                                    >
                                      {unavail ? "✕" : "○"}
                                    </button>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className={tabStyles.teacherUnavailableSummary}>
                      ○ = 配置可 　 ✕ = 配置不可（出張・会議など）
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section
        className={`${sharedStyles.settingsSection} ${tabStyles.sectionSpacerTop}`}
      >
        <h3>教員グループの管理</h3>
        <p className="help-text">
          道徳・総合など複数の先生が担当する教科に使用するグループを作成します。
        </p>

        <div className={tabStyles.sectionBox}>
          <div className={sharedStyles.blockBottom}>
            <label htmlFor="newGroupName" className={tabStyles.labelBlockSmall}>
              グループ名
            </label>
            <input
              id="newGroupName"
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className={`input-base ${tabStyles.fullWidth}`}
            />
          </div>

          <div className={sharedStyles.blockBottom}>
            <div className={tabStyles.labelBlockSmall}>
              グループに追加する教員（複数選択可）
            </div>
            <div className={sharedStyles.rowWrapWide}>
              {teachers.map((t) => (
                <label
                  key={t.id}
                  className={`${sharedStyles.selectionTag} ${newGroupTeacherIds.includes(t.id) ? sharedStyles.selectionTagSelected : sharedStyles.selectionTagDefault}`}
                >
                  <input
                    type="checkbox"
                    checked={newGroupTeacherIds.includes(t.id)}
                    onChange={() => toggleGroupTeacher(t.id)}
                    className={sharedStyles.hiddenCheckbox}
                  />
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontSize: "16px",
                      verticalAlign: "middle",
                      marginRight: "4px",
                    }}
                  >
                    {newGroupTeacherIds.includes(t.id)
                      ? "check_box"
                      : "check_box_outline_blank"}
                  </span>
                  {t.name}
                </label>
              ))}
            </div>
            {newGroupTeacherIds.length > 0 && (
              <p className={tabStyles.sectionMessage}>
                {newGroupTeacherIds.length}名選択中
              </p>
            )}
          </div>

          <div className={sharedStyles.blockBottom}>
            <div className={tabStyles.labelBlockSmall}>
              担当教科（自動生成で使用）
              {newGroupSubjects.length > 0 && (
                <span className={sharedStyles.textHint}>
                  {newGroupSubjects.join("・")}
                </span>
              )}
            </div>
            <div className={sharedStyles.rowWrapNarrow}>
              {subjectList.map((s) => {
                const sel = newGroupSubjects.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleGroupSubject(s)}
                    className={`${sharedStyles.selectionTag} ${sel ? sharedStyles.selectionTagSelected : sharedStyles.selectionTagDefault}`}
                  >
                    {sel && (
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontSize: "12px",
                          verticalAlign: "middle",
                          marginRight: "2px",
                        }}
                      >
                        check
                      </span>
                    )}
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={sharedStyles.blockBottom}>
            <div className={tabStyles.labelBlockSmall}>対象学年</div>
            <div className={sharedStyles.rowWrapNarrow}>
              {structure.grades.map((g) => {
                const sel = newGroupGrades.includes(g.grade);
                return (
                  <button
                    key={g.grade}
                    type="button"
                    onClick={() => toggleGroupGrade(g.grade)}
                    className={`${sharedStyles.selectionTag} ${sel ? sharedStyles.selectionTagSelected : sharedStyles.selectionTagDefault}`}
                  >
                    {sel && (
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontSize: "12px",
                          verticalAlign: "middle",
                          marginRight: "2px",
                        }}
                      >
                        check
                      </span>
                    )}
                    {g.grade}年
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            className={`btn-primary ${!newGroupName.trim() || newGroupTeacherIds.length === 0 ? sharedStyles.disabledButton : ""}`}
            onClick={handleAddGroup}
            disabled={!newGroupName.trim() || newGroupTeacherIds.length === 0}
          >
            グループを作成
          </button>
        </div>

        {teacher_groups.length === 0 ? (
          <p className={sharedStyles.textCenterMuted}>
            グループが登録されていません
          </p>
        ) : (
          <ul className={sharedStyles.rulesList}>
            {teacher_groups.map((g, idx) => {
              const isEditing = editingGroupId === g.id;
              const memberNames = g.teacher_ids
                .map((id) => teachers.find((t) => t.id === id)?.name || id)
                .join("・");
              return (
                <li key={g.id} className={tabStyles.listCardItem}>
                  {isEditing ? (
                    <div className={tabStyles.groupEditPanel}>
                      <div className={sharedStyles.groupFormRow}>
                        <label
                          htmlFor="editGroupName"
                          className={tabStyles.groupEditHeading}
                        >
                          グループ名
                        </label>
                        <input
                          id="editGroupName"
                          type="text"
                          value={editGroupName}
                          onChange={(e) => setEditGroupName(e.target.value)}
                          className={`input-base ${tabStyles.groupEditInputFull}`}
                        />
                      </div>
                      <div className={sharedStyles.groupFormRow}>
                        <div className={tabStyles.groupEditHeading}>
                          メンバー
                        </div>
                        <div className={tabStyles.groupEditTagRow}>
                          {teachers.map((t) => (
                            <label
                              key={t.id}
                              className={`${tabStyles.groupToggleButton} ${editGroupTeacherIds.includes(t.id) ? tabStyles.groupToggleButtonSelected : ""}`}
                            >
                              <input
                                type="checkbox"
                                checked={editGroupTeacherIds.includes(t.id)}
                                onChange={() => toggleEditGroupTeacher(t.id)}
                                className={sharedStyles.hiddenCheckbox}
                              />
                              <span
                                className="material-symbols-outlined"
                                style={{
                                  fontSize: "16px",
                                  verticalAlign: "middle",
                                  marginRight: "4px",
                                }}
                              >
                                {editGroupTeacherIds.includes(t.id)
                                  ? "check_box"
                                  : "check_box_outline_blank"}
                              </span>
                              {t.name}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className={sharedStyles.groupFormRow}>
                        <div className={tabStyles.groupEditHeading}>
                          担当教科
                          {editGroupSubjects.length > 0 && (
                            <span className={sharedStyles.textHint}>
                              {editGroupSubjects.join("・")}
                            </span>
                          )}
                        </div>
                        <div className={tabStyles.groupEditTagRow}>
                          {subjectList.map((s) => {
                            const sel = editGroupSubjects.includes(s);
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => toggleEditGroupSubject(s)}
                                className={`${tabStyles.groupToggleButton} ${sel ? tabStyles.groupToggleButtonSelected : ""}`}
                              >
                                {sel && (
                                  <span
                                    className="material-symbols-outlined"
                                    style={{
                                      fontSize: "12px",
                                      verticalAlign: "middle",
                                      marginRight: "2px",
                                    }}
                                  >
                                    check
                                  </span>
                                )}
                                {s}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className={sharedStyles.groupFormRow}>
                        <div className={tabStyles.groupEditHeading}>
                          対象学年
                        </div>
                        <div className={tabStyles.groupEditTagRow}>
                          {structure.grades.map((gr) => {
                            const sel = editGroupGrades.includes(gr.grade);
                            return (
                              <button
                                key={gr.grade}
                                type="button"
                                onClick={() => toggleEditGroupGrade(gr.grade)}
                                className={`${tabStyles.groupToggleButton} ${sel ? tabStyles.groupToggleButtonSelected : ""}`}
                              >
                                {sel && (
                                  <span
                                    className="material-symbols-outlined"
                                    style={{
                                      fontSize: "12px",
                                      verticalAlign: "middle",
                                      marginRight: "2px",
                                    }}
                                  >
                                    check
                                  </span>
                                )}
                                {gr.grade}年
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className={tabStyles.groupActionRow}>
                        <button
                          type="button"
                          className={`btn-primary ${!editGroupName.trim() || editGroupTeacherIds.length === 0 ? sharedStyles.disabledButton : ""}`}
                          onClick={saveEditGroup}
                          disabled={
                            !editGroupName.trim() ||
                            editGroupTeacherIds.length === 0
                          }
                        >
                          保存
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditGroup}
                          className={tabStyles.groupActionButton}
                        >
                          キャンセル
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={tabStyles.groupCardSummary}>
                      <div className={sharedStyles.crossGradeFlexGrow}>
                        <strong className={tabStyles.groupCardTitle}>
                          <span
                            className="material-symbols-outlined"
                            style={{
                              fontSize: "14px",
                              verticalAlign: "middle",
                              marginRight: "4px",
                            }}
                          >
                            group
                          </span>
                          {g.name}
                        </strong>
                        <span className={tabStyles.groupCardSubtitle}>
                          {memberNames || "メンバーなし"}（
                          {g.teacher_ids.length}名）
                        </span>
                        {(g.subjects?.length > 0 ||
                          g.target_grades?.length > 0) && (
                          <div className={tabStyles.groupCardMeta}>
                            {g.subjects?.length > 0 && (
                              <span>教科: {g.subjects.join("・")}</span>
                            )}
                            {g.subjects?.length > 0 &&
                              g.target_grades?.length > 0 && (
                                <span className={tabStyles.groupCardDivider}>
                                  ／
                                </span>
                              )}
                            {g.target_grades?.length > 0 && (
                              <span>
                                学年:{" "}
                                {g.target_grades
                                  .map((gr) => `${gr}年`)
                                  .join("・")}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className={sharedStyles.groupControlRow}>
                        <button
                          type="button"
                          onClick={() => moveTeacherGroup(g.id, "up")}
                          disabled={idx === 0}
                          title="上へ"
                          className={`${tabStyles.groupControlButton} ${idx === 0 ? tabStyles.groupControlButtonDisabled : ""}`}
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => moveTeacherGroup(g.id, "down")}
                          disabled={idx === teacher_groups.length - 1}
                          title="下へ"
                          className={`${tabStyles.groupControlButton} ${idx === teacher_groups.length - 1 ? tabStyles.groupControlButtonDisabled : ""}`}
                        >
                          ▼
                        </button>
                        <button
                          type="button"
                          onClick={() => startEditGroup(g)}
                          className={tabStyles.groupEditButton}
                        >
                          編集
                        </button>
                        <button
                          type="button"
                          className={`btn-danger ${tabStyles.groupDeleteButtonCompact}`}
                          onClick={() => removeTeacherGroup(g.id)}
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
};

export default TeachersTab;
