import { useState } from "react";
import { useTimetableStore } from "../../store/useTimetableStore";
import styles from "./SubjectSequenceTab.module.css";

export default function SubjectSequenceTab() {
  const {
    structure,
    subject_sequences,
    addSubjectSequence,
    removeSubjectSequence,
  } = useTimetableStore();

  const allSubjects = [
    ...new Set(
      Object.values(structure.required_hours || {}).flatMap((h) =>
        Object.keys(h),
      ),
    ),
  ].sort();

  const [grade, setGrade] = useState(
    String(structure.grades?.[0]?.grade ?? "1"),
  );
  const [className, setClassName] = useState("");
  const [subjectA, setSubjectA] = useState("");
  const [subjectB, setSubjectB] = useState("");

  const gradeObj = structure.grades?.find((g) => String(g.grade) === grade);
  const classOpts = gradeObj
    ? [...(gradeObj.classes || []), ...(gradeObj.special_classes || [])]
    : [];

  const handleAdd = () => {
    if (!subjectA || !subjectB) return;
    if (subjectA === subjectB) return;
    addSubjectSequence({
      grade: Number(grade),
      class_name: className || null,
      subject_a: subjectA,
      subject_b: subjectB,
    });
    setSubjectA("");
    setSubjectB("");
  };

  return (
    <div className={styles.sequenceSection}>
      <div>
        <h3 className={styles.sequenceHeading}>連続配置ペア</h3>
        <p className={styles.sequenceDescription}>
          指定した教科Aの直後（同日の次の時限）に教科Bを配置します。自動生成時に適用されます。
        </p>

        <div className={styles.sequenceFormPanel}>
          <div className={styles.sequenceFieldGroup}>
            <span className={styles.fieldLabelHead}>学年</span>
            <select
              value={grade}
              onChange={(e) => {
                setGrade(e.target.value);
                setClassName("");
              }}
              className={styles.selectInput}
            >
              {(structure.grades || []).map((g) => (
                <option key={g.grade} value={String(g.grade)}>
                  {g.grade}年
                </option>
              ))}
            </select>
          </div>
          <div className={styles.sequenceFieldGroup}>
            <span className={styles.fieldLabelHead}>
              クラス（未選択=学年全体）
            </span>
            <select
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className={styles.selectInput}
            >
              <option value="">学年全体</option>
              {classOpts.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.sequenceFieldGroup}>
            <span className={styles.fieldLabelHead}>教科A（先に配置）</span>
            <select
              value={subjectA}
              onChange={(e) => setSubjectA(e.target.value)}
              className={styles.selectInput}
            >
              <option value="">選択</option>
              {allSubjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.sequenceArrow}>→</div>
          <div className={styles.sequenceFieldGroup}>
            <span className={styles.fieldLabelHead}>教科B（直後に配置）</span>
            <select
              value={subjectB}
              onChange={(e) => setSubjectB(e.target.value)}
              className={styles.selectInput}
            >
              <option value="">選択</option>
              {allSubjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!subjectA || !subjectB || subjectA === subjectB}
            className={`${styles.addButton} ${
              !subjectA || !subjectB || subjectA === subjectB
                ? styles.disabledButton
                : ""
            }`}
          >
            追加
          </button>
        </div>
      </div>

      {(subject_sequences || []).length === 0 ? (
        <p className={styles.sequenceEmpty}>連続配置ペアが登録されていません</p>
      ) : (
        <table className={`${styles.detailsTable} ${styles.sequenceTable}`}>
          <thead>
            <tr className={styles.tableHeaderRow}>
              <th className={styles.tableCellHeader}>学年</th>
              <th className={styles.tableCellHeader}>クラス</th>
              <th className={styles.tableCellHeader}>教科A → 教科B</th>
              <th className={styles.tableCellHeader}></th>
            </tr>
          </thead>
          <tbody>
            {(subject_sequences || []).map((seq) => (
              <tr key={seq.id} className={styles.tableRowStripe}>
                <td className={styles.tableCell}>{seq.grade}年</td>
                <td className={styles.tableCell}>
                  {seq.class_name || "学年全体"}
                </td>
                <td className={styles.tableCell}>
                  <span className={styles.sequenceAccentBlue}>
                    {seq.subject_a}
                  </span>
                  <span className={styles.sequenceArrowText}>→</span>
                  <span className={styles.sequenceAccentGreen}>
                    {seq.subject_b}
                  </span>
                  <span className={styles.sequenceHint}>（連続2コマ）</span>
                </td>
                <td className={styles.tableCell}>
                  <button
                    type="button"
                    onClick={() => removeSubjectSequence(seq.id)}
                    className={styles.deleteButton}
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
