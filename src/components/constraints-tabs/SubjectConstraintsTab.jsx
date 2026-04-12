import { useTimetableStore } from "../../store/useTimetableStore";
import styles from "./SubjectConstraintsTab.module.css";

const PERIODS = [1, 2, 3, 4, 5, 6];

export default function SubjectConstraintsTab() {
  const { structure, settings, subject_placement, updateSubjectPlacement } =
    useTimetableStore();
  const lunchAfter = settings.lunch_after_period ?? 4;

  const allSubjects = [
    ...new Set(
      Object.values(structure.required_hours || {}).flatMap((h) =>
        Object.keys(h),
      ),
    ),
  ].sort();

  const get = (subj, key) => subject_placement[subj]?.[key];

  const updateNum = (subj, key, value) => {
    const num = value === "" ? null : parseInt(value, 10);
    updateSubjectPlacement(subj, { [key]: Number.isNaN(num) ? null : num });
  };

  const togglePeriod = (subj, period) => {
    const current = get(subj, "allowed_periods") || [];
    const next = current.includes(period)
      ? current.filter((p) => p !== period)
      : [...current, period].sort((a, b) => a - b);
    updateSubjectPlacement(subj, { allowed_periods: next });
  };

  const toggle = (subj, key) => {
    updateSubjectPlacement(subj, { [key]: !get(subj, key) });
  };

  return (
    <div>
      <p className={styles.introText}>
        教科ごとに配置可能な時限・午後制限・分散設定をします。
        昼休みの境界は「⏰ 時間帯」タブで変更できます（現在:{" "}
        <strong>
          {lunchAfter}限まで午前 / {lunchAfter + 1}限以降午後
        </strong>
        ）。
      </p>

      <div className={styles.tableWrapper}>
        <table className={`${styles.detailsTable} ${styles.tableCompact}`}>
          <thead>
            <tr className={styles.tableHeaderRow}>
              <th className={styles.tableCellHeader}>教科</th>
              <th className={styles.tableCellHeader}>
                配置可能時限
                <div className={styles.periodLabelRow}>
                  {PERIODS.map((p) => (
                    <span
                      key={p}
                      className={styles.periodLabel}
                      style={{ color: p <= lunchAfter ? "#1D4ED8" : "#92400E" }}
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </th>
              <th className={styles.tableCellHeader}>1日最大コマ</th>
              <th className={styles.tableCellHeader}>午後1日上限</th>
              <th className={styles.tableCellHeader}>午後分散</th>
              <th className={styles.tableCellHeader}>全体分散</th>
              <th className={styles.tableCellHeader}>2コマ連続</th>
            </tr>
          </thead>
          <tbody>
            {allSubjects.map((subj) => {
              const allowed = get(subj, "allowed_periods") || [];
              return (
                <tr key={subj} className={styles.tableRowStripe}>
                  <td
                    className={`${styles.tableCell} ${styles.tableCellStrong}`}
                  >
                    {subj}
                  </td>
                  <td className={styles.tableCell}>
                    <div className={styles.periodButtonRow}>
                      {PERIODS.map((p) => {
                        const isAM = p <= lunchAfter;
                        const active = allowed.includes(p);
                        return (
                          <button
                            type="button"
                            key={p}
                            onClick={() => togglePeriod(subj, p)}
                            className={`${styles.periodButton} ${
                              active
                                ? isAM
                                  ? styles.periodButtonActiveAM
                                  : styles.periodButtonActivePM
                                : ""
                            }`}
                          >
                            {p}
                          </button>
                        );
                      })}
                      {allowed.length === 0 && (
                        <span className={styles.periodEmptyText}>制限なし</span>
                      )}
                    </div>
                  </td>
                  <td className={styles.tableCell}>
                    <input
                      type="number"
                      min="1"
                      max="6"
                      value={get(subj, "max_daily") ?? ""}
                      placeholder="なし"
                      onChange={(e) =>
                        updateNum(subj, "max_daily", e.target.value)
                      }
                      className={styles.smallNumberInput68}
                    />
                  </td>
                  <td className={styles.tableCell}>
                    <input
                      type="number"
                      min="0"
                      max="6"
                      value={get(subj, "max_afternoon_daily") ?? ""}
                      placeholder="なし"
                      onChange={(e) =>
                        updateNum(subj, "max_afternoon_daily", e.target.value)
                      }
                      className={styles.smallNumberInput68}
                    />
                  </td>
                  <td className={`${styles.tableCell} ${styles.textCenter}`}>
                    <input
                      type="checkbox"
                      checked={!!get(subj, "afternoon_spread")}
                      onChange={() => toggle(subj, "afternoon_spread")}
                      className={styles.checkboxInput}
                    />
                  </td>
                  <td className={`${styles.tableCell} ${styles.textCenter}`}>
                    <input
                      type="checkbox"
                      checked={!!get(subj, "spread_days")}
                      onChange={() => toggle(subj, "spread_days")}
                      className={styles.checkboxInput}
                    />
                  </td>
                  <td className={`${styles.tableCell} ${styles.textCenter}`}>
                    <input
                      type="checkbox"
                      checked={!!get(subj, "requires_double")}
                      onChange={() => toggle(subj, "requires_double")}
                      className={styles.checkboxInput}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className={styles.panelNote}>
        <span>🔵 青ボタン = 午前時限 　🟡 黄ボタン = 午後時限</span>
        <span>
          午後1日上限: その日の午後に置けるコマ数（推奨: 1）　午後分散:
          午後コマを異なる曜日に配置　全体分散: 週全体で分散
        </span>
        <span>2コマ連続: ON にすると2時限連続で配置（理科実験・美術など）</span>
      </div>
    </div>
  );
}
