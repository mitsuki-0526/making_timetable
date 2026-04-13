import { useState } from "react";
import { useTimetableStore } from "../../store/useTimetableStore";
import sharedStyles from "../shared.module.css";
import tabStyles from "./PairingsTab.module.css";

const PairingsTab = () => {
  const {
    structure,
    subject_pairings,
    addSubjectPairing,
    removeSubjectPairing,
  } = useTimetableStore();

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

  const subjectList = Array.from(
    new Set(
      Object.values(structure.required_hours).flatMap((gradeObj) =>
        Object.keys(gradeObj),
      ),
    ),
  );

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

  return (
    <section className={sharedStyles.settingsSection}>
      <h3>抱き合わせ教科の設定</h3>
      <p className="help-text">
        同じ学年の2クラスで「AクラスにX教科を配置したとき、BクラスにY教科を自動配置」するルールを設定します。双方向に適用されます。
      </p>

      <div className={tabStyles.pairingInfoBox}>
        <div className={tabStyles.pairingFormGrid}>
          <div className={tabStyles.pairingFormField}>
            <label htmlFor="pairGrade" className={tabStyles.pairingFormLabel}>
              学年
            </label>
            <select
              id="pairGrade"
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

          <div className={tabStyles.pairingFormField}>
            <label htmlFor="pairClassA" className={tabStyles.pairingFormLabel}>
              クラスA
            </label>
            <select
              id="pairClassA"
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

          <div className={tabStyles.pairingFormField}>
            <label
              htmlFor="pairSubjectA"
              className={tabStyles.pairingFormLabel}
            >
              教科A
            </label>
            <select
              id="pairSubjectA"
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

          <span className={tabStyles.pairingOperator}>⇔</span>

          <div className={tabStyles.pairingFormField}>
            <label htmlFor="pairClassB" className={tabStyles.pairingFormLabel}>
              クラスB
            </label>
            <select
              id="pairClassB"
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

          <div className={tabStyles.pairingFormField}>
            <label
              htmlFor="pairSubjectB"
              className={tabStyles.pairingFormLabel}
            >
              教科B
            </label>
            <select
              id="pairSubjectB"
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
            type="button"
            className={`btn-primary ${!pairClassA || !pairSubjectA || !pairClassB || !pairSubjectB ? sharedStyles.disabledButton : ""}`}
            onClick={handleAddPairing}
            disabled={
              !pairClassA || !pairSubjectA || !pairClassB || !pairSubjectB
            }
          >
            登録
          </button>
        </div>
      </div>

      {subject_pairings.length === 0 ? (
        <p className={tabStyles.pairingEmptyText}>
          抱き合わせルールが登録されていません
        </p>
      ) : (
        <ul className={sharedStyles.rulesList}>
          {subject_pairings.map((p) => (
            <li
              key={p.id}
              className={`${sharedStyles.ruleItem} ${tabStyles.pairingRuleItem}`}
            >
              <span>
                <strong>{p.grade}年</strong>：<strong>{p.classA}</strong> の{" "}
                <strong>{p.subjectA}</strong>
                {" ⇔ "}
                <strong>{p.classB}</strong> の <strong>{p.subjectB}</strong>
              </span>
              <button
                type="button"
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
  );
};

export default PairingsTab;
