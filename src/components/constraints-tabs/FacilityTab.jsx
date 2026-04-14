import { useState } from "react";
import { useTimetableStore } from "../../store/useTimetableStore";
import styles from "./FacilityTab.module.css";

export default function FacilityTab() {
  const {
    structure,
    facilities,
    subject_facility,
    addFacility,
    removeFacility,
    updateSubjectFacility,
  } = useTimetableStore();
  const [newFacName, setNewFacName] = useState("");

  const allSubjects = [
    ...new Set(
      Object.values(structure.required_hours || {}).flatMap((h) =>
        Object.keys(h),
      ),
    ),
  ].sort();

  const handleAdd = () => {
    if (!newFacName.trim()) return;
    addFacility(newFacName.trim());
    setNewFacName("");
  };

  return (
    <div>
      <p className={styles.introText}>
        体育館・理科室など<strong>同時に1クラスしか使えない施設</strong>
        を登録し、教科と紐付けます。
        <br />
        ソルバーは同一時限に同じ施設を複数クラスが使用しないよう制約します。
      </p>

      <div className={styles.facilityFormRow}>
        <input
          value={newFacName}
          onChange={(e) => setNewFacName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="施設名を入力（例: 体育館）"
          maxLength={20}
          className={styles.facilityTextInput}
        />
        <button type="button" onClick={handleAdd} className={styles.addButton}>
          ＋ 追加
        </button>
      </div>

      {(facilities || []).length === 0 ? (
        <p className={styles.emptyCard}>施設が登録されていません</p>
      ) : (
        <div className={styles.facilityTagList}>
          {(facilities || []).map((fac) => (
            <div key={fac.id} className={styles.facilityTag}>
              <span className={styles.facilityTagLabel}>
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "16px", verticalAlign: "middle" }}
                >
                  school
                </span>{" "}
                {fac.name}
              </span>
              <button
                type="button"
                onClick={() => removeFacility(fac.id)}
                className={styles.facilityTagRemove}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "16px" }}
                >
                  close
                </span>
              </button>
            </div>
          ))}
        </div>
      )}

      {(facilities || []).length > 0 && (
        <div>
          <h4 className={styles.subHeading}>教科と施設の紐付け</h4>
          <table className={`${styles.detailsTable} ${styles.tableCompact}`}>
            <thead>
              <tr className={styles.tableHeaderRow}>
                <th className={styles.tableCellHeader}>教科</th>
                <th className={styles.tableCellHeader}>使用施設</th>
              </tr>
            </thead>
            <tbody>
              {allSubjects.map((subj) => (
                <tr key={subj} className={styles.tableRowStripe}>
                  <td
                    className={`${styles.tableCell} ${styles.tableCellStrong}`}
                  >
                    {subj}
                  </td>
                  <td className={styles.tableCell}>
                    <select
                      value={subject_facility?.[subj] || ""}
                      onChange={(e) =>
                        updateSubjectFacility(subj, e.target.value || null)
                      }
                      className={styles.facilitySelect}
                    >
                      <option value="">施設を使用しない</option>
                      {(facilities || []).map((fac) => (
                        <option key={fac.id} value={fac.id}>
                          {fac.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={styles.infoNoteSmall}>
            ※
            同一施設が設定された教科は、同一時限に1クラスのみ配置されます（ソルバーのハード制約）。
          </p>
        </div>
      )}
    </div>
  );
}
