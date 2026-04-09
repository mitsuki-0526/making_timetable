import { useState } from "react";
import { useTimetableStore } from "../store/useTimetableStore";
import styles from "./SettingsModal.module.css";

const DAYS = ["月", "火", "水", "木", "金"];
const PERIODS = [1, 2, 3, 4, 5, 6];

const SettingsModal = ({ onClose }) => {
  const {
    structure,
    settings,
    teachers,
    teacher_groups,
    subject_constraints,
    subject_pairings,
    class_groups,
    addSubject,
    removeSubject,
    updateRequiredHours,
    updateSubjectConstraint,
    addMappingRule,
    removeMappingRule,
    addClass,
    removeClass,
    addTeacher,
    removeTeacher,
    updateTeacher,
    addTeacherGroup,
    updateTeacherGroup,
    removeTeacherGroup,
    moveTeacherGroup,
    addSubjectPairing,
    removeSubjectPairing,
    addClassGroup,
    removeClassGroup,
    addSplitSubject,
    removeSplitSubject,
    addCrossGradeGroup,
    removeCrossGradeGroup,
    cross_grade_groups,
  } = useTimetableStore();
  const [activeTab, setActiveTab] = useState("subjects"); // 'subjects', 'classes', 'teachers', 'classgroups', 'pairings'

  // --- タブ1: 教科・ルール ---
  const [newSubj, setNewSubj] = useState("");
  const [mapGrade, setMapGrade] = useState("1");
  const [mapFrom, setMapFrom] = useState("");
  const [mapTo, setMapTo] = useState("");

  const hwKeys = [];
  structure.grades.forEach((g) => {
    hwKeys.push(`${g.grade}_通常`);
    if (g.special_classes && g.special_classes.length > 0) {
      hwKeys.push(`${g.grade}_特支`);
    }
  });

  const subjectList = Array.from(
    new Set(
      Object.values(structure.required_hours).flatMap((gradeObj) =>
        Object.keys(gradeObj),
      ),
    ),
  );

  const handleAddSubject = () => {
    if (newSubj.trim()) {
      addSubject(newSubj.trim());
      setNewSubj("");
    }
  };

  const handleHourChange = (key, subj, val) => {
    updateRequiredHours(key, subj, val);
  };

  const handleMaxConsecutiveChange = (subj, val) => {
    const parsed = val === "" ? null : parseInt(val, 10);
    updateSubjectConstraint(subj, Number.isNaN(parsed) ? null : parsed);
  };

  const handleAddRule = () => {
    if (mapGrade && mapFrom.trim() && mapTo.trim()) {
      addMappingRule(
        parseInt(mapGrade, 10) || mapGrade,
        mapFrom.trim(),
        mapTo.trim(),
      );
      setMapFrom("");
      setMapTo("");
    }
  };

  // --- タブ2: クラス設定 ---
  const [newClassGrade, setNewClassGrade] = useState("1");
  const [newClassName, setNewClassName] = useState("");
  const [isNewClassSpecial, setIsNewClassSpecial] = useState(false);

  const handleAddClass = () => {
    if (newClassName.trim()) {
      addClass(
        parseInt(newClassGrade, 10),
        newClassName.trim(),
        isNewClassSpecial,
      );
      setNewClassName("");
    }
  };

  // --- グループ管理 ---
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupTeacherIds, setNewGroupTeacherIds] = useState([]);
  const [newGroupSubjects, setNewGroupSubjects] = useState([]);
  const [newGroupGrades, setNewGroupGrades] = useState([]);

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

  // --- グループ編集 ---
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editGroupName, setEditGroupName] = useState("");
  const [editGroupTeacherIds, setEditGroupTeacherIds] = useState([]);
  const [editGroupSubjects, setEditGroupSubjects] = useState([]);
  const [editGroupGrades, setEditGroupGrades] = useState([]);

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

  // --- タブ: 合同クラス ---
  const [cgGrade, setCgGrade] = useState(
    String(structure.grades[0]?.grade ?? "1"),
  );
  const [cgClasses, setCgClasses] = useState([]);
  const [cgSplitSubj, setCgSplitSubj] = useState("");

  const cgGradeObj = structure.grades.find((g) => String(g.grade) === cgGrade);
  const cgAllClasses = cgGradeObj
    ? [...(cgGradeObj.classes || []), ...(cgGradeObj.special_classes || [])]
    : [];

  const toggleCgClass = (c) => {
    setCgClasses((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  };

  const handleAddClassGroup = () => {
    if (cgClasses.length < 2) return;
    addClassGroup({
      grade: parseInt(cgGrade, 10),
      classes: cgClasses,
      split_subjects: [],
    });
    setCgClasses([]);
  };

  // --- 全体合同授業 ---
  const [cgxName, setCgxName] = useState("");
  const [cgxSubject, setCgxSubject] = useState("");
  const [cgxCount, setCgxCount] = useState(1);
  const [cgxParticipants, setCgxParticipants] = useState([]);

  const toggleCgxParticipant = (grade, class_name) => {
    setCgxParticipants((prev) => {
      const exists = prev.some(
        (p) => p.grade === grade && p.class_name === class_name,
      );
      if (exists)
        return prev.filter(
          (p) => !(p.grade === grade && p.class_name === class_name),
        );
      return [...prev, { grade, class_name }];
    });
  };

  // 学年全体を一括選択/解除
  const toggleGradeAll = (gradeObj) => {
    const allClasses = [
      ...(gradeObj.classes || []),
      ...(gradeObj.special_classes || []),
    ];
    const allSelected = allClasses.every((cn) =>
      cgxParticipants.some(
        (p) => p.grade === gradeObj.grade && p.class_name === cn,
      ),
    );
    if (allSelected) {
      setCgxParticipants((prev) =>
        prev.filter((p) => p.grade !== gradeObj.grade),
      );
    } else {
      setCgxParticipants((prev) => {
        const next = prev.filter((p) => p.grade !== gradeObj.grade);
        allClasses.forEach((cn) =>
          next.push({ grade: gradeObj.grade, class_name: cn }),
        );
        return next;
      });
    }
  };

  // 全校一括選択/解除
  const toggleAllSchool = () => {
    const allParticipants = structure.grades.flatMap((g) =>
      [...(g.classes || []), ...(g.special_classes || [])].map((cn) => ({
        grade: g.grade,
        class_name: cn,
      })),
    );
    const totalCount = allParticipants.length;
    const selectedCount = allParticipants.filter((p) =>
      cgxParticipants.some(
        (c) => c.grade === p.grade && c.class_name === p.class_name,
      ),
    ).length;
    if (selectedCount === totalCount) {
      setCgxParticipants([]);
    } else {
      setCgxParticipants(allParticipants);
    }
  };

  const handleAddCrossGradeGroup = () => {
    if (cgxParticipants.length < 2 || !cgxSubject) return;
    addCrossGradeGroup({
      name: cgxName || "合同授業",
      participants: cgxParticipants,
      subject: cgxSubject,
      count: cgxCount,
    });
    setCgxName("");
    setCgxSubject("");
    setCgxCount(1);
    setCgxParticipants([]);
  };

  // --- タブ: 抱き合わせ教科 ---
  const [pairGrade, setPairGrade] = useState(
    String(structure.grades[0]?.grade ?? "1"),
  );
  const [pairClassA, setPairClassA] = useState("");
  const [pairSubjectA, setPairSubjectA] = useState("");
  const [pairClassB, setPairClassB] = useState("");
  const [pairSubjectB, setPairSubjectB] = useState("");

  const pairGradeObj = structure.grades.find(
    (g) => String(g.grade) === pairGrade,
  );
  const pairAllClasses = pairGradeObj
    ? [...(pairGradeObj.classes || []), ...(pairGradeObj.special_classes || [])]
    : [];

  const handleAddPairing = () => {
    if (!pairClassA || !pairSubjectA || !pairClassB || !pairSubjectB) return;
    if (pairClassA === pairClassB) return;
    addSubjectPairing({
      grade: parseInt(pairGrade, 10),
      classA: pairClassA,
      subjectA: pairSubjectA,
      classB: pairClassB,
      subjectB: pairSubjectB,
    });
    setPairClassA("");
    setPairSubjectA("");
    setPairClassB("");
    setPairSubjectB("");
  };

  // --- タブ3: 教員設定 ---
  const [teacherName, setTeacherName] = useState("");
  const [teacherSubjsArr, setTeacherSubjsArr] = useState([]); // 選択済み教科 (配列)
  const [teacherGradesArr, setTeacherGradesArr] = useState([]); // 選択済み学年 (配列)
  const [expandedTeacherId, setExpandedTeacherId] = useState(null);

  const toggleTeacherSubj = (subj) =>
    setTeacherSubjsArr((prev) =>
      prev.includes(subj) ? prev.filter((s) => s !== subj) : [...prev, subj],
    );

  const toggleTeacherGrade = (grade) =>
    setTeacherGradesArr((prev) =>
      prev.includes(grade) ? prev.filter((g) => g !== grade) : [...prev, grade],
    );

  // --- 教員編集 ---
  const [editingTeacherId, setEditingTeacherId] = useState(null);
  const [editTeacherName, setEditTeacherName] = useState("");
  const [editTeacherSubjsArr, setEditTeacherSubjsArr] = useState([]);
  const [editTeacherGradesArr, setEditTeacherGradesArr] = useState([]);

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

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <header className="modal-header">
          <h2>マスタ設定</h2>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className={styles.modalTabs}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === "subjects" ? styles.active : ""}`}
            onClick={() => setActiveTab("subjects")}
          >
            教科・連動ルール
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === "classes" ? styles.active : ""}`}
            onClick={() => setActiveTab("classes")}
          >
            クラス編成
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === "teachers" ? styles.active : ""}`}
            onClick={() => setActiveTab("teachers")}
          >
            教員リスト
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === "classgroups" ? styles.active : ""}`}
            onClick={() => setActiveTab("classgroups")}
          >
            合同クラス
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === "pairings" ? styles.active : ""}`}
            onClick={() => setActiveTab("pairings")}
          >
            抱き合わせ
          </button>
        </div>

        <div className={styles.modalBody}>
          {activeTab === "subjects" && (
            <>
              <section className={styles.settingsSection}>
                <h3>1. 教科の追加と規定時数・連続日数上限の設定</h3>
                <div className={styles.addSubjectRow}>
                  <input
                    type="text"
                    placeholder="新しい教科を入力"
                    value={newSubj}
                    onChange={(e) => setNewSubj(e.target.value)}
                    className="input-base"
                  />
                  <button className="btn-primary" onClick={handleAddSubject}>
                    追加
                  </button>
                </div>

                <div className={styles.hoursTableWrapper}>
                  <table className={styles.hoursTable}>
                    <thead>
                      <tr>
                        <th className={styles.tableActionCell}>操作</th>
                        <th>教科</th>
                        {hwKeys.map((k) => (
                          <th key={k}>
                            {k.replace("_通常", "年").replace("_特支", "特支")}
                          </th>
                        ))}
                        <th title="この日数以上連続して同じ教科が配置された場合に警告します。空欄は制限なし。">
                          連続上限日数
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjectList.map((subj) => (
                        <tr key={subj}>
                          <td className={styles.tableActionCell}>
                            <button
                              className={`btn-danger ${styles.tableSmallButton}`}
                              onClick={() => removeSubject(subj)}
                            >
                              削除
                            </button>
                          </td>
                          <td className={styles.tableSubjectName}>{subj}</td>
                          {hwKeys.map((k) => (
                            <td key={k}>
                              <input
                                type="number"
                                min="0"
                                className="input-small"
                                value={structure.required_hours[k]?.[subj] || 0}
                                onChange={(e) =>
                                  handleHourChange(k, subj, e.target.value)
                                }
                              />
                            </td>
                          ))}
                          <td>
                            <input
                              type="number"
                              min="1"
                              max="5"
                              placeholder="−"
                              className="input-small"
                              value={
                                subject_constraints?.[subj]
                                  ?.max_consecutive_days ?? ""
                              }
                              onChange={(e) =>
                                handleMaxConsecutiveChange(subj, e.target.value)
                              }
                              title="連続して配置できる最大日数（この日数に達したら警告）"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className={styles.settingsSection}>
                <h3>2. 特別支援学級の教科連動ルール</h3>
                <p className="help-text">
                  通常学級で左側の教科が設定された際、特別支援学級では右側の教科に自動で差し替えます。
                </p>

                <ul className={styles.rulesList}>
                  {Object.keys(settings.mappingRules).map((g) => {
                    const rules = settings.mappingRules[g];
                    return Object.entries(rules).map(([fromS, toS]) => (
                      <li key={`${g}-${fromS}`} className={styles.ruleItem}>
                        <span>
                          <strong>{g}年</strong>のルール: 通常{" "}
                          <strong>{fromS}</strong> ➡ 特支 <strong>{toS}</strong>
                        </span>
                        <button
                          className="btn-danger"
                          onClick={() => removeMappingRule(g, fromS)}
                        >
                          削除
                        </button>
                      </li>
                    ));
                  })}
                </ul>

                <div className={styles.addRuleRow}>
                  <select
                    value={mapGrade}
                    onChange={(e) => setMapGrade(e.target.value)}
                    className="input-base"
                  >
                    {structure.grades.map((g) => (
                      <option key={g.grade} value={g.grade}>
                        {g.grade}年
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="通常学級の教科"
                    value={mapFrom}
                    onChange={(e) => setMapFrom(e.target.value)}
                    className="input-base"
                  />
                  <span>➡</span>
                  <input
                    type="text"
                    placeholder="特支の教科"
                    value={mapTo}
                    onChange={(e) => setMapTo(e.target.value)}
                    className="input-base"
                  />
                  <button className="btn-primary" onClick={handleAddRule}>
                    ルール登録
                  </button>
                </div>
              </section>
            </>
          )}

          {activeTab === "classes" && (
            <section className={styles.settingsSection}>
              <h3>クラス編成の管理</h3>
              <div className={styles.infoPanel}>
                <p className="help-text help-text--no-top">
                  新しいクラスを追加します。（既存のクラスを消すと、時間割上のそのクラスのコマも消去されます）
                </p>
                <div className={`${styles.addRuleRow} ${styles.infoPanelCompact}`}>
                  <select
                    value={newClassGrade}
                    onChange={(e) => setNewClassGrade(e.target.value)}
                    className="input-base"
                  >
                    {structure.grades.map((g) => (
                      <option key={g.grade} value={g.grade}>
                        {g.grade}年
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="クラス名 (例: 3組, 特支2)"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    className="input-base"
                  />
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={isNewClassSpecial}
                      onChange={(e) => setIsNewClassSpecial(e.target.checked)}
                    />
                    特支枠として追加
                  </label>
                  <button className="btn-primary" onClick={handleAddClass}>
                    クラス追加
                  </button>
                </div>
              </div>

              <div className={styles.sectionGroup}>
                {structure.grades.map((g) => (
                  <div key={g.grade} className={styles.gradeCard}>
                    <h4 className={styles.gradeLabel}>{g.grade}年生</h4>
                    <div className={styles.badgeGroup}>
                      {g.classes.map((c) => (
                        <div key={`${g.grade}-${c}`} className={styles.badge}>
                          <span>{c}</span>
                          <button
                            type="button"
                            className={styles.badgeClose}
                            onClick={() => removeClass(g.grade, c, false)}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      {g.special_classes?.map((c) => (
                        <div
                          key={`${g.grade}-${c}`}
                          className={`${styles.badge} ${styles["badge--special"]}`}
                        >
                          <span>{c} (特支)</span>
                          <button
                            type="button"
                            className={styles.badgeClose}
                            onClick={() => removeClass(g.grade, c, true)}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab === "teachers" && (
<section className={styles.settingsSection}>
                <h3>教員リストの管理</h3>
                <div className={styles.infoPanel}>
                  <p className="help-text help-text--no-top">
                    新しい教員を登録します。
                  </p>

                  {/* 教員名 */}
                  <div className={styles.fieldRow}>
                    <label className={styles.fieldLabel}>
                      教員名
                    </label>
                    <input
                      type="text"
                      placeholder="例: 山田"
                      value={teacherName}
                      onChange={(e) => setTeacherName(e.target.value)}
                      className={`input-base ${styles.fieldInput}`}
                    />
                  </div>

                  {/* 担当教科 — チップ選択 */}
                  <div>
                    <label className={styles.labelBlock}>
                      担当教科
                      {teacherSubjsArr.length > 0 && (
                        <span className={styles.textHint}>
                          {teacherSubjsArr.join("・")}
                        </span>
                      )}
                    </label>
                    <div className={styles.chipRow}>
                      {subjectList.map((subj) => {
                        const selected = teacherSubjsArr.includes(subj);
                        return (
                          <button
                            key={subj}
                            type="button"
                            onClick={() => toggleTeacherSubj(subj)}
                            className={`${styles.chipButton} ${selected ? styles.chipButtonSelected : ""}`}
                          >
                            {selected && <span className={styles.chipCheck}>✓</span>}
                            {subj}
                          </button>
                        );
                      })}
                      {subjectList.length === 0 && (
                        <span className={styles.textHint}>
                          先に教科タブで教科を登録してください
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 対象学年 — チップ選択 */}
                  <div>
                    <label className={styles.labelBlock}>
                      対象学年
                      {teacherGradesArr.length === 0 && (
                        <span className={styles.textHint}>
                          （未選択の場合は全学年）
                        </span>
                      )}
                    </label>
                    <div className={styles.chipRow}>
                      {structure.grades.map((g) => {
                        const selected = teacherGradesArr.includes(g.grade);
                        return (
                          <button
                            key={g.grade}
                            type="button"
                            onClick={() => toggleTeacherGrade(g.grade)}
                            className={`${styles.chipButton} ${styles.chipButtonSecondary} ${selected ? styles.chipButtonSecondarySelected : ""}`}
                          >
                            {selected && <span className={styles.chipCheck}>✓</span>}
                          {g.grade}年
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <button
                    className={`btn-primary ${!teacherName.trim() ? styles.disabledButton : ""}`}
                    onClick={handleAddTeacher}
                    disabled={!teacherName.trim()}
                  >
                    教員を追加
                  </button>
                </div>
              </div>

              <ul className={styles.rulesList}>
                {teachers.map((t) => {
                  const isExpanded = expandedTeacherId === t.id;
                  const isEditing = editingTeacherId === t.id;
                  return (
                    <li key={t.id} className={styles.listCardItem}>
                      {/* 教員編集フォーム（編集中のみ表示） */}
                      {isEditing ? (
                        <div
                          className={`${styles.cardBorderTight} ${isExpanded ? styles.teacherCardBorderBottom : ""}`}
                        >
                          {/* 教員名 */}
                          <div>
                            <label className={styles.labelBlock}>
                              教員名
                            </label>
                            <input
                              type="text"
                              value={editTeacherName}
                              onChange={(e) =>
                                setEditTeacherName(e.target.value)
                              }
                              className="input-base"
                            />
                          </div>

                          {/* 担当教科 — チップ選択 */}
                          <div>
                            <label className={styles.labelBlock}>
                              担当教科
                              {editTeacherSubjsArr.length > 0 && (
                                <span className={styles.textHint}>
                                  {editTeacherSubjsArr.join("・")}
                                </span>
                              )}
                            </label>
                            <div className={styles.chipRow}>
                              {subjectList.map((subj) => {
                                const selected =
                                  editTeacherSubjsArr.includes(subj);
                                return (
                                  <button
                                    key={subj}
                                    type="button"
                                    onClick={() => toggleEditSubj(subj)}
                                    className={`${styles.chipButton} ${selected ? styles.chipButtonSelected : ""}`}
                                  >
                                    {selected && (
                                      <span className={styles.chipCheck}>
                                        ✓
                                      </span>
                                    )}
                                    {subj}
                                  </button>
                                );
                              })}
                              {subjectList.length === 0 && (
                                <span className={styles.textHint}>
                                  先に教科タブで教科を登録してください
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 対象学年 — チップ選択 */}
                          <div>
                            <label className={styles.labelBlock}>
                              対象学年
                              {editTeacherGradesArr.length === 0 && (
                                <span className={styles.textHint}>
                                  （未選択の場合は全学年）
                                </span>
                              )}
                            </label>
                            <div className={styles.chipRow}>
                              {structure.grades.map((g) => {
                                const selected = editTeacherGradesArr.includes(
                                  g.grade,
                                );
                                return (
                                  <button
                                    key={g.grade}
                                    type="button"
                                    onClick={() => toggleEditGrade(g.grade)}
                                    className={`${styles.chipButton} ${styles.chipButtonSecondary} ${selected ? styles.chipButtonSecondarySelected : ""}`}
                                  >
                                    {selected && (
                                      <span className={styles.chipCheck}>
                                        ✓
                                      </span>
                                    )}
                                    {g.grade}年
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* 保存・キャンセル */}
                          <div className={styles.rowBetween}>
                            <button
                              className={`btn-primary ${!editTeacherName.trim() ? styles.disabledButton : ""}`}
                              onClick={saveEditTeacher}
                              disabled={!editTeacherName.trim()}
                            >
                              保存
                            </button>
                            <button
                              onClick={cancelEditTeacher}
                              className={styles.btnOutline}
                            >
                              キャンセル
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* 教員ヘッダー行（通常表示） */
                        <div
                          className={`${styles.rowBetween} ${styles.clickableRow} ${isExpanded ? styles.teacherHeaderExpanded : styles.teacherHeaderDefault}`}
                          onClick={() =>
                            setExpandedTeacherId(isExpanded ? null : t.id)
                          }
                        >
                          <div>
                            <strong className={styles.sectionTitle}>
                              {t.name}
                            </strong>
                            <span className={styles.smallText}>
                              {t.subjects.join(", ")} /{" "}
                              {t.target_grades.join(", ")}年
                            </span>
                            {t.unavailable_times.length > 0 && (
                              <span className={styles.warningText}>
                                配置不可: {t.unavailable_times.length}コマ
                              </span>
                            )}
                          </div>
                          <div className={styles.rowAlignTop}>
                            <span className={styles.smallText}>
                              {isExpanded ? "▲ 閉じる" : "▼ スケジュール設定"}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditTeacher(t);
                              }}
                              className={styles.btnPrimaryOutline}
                            >
                              編集
                            </button>
                            <button
                              className={`btn-danger ${styles.tableSmallButton}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                removeTeacher(t.id);
                              }}
                            >
                              削除
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 展開時: 配置不可グリッド */}
                      {isExpanded && (
                        <div className={styles.teacherExpandedPanel}>
                          <p className={styles.teacherUnavailableNotice}>
                            配置不可な時間をクリックして設定してください（赤 =
                            配置不可）
                          </p>
                          <div className={styles.tableOverflowAuto}>
                            <table className={styles.teacherUnavailableTable}>
                              <thead>
                                <tr>
                                  <th className={styles.teacherUnavailableHeader}>
                                    時限
                                  </th>
                                  {DAYS.map((d) => (
                                    <th
                                      key={d}
                                      className={styles.teacherUnavailableHeaderSmall}
                                    >
                                      {d}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {PERIODS.map((p) => (
                                  <tr key={p}>
                                    <td className={styles.teacherUnavailableLabelCell}>
                                      {p}限
                                    </td>
                                    {DAYS.map((d) => {
                                      const unavail = isUnavailable(t, d, p);
                                      return (
                                        <td
                                          key={d}
                                          onClick={() =>
                                            toggleUnavailable(t.id, d, p)
                                          }
                                          className={`${styles.teacherUnavailableTimeCell} ${unavail ? styles.teacherUnavailableTimeOff : styles.teacherUnavailableTimeOn}`}
                                        >
                                          {unavail ? "✕" : "○"}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <p className={styles.teacherUnavailableSummary}>
                            ○ = 配置可 　 ✕ = 配置不可（出張・会議など）
                          </p>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {activeTab === "teachers" && (
            <section className={`${styles.settingsSection} ${styles.sectionSpacerTop}`}>
              <h3>教員グループの管理</h3>
              <p className="help-text">
                道徳・総合など複数の先生が担当する教科に使用するグループを作成します。
              </p>

              {/* グループ作成フォーム */}
              <div className={styles.sectionBox}>
                <div className={styles.blockBottom}>
                  <label className={styles.labelBlockSmall}>
                    グループ名
                  </label>
                  <input
                    type="text"
                    placeholder="例: 1年道徳グループ、総合担当チーム"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className={`input-base ${styles.fullWidth}`}
                  />
                </div>

                <div className={styles.blockBottom}>
                  <label className={styles.labelBlockSmall}>
                    グループに追加する教員（複数選択可）
                  </label>
                  <div className={styles.rowWrapWide}>
                    {teachers.map((t) => (
                      <label
                        key={t.id}
                        className={`${styles.selectionTag} ${newGroupTeacherIds.includes(t.id) ? styles.selectionTagSelected : styles.selectionTagDefault}`}
                      >
                        <input
                          type="checkbox"
                          checked={newGroupTeacherIds.includes(t.id)}
                          onChange={() => toggleGroupTeacher(t.id)}
                          className={styles.hiddenCheckbox}
                        />
                        {newGroupTeacherIds.includes(t.id) ? "✅" : "☐"}{" "}
                        {t.name}
                      </label>
                    ))}
                  </div>
                  {newGroupTeacherIds.length > 0 && (
                    <p className={styles.sectionMessage}>
                      {newGroupTeacherIds.length}名選択中
                    </p>
                  )}
                </div>

                {/* 担当教科 */}
                <div className={styles.blockBottom}>
                  <label className={styles.labelBlockSmall}>
                    担当教科（自動生成で使用）
                    {newGroupSubjects.length > 0 && (
                      <span className={styles.textHint}>
                        {newGroupSubjects.join("・")}
                      </span>
                    )}
                  </label>
                  <div className={styles.rowWrap}>
                    {subjectList.map((s) => {
                      const sel = newGroupSubjects.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => toggleGroupSubject(s)}
                          className={`${styles.selectionTag} ${sel ? styles.selectionTagSelected : styles.selectionTagDefault}`}
                        >
                          {sel ? "✓ " : ""}
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 対象学年 */}
                <div className={styles.blockBottom}>
                  <label className={styles.labelBlockSmall}>
                    対象学年
                  </label>
                  <div className={styles.rowWrap}>
                    {structure.grades.map((g) => {
                      const sel = newGroupGrades.includes(g.grade);
                      return (
                        <button
                          key={g.grade}
                          type="button"
                          onClick={() => toggleGroupGrade(g.grade)}
                          className={`${styles.selectionTag} ${sel ? styles.selectionTagSelected : styles.selectionTagDefault}`}
                        >
                          {sel ? "✓ " : ""}
                          {g.grade}年
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  className={`btn-primary ${!newGroupName.trim() || newGroupTeacherIds.length === 0 ? styles.disabledButton : ""}`}
                  onClick={handleAddGroup}
                  disabled={
                    !newGroupName.trim() || newGroupTeacherIds.length === 0
                  }
                >
                  グループを作成
                </button>
              </div>

              {/* 登録済みグループ一覧 */}
              {teacher_groups.length === 0 ? (
                <p className={styles.textCenterMuted}>
                  グループが登録されていません
                </p>
              ) : (
                <ul className={styles.rulesList}>
                  {teacher_groups.map((g, idx) => {
                    const isEditing = editingGroupId === g.id;
                    const memberNames = g.teacher_ids
                      .map(
                        (id) => teachers.find((t) => t.id === id)?.name || id,
                      )
                      .join("・");
                    return (
                      <li key={g.id} className={styles.listCardItem}>
                        {isEditing ? (
                          /* 編集フォーム */
                          <div className={styles.groupEditPanel}>
                            <div className={styles.groupFormRow}>
                              <label className={styles.groupEditHeading}>
                                グループ名
                              </label>
                              <input
                                type="text"
                                value={editGroupName}
                                onChange={(e) =>
                                  setEditGroupName(e.target.value)
                                }
                                className={`input-base ${styles.groupEditInputFull}`}
                              />
                            </div>
                            <div className={styles.groupFormRow}>
                              <label className={styles.groupEditHeading}>
                                メンバー
                              </label>
                              <div className={styles.groupEditTagRow}>
                                {teachers.map((t) => (
                                  <label
                                    key={t.id}
                                    className={`${styles.groupToggleButton} ${editGroupTeacherIds.includes(t.id) ? styles.groupToggleButtonSelected : ""}`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={editGroupTeacherIds.includes(
                                        t.id,
                                      )}
                                      onChange={() =>
                                        toggleEditGroupTeacher(t.id)
                                      }
                                      className={styles.hiddenCheckbox}
                                    />
                                    {editGroupTeacherIds.includes(t.id)
                                      ? "✅"
                                      : "☐"}{" "}
                                    {t.name}
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div className={styles.groupFormRow}>
                              <label className={styles.groupEditHeading}>
                                担当教科
                                {editGroupSubjects.length > 0 && (
                                  <span className={styles.textHint}>
                                    {editGroupSubjects.join("・")}
                                  </span>
                                )}
                              </label>
                              <div className={styles.groupEditTagRow}>
                                {subjectList.map((s) => {
                                  const sel = editGroupSubjects.includes(s);
                                  return (
                                    <button
                                      key={s}
                                      type="button"
                                      onClick={() => toggleEditGroupSubject(s)}
                                      className={`${styles.groupToggleButton} ${sel ? styles.groupToggleButtonSelected : ""}`}
                                    >
                                      {sel ? "✓ " : ""}
                                      {s}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div className={styles.groupFormRow}>
                              <label className={styles.groupEditHeading}>
                                対象学年
                              </label>
                              <div className={styles.groupEditTagRow}>
                                {structure.grades.map((gr) => {
                                  const sel = editGroupGrades.includes(
                                    gr.grade,
                                  );
                                  return (
                                    <button
                                      key={gr.grade}
                                      type="button"
                                      onClick={() =>
                                        toggleEditGroupGrade(gr.grade)
                                      }
                                      className={`${styles.groupToggleButton} ${sel ? styles.groupToggleButtonSelected : ""}`}
                                    >
                                      {sel ? "✓ " : ""}
                                      {gr.grade}年
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div className={styles.groupActionRow}>
                              <button
                                className={`btn-primary ${!editGroupName.trim() || editGroupTeacherIds.length === 0 ? styles.disabledButton : ""}`}
                                onClick={saveEditGroup}
                                disabled={
                                  !editGroupName.trim() ||
                                  editGroupTeacherIds.length === 0
                                }
                              >
                                保存
                              </button>
                              <button
                                onClick={cancelEditGroup}
                                className={styles.groupActionButton}
                              >
                                キャンセル
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* 通常表示 */
                          <div className={styles.groupCardSummary}>
                            <div className={styles.crossGradeFlexGrow}>
                              <strong className={styles.groupCardTitle}>
                                👥 {g.name}
                              </strong>
                              <span className={styles.groupCardSubtitle}>
                                {memberNames || "メンバーなし"}（
                                {g.teacher_ids.length}名）
                              </span>
                              {(g.subjects?.length > 0 ||
                                g.target_grades?.length > 0) && (
                                <div className={styles.groupCardMeta}>
                                  {g.subjects?.length > 0 && (
                                    <span>教科: {g.subjects.join("・")}</span>
                                  )}
                                  {g.subjects?.length > 0 &&
                                    g.target_grades?.length > 0 && (
                                      <span className={styles.groupCardDivider}>
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
                            <div className={styles.groupControlRow}>
                              {/* 並べ替えボタン */}
                              <button
                                onClick={() => moveTeacherGroup(g.id, "up")}
                                disabled={idx === 0}
                                title="上へ"
                                className={`${styles.groupControlButton} ${idx === 0 ? styles.groupControlButtonDisabled : ""}`}
                              >
                                ▲
                              </button>
                              <button
                                onClick={() => moveTeacherGroup(g.id, "down")}
                                disabled={idx === teacher_groups.length - 1}
                                title="下へ"
                                className={`${styles.groupControlButton} ${idx === teacher_groups.length - 1 ? styles.groupControlButtonDisabled : ""}`}
                              >
                                ▼
                              </button>
                              <button
                                onClick={() => startEditGroup(g)}
                                className={styles.groupEditButton}
                              >
                                編集
                              </button>
                              <button
                                className={`btn-danger ${styles.groupDeleteButtonCompact}`}
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
          )}

          {activeTab === "classgroups" && (
            <section className={styles.settingsSection}>
              <h3>合同クラスの設定</h3>
              <p className="help-text">
                同じ学年の複数クラスを合同クラスとして登録します。合同クラス内では、
                <strong>分割教科</strong>
                に登録した教科のみ別々の先生を割り当て可能で、それ以外は同一教員を重複扱いせず配置できます。
              </p>

              {/* 合同クラス作成フォーム */}
              <div className={styles.sectionBox}>
                <div className={styles.rowAlignTop}>
                  <div className={styles.rowStack}>
                    <label className={styles.labelBlockSmall}>
                      学年
                    </label>
                    <select
                      value={cgGrade}
                      onChange={(e) => {
                        setCgGrade(e.target.value);
                        setCgClasses([]);
                      }}
                      className="input-base"
                    >
                      {structure.grades.map((g) => (
                        <option key={g.grade} value={String(g.grade)}>
                          {g.grade}年
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.rowStack}>
                    <label className={styles.labelBlockSmall}>
                      合同にするクラス（2つ以上選択）
                    </label>
                    <div className={styles.rowWrap}>
                      {cgAllClasses.map((c) => (
                        <label
                          key={c}
                          className={`${styles.selectionTag} ${cgClasses.includes(c) ? styles.selectionTagSelected : styles.selectionTagDefault}`}
                        >
                          <input
                            type="checkbox"
                            checked={cgClasses.includes(c)}
                            onChange={() => toggleCgClass(c)}
                            className={styles.hiddenCheckbox}
                          />
                          {cgClasses.includes(c) ? "✅" : "☐"} {c}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  className={`btn-primary ${cgClasses.length < 2 ? styles.disabledButton : ""}`}
                  onClick={handleAddClassGroup}
                  disabled={cgClasses.length < 2}
                >
                  合同クラスを登録
                </button>
              </div>

              {/* 登録済み合同クラス一覧 */}
              {(class_groups || []).length === 0 ? (
                <p className={styles.textCenterMuted}>
                  合同クラスが登録されていません
                </p>
              ) : (
                <div className={styles.rowStack}>
                  {(class_groups || []).map((grp) => (
                    <div key={grp.id} className={styles.cardBorder}>
                      <div className={`${styles.rowBetween} ${styles.blockBottom}`}>
                        <strong>
                          {grp.grade}年：{grp.classes.join(" ・ ")} （合同）
                        </strong>
                        <button
                          className="btn-danger"
                          onClick={() => removeClassGroup(grp.id)}
                        >
                          削除
                        </button>
                      </div>
                      <div>
                        <p className={styles.sectionTitleSmall}>
                          分割教科（別々に先生を配置する教科）
                        </p>
                        <div className={`${styles.rowWrap} ${styles.groupFormRow}`}>
                          {grp.split_subjects.length === 0 && (
                            <span className={styles.textHint}>
                              なし（全教科合同）
                            </span>
                          )}
                          {grp.split_subjects.map((s) => (
                            <span key={s} className={styles.splitBadge}>
                              {s}
                              <button
                                onClick={() => removeSplitSubject(grp.id, s)}
                                className={styles.splitBadgeButton}
                              >
                                ✕
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className={styles.groupControlRow}>
                          <select
                            value={cgSplitSubj}
                            onChange={(e) => setCgSplitSubj(e.target.value)}
                            className={`input-base ${styles.growFull}`}
                          >
                            <option value="">分割教科を追加...</option>
                            {subjectList
                              .filter((s) => !grp.split_subjects.includes(s))
                              .map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                          </select>
                          <button
                            className={`btn-primary ${!cgSplitSubj ? styles.disabledButton : ""}`}
                            onClick={() => {
                              if (cgSplitSubj) {
                                addSplitSubject(grp.id, cgSplitSubj);
                                setCgSplitSubj("");
                              }
                            }}
                            disabled={!cgSplitSubj}
                          >
                            追加
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── 全体合同授業 ─────────────────────────────── */}
              <div className={styles.crossGradePanel}>
                <div className={styles.crossGradeHeader}>
                  <h3 className={styles.crossGradeSectionHeading}>
                    全体合同授業
                  </h3>
                  <span className={styles.crossGradeSectionSubtext}>
                    学年全体・全校など複数クラスが同一時限に受ける授業
                  </span>
                </div>

                {/* 登録フォーム */}
                <div className={styles.formPanel}>
                  {/* 授業名 */}
                  <div>
                    <label className={styles.crossGradeFieldLabel}>
                      授業名（任意）
                    </label>
                    <input
                      className={`input-base ${styles.crossGradeInputShort}`}
                      value={cgxName}
                      onChange={(e) => setCgxName(e.target.value)}
                      placeholder="例: 合同体育、学年集会"
                    />
                  </div>

                  {/* 教科チップ選択 */}
                  <div>
                    <label className={styles.crossGradeFieldLabel}>
                      教科
                      {cgxSubject && (
                        <span className={styles.crossGradeMetaBadgePrimary}>
                          {cgxSubject}
                        </span>
                      )}
                    </label>
                    <div className={styles.rowWrap}>
                      {subjectList.map((s) => {
                        const sel = cgxSubject === s;
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setCgxSubject(sel ? "" : s)}
                            className={`${styles.crossGradeSubjButton} ${sel ? styles.crossGradeSubjSelected : ""}`}
                          >
                            {sel && <span className={styles.smallCheck}>✓</span>}
                            {s}
                          </button>
                        );
                      })}
                      {subjectList.length === 0 && (
                        <span className={styles.textHint}>
                          先に教科タブで教科を登録してください
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 週コマ数 */}
                  <div>
                    <label className={styles.crossGradeFieldLabel}>
                      週あたりコマ数
                    </label>
                    <div className={styles.crossGradeFieldRow}>
                      <button
                        type="button"
                        onClick={() => setCgxCount((c) => Math.max(1, c - 1))}
                        className={styles.counterButton}
                      >
                        −
                      </button>
                      <span className={styles.crossGradeCountValue}>
                        {cgxCount}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCgxCount((c) => Math.min(10, c + 1))}
                        className={styles.counterButton}
                      >
                        ＋
                      </button>
                    </div>
                  </div>

                  {/* 参加クラス選択 */}
                  <div>
                    <div className={styles.crossGradeParticipantContainer}>
                      <label className={styles.crossGradeLabelText}>
                        参加クラス
                        {cgxParticipants.length > 0 && (
                          <span className={styles.crossGradeMetaBadgeSecondary}>
                            {cgxParticipants.length}クラス選択中
                          </span>
                        )}
                      </label>
                      {/* 全校一括選択ボタン */}
                      <button
                        type="button"
                        onClick={toggleAllSchool}
                        className={styles.crossGradeButtonCompact}
                      >
                        全校
                      </button>
                    </div>

                    {structure.grades.map((g) => {
                      const allClasses = [
                        ...(g.classes || []),
                        ...(g.special_classes || []),
                      ];
                      const allSel =
                        allClasses.length > 0 &&
                        allClasses.every((cn) =>
                          cgxParticipants.some(
                            (p) => p.grade === g.grade && p.class_name === cn,
                          ),
                        );
                      return (
                        <div
                          key={g.grade}
                          className={styles.crossGradeParticipantRow}
                        >
                          {/* 学年全選択ボタン */}
                          <button
                            type="button"
                            onClick={() => toggleGradeAll(g)}
                            className={`${styles.crossGradeParticipantButton} ${allSel ? styles.crossGradeParticipantPrimary : styles.crossGradeParticipantDefault}`}
                          >
                            {g.grade}年全体
                          </button>
                          <span className={styles.barSeparator}>|
                          </span>
                          {/* 個別クラス選択 */}
                          {allClasses.map((cn) => {
                            const sel = cgxParticipants.some(
                              (p) => p.grade === g.grade && p.class_name === cn,
                            );
                            const isSpecial = cn.includes("特支");
                            return (
                              <button
                                key={cn}
                                type="button"
                                onClick={() =>
                                  toggleCgxParticipant(g.grade, cn)
                                }
                                className={`${styles.crossGradeParticipantButton} ${sel ? (isSpecial ? styles.crossGradeParticipantTertiary : styles.crossGradeParticipantPrimary) : styles.crossGradeParticipantDefault}`}
                              >
                                {sel && "✓ "}
                                {g.grade}年{cn}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>

                  <button
                    className={`btn-primary ${cgxParticipants.length < 2 || !cgxSubject ? styles.disabledButton : ""} ${styles.alignSelfStart}`}
                    onClick={handleAddCrossGradeGroup}
                    disabled={cgxParticipants.length < 2 || !cgxSubject}
                  >
                    合同授業を登録
                  </button>
                </div>

                {/* 登録済み一覧 */}
                {(cross_grade_groups || []).length === 0 ? (
                  <p className={styles.textCenterMuted}>

                    合同授業が登録されていません
                  </p>
                ) : (
                  <div className={styles.rowStack}>
                    {(cross_grade_groups || []).map((grp) => (
                      <div
                        key={grp.id}
                        className={`${styles.cardBorder} ${styles.rowBetween} ${styles.crossGradeResultItem}`}
                      >
                        <div className={styles.crossGradeFlexGrow}>
                          <div className={`${styles.rowWrapWide} ${styles.blockBottom}`}>
                            <span className={styles.crossGradeGroupTitle}>
                              {grp.name}
                            </span>
                            <span className={`${styles.crossGradeMetaBadge} ${styles.crossGradeMetaBadgePrimary}`}>
                              {grp.subject}
                            </span>
                            <span className={`${styles.crossGradeMetaBadge} ${styles.crossGradeMetaBadgeSecondary}`}>
                              週{grp.count}コマ
                            </span>
                          </div>
                          <div className={styles.rowWrap}>
                            {grp.participants.map((p) => (
                              <span
                                key={`${p.grade}-${p.class_name}`}
                                className={`${styles.crossGradePartTag} ${p.class_name.includes("特支") ? styles.crossGradePartTagSpecial : styles.crossGradePartTagPrimary}`}
                              >
                                {p.grade}年{p.class_name}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button
                          className={`btn-danger ${styles.crossGradeDeleteButton}`}
                          onClick={() => removeCrossGradeGroup(grp.id)}
                        >
                          削除
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {activeTab === "pairings" && (
            <section className={styles.settingsSection}>
              <h3>抱き合わせ教科の設定</h3>
              <p className="help-text">
                同じ学年の2クラスで「AクラスにX教科を配置したとき、BクラスにY教科を自動配置」するルールを設定します。双方向に適用されます。
              </p>

              <div className={styles.pairingInfoBox}>
                <div className={styles.pairingFormGrid}>
                  <div className={styles.pairingFormField}>
                    <label className={styles.pairingFormLabel}>
                      学年
                    </label>
                    <select
                      value={pairGrade}
                      onChange={(e) => {
                        setPairGrade(e.target.value);
                        setPairClassA("");
                        setPairClassB("");
                      }}
                      className="input-base"
                    >
                      {structure.grades.map((g) => (
                        <option key={g.grade} value={String(g.grade)}>
                          {g.grade}年
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.pairingFormField}>
                    <label className={styles.pairingFormLabel}>
                      クラスA
                    </label>
                    <select
                      value={pairClassA}
                      onChange={(e) => setPairClassA(e.target.value)}
                      className="input-base"
                    >
                      <option value="">選択</option>
                      {pairAllClasses.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.pairingFormField}>
                    <label className={styles.pairingFormLabel}>
                      教科A
                    </label>
                    <select
                      value={pairSubjectA}
                      onChange={(e) => setPairSubjectA(e.target.value)}
                      className="input-base"
                    >
                      <option value="">選択</option>
                      {subjectList.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className={styles.pairingOperator}>
                    ⇔
                  </span>
                  <div className={styles.pairingFormField}>
                    <label className={styles.pairingFormLabel}>
                      クラスB
                    </label>
                    <select
                      value={pairClassB}
                      onChange={(e) => setPairClassB(e.target.value)}
                      className="input-base"
                    >
                      <option value="">選択</option>
                      {pairAllClasses
                        .filter((c) => c !== pairClassA)
                        .map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className={styles.pairingFormField}>
                    <label className={styles.pairingFormLabel}>
                      教科B
                    </label>
                    <select
                      value={pairSubjectB}
                      onChange={(e) => setPairSubjectB(e.target.value)}
                      className="input-base"
                    >
                      <option value="">選択</option>
                      {subjectList.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    className={`btn-primary ${!pairClassA || !pairSubjectA || !pairClassB || !pairSubjectB ? styles.disabledButton : ""}`}
                    onClick={handleAddPairing}
                    disabled={
                      !pairClassA ||
                      !pairSubjectA ||
                      !pairClassB ||
                      !pairSubjectB
                    }
                  >
                    登録
                  </button>
                </div>
              </div>

              {(subject_pairings || []).length === 0 ? (
                <p className={styles.pairingEmptyText}>
                  抱き合わせルールが登録されていません
                </p>
              ) : (
                <ul className={styles.rulesList}>
                  {(subject_pairings || []).map((p) => (
                    <li
                      key={p.id}
                      className={`${styles.ruleItem} ${styles.pairingRuleItem}`}
                    >
                      <span>
                        <strong>{p.grade}年</strong>：
                        <strong>{p.classA}</strong> の{" "}
                        <strong>{p.subjectA}</strong>
                        {" ⇔ "}
                        <strong>{p.classB}</strong> の{" "}
                        <strong>{p.subjectB}</strong>
                      </span>
                      <button
                        className="btn-danger"
                        onClick={() => removeSubjectPairing(p.id)}
                      >
                        削除
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
