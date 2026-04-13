import { useTimetableStore } from "../../store/useTimetableStore";
import styles from "./TeacherConstraintsTab.module.css";

export default function TeacherConstraintsTab() {
  const {
    teachers,
    structure,
    teacher_constraints,
    updateTeacherConstraintSettings,
  } = useTimetableStore();

  const get = (tid, key) => teacher_constraints[tid]?.[key] ?? "";
  const getBool = (tid, key) => !!teacher_constraints[tid]?.[key];

  const update = (tid, key, value) => {
    const num = value === "" ? null : parseInt(value, 10);
    updateTeacherConstraintSettings(tid, {
      [key]: Number.isNaN(num) ? null : num,
    });
  };

  const updateStr = (tid, key, value) => {
    updateTeacherConstraintSettings(tid, { [key]: value || null });
  };

  const updateBool = (tid, key) => {
    updateTeacherConstraintSettings(tid, { [key]: !getBool(tid, key) });
  };

  const gradeOptions = (structure.grades || []).map((g) => g.grade);
  const getClassOptions = (tid) => {
    const hr_grade = teacher_constraints[tid]?.homeroom_grade;
    if (!hr_grade) return [];
    const g = (structure.grades || []).find(
      (gr) => gr.grade === Number(hr_grade),
    );
    if (!g) return [];
    return [...(g.classes || []), ...(g.special_classes || [])];
  };

  return (
    <div>
      <p className={styles.introText}>
        教員ごとの授業コマ数制限・担任クラス・空きコマ集約を設定します。
      </p>
      <div className={styles.tableWrapper}>
        <table className={styles.detailsTable}>
          <thead>
            <tr className={styles.tableHeaderRow}>
              {[
                "教員名",
                "担当教科",
                "1日最大",
                "連続最大",
                "週最大",
                "担任学年",
                "担任クラス",
                "空きコマ集約",
              ].map((h) => (
                <th key={h} className={styles.tableCellHeader}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teachers.map((t) => (
              <tr key={t.id} className={styles.tableRowStripe}>
                <td className={`${styles.tableCell} ${styles.tableCellStrong}`}>
                  {t.name}
                </td>
                <td
                  className={`${styles.tableCell} ${styles.tableCellMutedSmall}`}
                >
                  {(t.subjects || []).join(", ")}
                </td>
                <td className={styles.tableCell}>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={get(t.id, "max_daily")}
                    placeholder="なし"
                    onChange={(e) => update(t.id, "max_daily", e.target.value)}
                    className={styles.smallNumberInput}
                  />
                </td>
                <td className={styles.tableCell}>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={get(t.id, "max_consecutive")}
                    placeholder="なし"
                    onChange={(e) =>
                      update(t.id, "max_consecutive", e.target.value)
                    }
                    className={styles.smallNumberInput}
                  />
                </td>
                <td className={styles.tableCell}>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={get(t.id, "max_weekly")}
                    placeholder="なし"
                    onChange={(e) => update(t.id, "max_weekly", e.target.value)}
                    className={styles.smallNumberInput}
                  />
                </td>
                <td className={styles.tableCell}>
                  <select
                    value={teacher_constraints[t.id]?.homeroom_grade ?? ""}
                    onChange={(e) =>
                      updateTeacherConstraintSettings(t.id, {
                        homeroom_grade: e.target.value
                          ? Number(e.target.value)
                          : null,
                        homeroom_class: null,
                      })
                    }
                    className={`${styles.selectInput} ${styles.smallSelect}`}
                  >
                    <option value="">なし</option>
                    {gradeOptions.map((g) => (
                      <option key={g} value={g}>
                        {g}年
                      </option>
                    ))}
                  </select>
                </td>
                <td className={styles.tableCell}>
                  <select
                    value={teacher_constraints[t.id]?.homeroom_class ?? ""}
                    onChange={(e) =>
                      updateStr(t.id, "homeroom_class", e.target.value)
                    }
                    className={`${styles.selectInput} ${styles.smallSelect}`}
                    disabled={!teacher_constraints[t.id]?.homeroom_grade}
                  >
                    <option value="">なし</option>
                    {getClassOptions(t.id).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={`${styles.tableCell} ${styles.textCenter}`}>
                  <input
                    type="checkbox"
                    checked={getBool(t.id, "consolidate_free")}
                    onChange={() => updateBool(t.id, "consolidate_free")}
                    className={styles.checkboxInput}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.notesText}>
        ※ 空欄は制限なし。担任クラス:
        そのクラスへの割り当てを優先。空きコマ集約:
        授業の合間に空き時間を作らないよう最適化。
      </p>
    </div>
  );
}
