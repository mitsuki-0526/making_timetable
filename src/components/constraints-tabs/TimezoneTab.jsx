import { useTimetableStore } from "../../store/useTimetableStore";
import styles from "./TimezoneTab.module.css";

const PERIODS = [1, 2, 3, 4, 5, 6];

export default function TimezoneTab() {
  const { settings, updateLunchPeriod } = useTimetableStore();
  const lunchAfter = settings.lunch_after_period ?? 4;

  const amPeriods = PERIODS.filter((p) => p <= lunchAfter);
  const pmPeriods = PERIODS.filter((p) => p > lunchAfter);

  return (
    <div>
      <p className={styles.infoText}>
        昼休みの区切りを設定します。「午前」「午後」の判定は教科配置制約に使用されます。
      </p>

      <div className={styles.calloutBox}>
        <div className={styles.inlineRow}>
          <span className={styles.calloutLabel}>🍱 昼休みは</span>
          <select
            value={lunchAfter}
            onChange={(e) => updateLunchPeriod(e.target.value)}
            className={styles.selectSmall}
          >
            {PERIODS.slice(0, PERIODS.length - 1).map((p) => (
              <option key={p} value={p}>
                {p}限と{p + 1}限の間
              </option>
            ))}
          </select>
          <span className={styles.subText}>に設定</span>
        </div>
      </div>

      <div className={styles.flexRowWrap}>
        <div className={styles.flex1Min200}>
          <div className={`${styles.previewCard} ${styles.previewCardMorning}`}>
            <div className={styles.previewCardTitle}>☀️ 午前</div>
            {amPeriods.length === 0 ? (
              <p className={styles.previewEmptyText}>なし</p>
            ) : (
              <div className={styles.previewChipRow}>
                {amPeriods.map((p) => (
                  <span key={p} className={styles.previewChip}>
                    {p}限
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={styles.previewCenter}>
          <div className={styles.previewCenterContent}>
            <div className={styles.previewIcon}>🍱</div>
            <div>昼休み</div>
          </div>
        </div>

        <div className={styles.flex1Min200}>
          <div
            className={`${styles.previewCard} ${styles.previewCardAfternoon}`}
          >
            <div className={styles.previewCardTitle}>🌇 午後</div>
            {pmPeriods.length === 0 ? (
              <p className={styles.previewEmptyText}>なし</p>
            ) : (
              <div className={styles.previewChipRow}>
                {pmPeriods.map((p) => (
                  <span key={p} className={styles.previewChip}>
                    {p}限
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.infoCalloutBox}>
        <strong>📚 教科配置タブとの連携</strong>
        <br />
        各教科の「午後1日上限」に <code>1</code>{" "}
        を設定すると、午後の授業は1日1コマまでに制限されます。
        <br />
        「午後分散」にチェックを入れると、午後コマをなるべく異なる曜日に分けます。
      </div>
    </div>
  );
}
