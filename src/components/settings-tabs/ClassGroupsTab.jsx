import { useState } from "react";
import { useTimetableStore } from "../../store/useTimetableStore";
import sharedStyles from "../shared.module.css";
import tabStyles from "./ClassGroupsTab.module.css";

const ClassGroupsTab = () => {
  const {
    structure,
    class_groups,
    cross_grade_groups,
    addClassGroup,
    removeClassGroup,
    addSplitSubject,
    removeSplitSubject,
    addCrossGradeGroup,
    removeCrossGradeGroup,
  } = useTimetableStore();

  const [cgGrade, setCgGrade] = useState(
    String(structure.grades[0]?.grade ?? "1"),
  );
  const [cgClasses, setCgClasses] = useState([]);
  const [cgSplitSubj, setCgSplitSubj] = useState("");
  const [cgxName, setCgxName] = useState("");
  const [cgxSubject, setCgxSubject] = useState("");
  const [cgxCount, setCgxCount] = useState(1);
  const [cgxParticipants, setCgxParticipants] = useState([]);

  const cgGradeObj = structure.grades.find((g) => String(g.grade) === cgGrade);
  const cgAllClasses = cgGradeObj
    ? [...(cgGradeObj.classes || []), ...(cgGradeObj.special_classes || [])]
    : [];

  const subjectList = Array.from(
    new Set(
      Object.values(structure.required_hours).flatMap((gradeObj) =>
        Object.keys(gradeObj),
      ),
    ),
  );

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
      setCgxParticipants((prev) => [
        ...prev.filter((p) => p.grade !== gradeObj.grade),
        ...allClasses.map((cn) => ({
          grade: gradeObj.grade,
          class_name: cn,
        })),
      ]);
    }
  };

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

  return (
    <section className={sharedStyles.settingsSection}>
      <h3>合同クラスの設定</h3>
      <p className="help-text">
        同じ学年の複数クラスを合同クラスとして登録します。合同クラス内では、
        <strong>分割教科</strong>
        に登録した教科のみ別々の先生を割り当て可能で、それ以外は同一教員を重複扱いせず配置できます。
      </p>

      <div className={tabStyles.sectionBox}>
        <div className={sharedStyles.rowAlignTop}>
          <div className={tabStyles.rowStack}>
            <label htmlFor="cgGrade" className={tabStyles.labelBlockSmall}>
              学年
            </label>
            <select
              id="cgGrade"
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
          <div className={tabStyles.rowStack}>
            <div className={tabStyles.labelBlockSmall}>
              合同にするクラス（2つ以上選択）
            </div>
            <div className={sharedStyles.rowWrapNarrow}>
              {cgAllClasses.map((c) => (
                <label
                  key={c}
                  className={`${sharedStyles.selectionTag} ${cgClasses.includes(c) ? sharedStyles.selectionTagSelected : sharedStyles.selectionTagDefault}`}
                >
                  <input
                    type="checkbox"
                    checked={cgClasses.includes(c)}
                    onChange={() => toggleCgClass(c)}
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
                    {cgClasses.includes(c)
                      ? "check_box"
                      : "check_box_outline_blank"}
                  </span>
                  {c}
                </label>
              ))}
            </div>
          </div>
        </div>
        <button
          type="button"
          className={`btn-primary ${cgClasses.length < 2 ? sharedStyles.disabledButton : ""}`}
          onClick={handleAddClassGroup}
          disabled={cgClasses.length < 2}
        >
          合同クラスを登録
        </button>
      </div>

      {class_groups.length === 0 ? (
        <p className={sharedStyles.textCenterMuted}>
          合同クラスが登録されていません
        </p>
      ) : (
        <div className={tabStyles.rowStack}>
          {class_groups.map((grp) => (
            <div key={grp.id} className={tabStyles.cardBorder}>
              <div
                className={`${sharedStyles.rowBetween} ${sharedStyles.blockBottom}`}
              >
                <strong>
                  {grp.grade}年：{grp.classes.join(" ・ ")} （合同）
                </strong>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => removeClassGroup(grp.id)}
                >
                  削除
                </button>
              </div>
              <div>
                <p className={tabStyles.sectionTitleSmall}>
                  分割教科（別々に先生を配置する教科）
                </p>
                <div
                  className={`${sharedStyles.rowWrapNarrow} ${sharedStyles.groupFormRow}`}
                >
                  {grp.split_subjects.length === 0 ? (
                    <span className={sharedStyles.textHint}>
                      なし（全教科合同）
                    </span>
                  ) : (
                    grp.split_subjects.map((s) => (
                      <span key={s} className={tabStyles.splitBadge}>
                        {s}
                        <button
                          type="button"
                          onClick={() => removeSplitSubject(grp.id, s)}
                          className={tabStyles.splitBadgeButton}
                        >
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: "14px" }}
                          >
                            close
                          </span>
                        </button>
                      </span>
                    ))
                  )}
                </div>
                <div className={sharedStyles.groupControlRow}>
                  <select
                    value={cgSplitSubj}
                    onChange={(e) => setCgSplitSubj(e.target.value)}
                    className={`input-base ${tabStyles.growFull}`}
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
                    type="button"
                    className={`btn-primary ${!cgSplitSubj ? sharedStyles.disabledButton : ""}`}
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

      <div className={tabStyles.crossGradePanel}>
        <div className={tabStyles.crossGradeHeader}>
          <h3 className={tabStyles.crossGradeSectionHeading}>全体合同授業</h3>
          <span className={tabStyles.crossGradeSectionSubtext}>
            学年全体・全校など複数クラスが同一時限に受ける授業
          </span>
        </div>

        <div className={tabStyles.formPanel}>
          <div>
            <label htmlFor="cgxName" className={tabStyles.crossGradeFieldLabel}>
              授業名（任意）
            </label>
            <input
              id="cgxName"
              type="text"
              className={`input-base ${tabStyles.crossGradeInputShort}`}
              value={cgxName}
              onChange={(e) => setCgxName(e.target.value)}
              placeholder="例: 合同体育、学年集会"
            />
          </div>

          <div>
            <div className={tabStyles.crossGradeFieldLabel}>
              教科
              {cgxSubject && (
                <span className={tabStyles.crossGradeMetaBadgePrimary}>
                  {cgxSubject}
                </span>
              )}
            </div>
            <div className={sharedStyles.rowWrapNarrow}>
              {subjectList.map((s) => {
                const sel = cgxSubject === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setCgxSubject(sel ? "" : s)}
                    className={`${tabStyles.crossGradeSubjButton} ${sel ? tabStyles.crossGradeSubjSelected : ""}`}
                  >
                    {sel && (
                      <span
                        className={`${tabStyles.smallCheck} material-symbols-outlined`}
                        style={{ fontSize: "12px" }}
                      >
                        check
                      </span>
                    )}
                    {s}
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
            <div className={tabStyles.crossGradeFieldLabel}>週あたりコマ数</div>
            <div className={tabStyles.crossGradeFieldRow}>
              <button
                type="button"
                onClick={() => setCgxCount((c) => Math.max(1, c - 1))}
                className={tabStyles.counterButton}
              >
                −
              </button>
              <span className={tabStyles.crossGradeCountValue}>{cgxCount}</span>
              <button
                type="button"
                onClick={() => setCgxCount((c) => Math.min(10, c + 1))}
                className={tabStyles.counterButton}
              >
                ＋
              </button>
            </div>
          </div>

          <div>
            <div className={tabStyles.crossGradeParticipantContainer}>
              <div className={tabStyles.crossGradeLabelText}>
                参加クラス
                {cgxParticipants.length > 0 && (
                  <span className={tabStyles.crossGradeMetaBadgeSecondary}>
                    {cgxParticipants.length}クラス選択中
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={toggleAllSchool}
                className={tabStyles.crossGradeButtonCompact}
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
                  className={tabStyles.crossGradeParticipantRow}
                >
                  <button
                    type="button"
                    onClick={() => toggleGradeAll(g)}
                    className={`${tabStyles.crossGradeParticipantButton} ${allSel ? tabStyles.crossGradeParticipantPrimary : tabStyles.crossGradeParticipantDefault}`}
                  >
                    {g.grade}年全体
                  </button>
                  <span className={tabStyles.barSeparator}>|</span>
                  {allClasses.map((cn) => {
                    const sel = cgxParticipants.some(
                      (p) => p.grade === g.grade && p.class_name === cn,
                    );
                    const isSpecial = cn.includes("特支");
                    return (
                      <button
                        key={cn}
                        type="button"
                        onClick={() => toggleCgxParticipant(g.grade, cn)}
                        className={`${tabStyles.crossGradeParticipantButton} ${sel ? (isSpecial ? tabStyles.crossGradeParticipantTertiary : tabStyles.crossGradeParticipantPrimary) : tabStyles.crossGradeParticipantDefault}`}
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
                        {g.grade}年{cn}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className={`btn-primary ${cgxParticipants.length < 2 || !cgxSubject ? sharedStyles.disabledButton : ""} ${tabStyles.alignSelfStart}`}
            onClick={handleAddCrossGradeGroup}
            disabled={cgxParticipants.length < 2 || !cgxSubject}
          >
            合同授業を登録
          </button>
        </div>

        {cross_grade_groups.length === 0 ? (
          <p className={sharedStyles.textCenterMuted}>
            合同授業が登録されていません
          </p>
        ) : (
          <div className={tabStyles.rowStack}>
            {cross_grade_groups.map((grp) => (
              <div
                key={grp.id}
                className={`${tabStyles.cardBorder} ${sharedStyles.rowBetween} ${tabStyles.crossGradeResultItem}`}
              >
                <div className={sharedStyles.crossGradeFlexGrow}>
                  <div
                    className={`${sharedStyles.rowWrapWide} ${sharedStyles.blockBottom}`}
                  >
                    <span className={tabStyles.crossGradeGroupTitle}>
                      {grp.name}
                    </span>
                    <span
                      className={`${tabStyles.crossGradeMetaBadge} ${tabStyles.crossGradeMetaBadgePrimary}`}
                    >
                      {grp.subject}
                    </span>
                    <span
                      className={`${tabStyles.crossGradeMetaBadge} ${tabStyles.crossGradeMetaBadgeSecondary}`}
                    >
                      週{grp.count}コマ
                    </span>
                  </div>
                  <div className={sharedStyles.rowWrapNarrow}>
                    {grp.participants.map((p) => (
                      <span
                        key={`${p.grade}-${p.class_name}`}
                        className={`${tabStyles.crossGradePartTag} ${p.class_name.includes("特支") ? tabStyles.crossGradePartTagSpecial : tabStyles.crossGradePartTagPrimary}`}
                      >
                        {p.grade}年{p.class_name}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  className={`btn-danger ${tabStyles.crossGradeDeleteButton}`}
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
  );
};

export default ClassGroupsTab;
