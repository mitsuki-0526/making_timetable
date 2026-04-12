import { useState } from "react";
import { useTimetableStore } from "../../store/useTimetableStore";
import styles from "./AltWeekTab.module.css";

export default function AltWeekTab() {
  const {
    structure,
    alt_week_pairs,
    addAltWeekPair,
    removeAltWeekPair,
    updateAltWeekPair,
  } = useTimetableStore();

  const [form, setForm] = useState({
    class_key: "",
    subject_a: "",
    subject_b: "",
    count: 1,
  });

  const classKeyOptions = (structure.grades || []).flatMap((g) => {
    const opts = [];
    if ((g.classes || []).length > 0)
      opts.push({ value: `${g.grade}_通常`, label: `${g.grade}年 通常クラス` });
    if ((g.special_classes || []).length > 0)
      opts.push({ value: `${g.grade}_特支`, label: `${g.grade}年 特支クラス` });
    return opts;
  });

  const allSubjects = [
    ...new Set(
      Object.values(structure.required_hours || {}).flatMap((h) =>
        Object.keys(h),
      ),
    ),
  ].sort();

  const subjectsForKey = (key) =>
    key ? Object.keys(structure.required_hours[key] || {}) : allSubjects;

  const handleAdd = () => {
    if (!form.class_key) {
      alert("クラス区分を選択してください");
      return;
    }
    if (!form.subject_a) {
      alert("A週の教科を選択してください");
      return;
    }
    if (!form.subject_b) {
      alert("B週の教科を選択してください");
      return;
    }
    if (form.subject_a === form.subject_b) {
      alert("A週とB週に同じ教科は設定できません");
      return;
    }
    if (form.count < 1) {
      alert("コマ数は1以上を指定してください");
      return;
    }
    addAltWeekPair({
      class_key: form.class_key,
      subject_a: form.subject_a,
      subject_b: form.subject_b,
      count: Number(form.count),
    });
    setForm((f) => ({ ...f, subject_a: "", subject_b: "", count: 1 }));
  };

  const classKeyLabel = (key) =>
    classKeyOptions.find((o) => o.value === key)?.label || key;

  return (
    <div>
      <p className={styles.introText}>
        同じ時限に A週・B週で異なる教科を交互に行う「隔週授業」を設定します。
        <br />
        <strong>例</strong>:
        1年通常クラスの「音楽」と「図工」を同一コマで1週交代に配置（各2コマ）
      </p>

      <div className={styles.warningBox}>
        ⚠ <strong>required_hours の設定と合わせてください。</strong>
        <br />
        例: 音楽=2、図工=2 のときに ペアcount=2 を設定 →
        2つの同一コマが音楽(A)/図工(B)になります。
      </div>

      <div className={styles.formSection}>
        <div className={styles.gridForm}>
          <label className={styles.fieldLabelContainer}>
            <span className={styles.fieldLabelHead}>クラス区分</span>
            <select
              value={form.class_key}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  class_key: e.target.value,
                  subject_a: "",
                  subject_b: "",
                }))
              }
              className={styles.selectInput}
            >
              <option value="">選択</option>
              {classKeyOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.fieldLabelContainer}>
            <span className={styles.fieldLabelHead}>A週の教科</span>
            <select
              value={form.subject_a}
              onChange={(e) =>
                setForm((f) => ({ ...f, subject_a: e.target.value }))
              }
              className={styles.selectInput}
            >
              <option value="">選択</option>
              {subjectsForKey(form.class_key).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.fieldLabelContainer}>
            <span className={styles.fieldLabelHead}>B週の教科</span>
            <select
              value={form.subject_b}
              onChange={(e) =>
                setForm((f) => ({ ...f, subject_b: e.target.value }))
              }
              className={styles.selectInput}
            >
              <option value="">選択</option>
              {subjectsForKey(form.class_key)
                .filter((s) => s !== form.subject_a)
                .map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
            </select>
          </label>

          <label className={styles.fieldLabelContainer}>
            <span className={styles.fieldLabelHead}>隔週スロット数</span>
            <input
              type="number"
              min="1"
              max="10"
              value={form.count}
              onChange={(e) =>
                setForm((f) => ({ ...f, count: e.target.value }))
              }
              className={styles.smallNumberInput80}
            />
          </label>
        </div>
        <button type="button" onClick={handleAdd} className={styles.addButton}>
          ＋ 追加
        </button>
      </div>

      {(alt_week_pairs || []).length === 0 ? (
        <p className={styles.emptyCard}>隔週授業ペアはまだ登録されていません</p>
      ) : (
        <table className={styles.detailsTable}>
          <thead>
            <tr className={styles.tableHeaderRow}>
              {[
                "クラス区分",
                "A週（主）",
                "B週（副）",
                "隔週スロット数",
                "",
              ].map((h) => (
                <th key={h} className={styles.tableCellHeader}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(alt_week_pairs || []).map((pair) => (
              <tr key={pair.id} className={styles.tableRowStripe}>
                <td className={styles.tableCell}>
                  {classKeyLabel(pair.class_key)}
                </td>
                <td
                  className={`${styles.tableCell} ${styles.tableCellStrong} ${styles.accentTextBlue}`}
                >
                  A: {pair.subject_a}
                </td>
                <td
                  className={`${styles.tableCell} ${styles.tableCellStrong} ${styles.accentTextPurple}`}
                >
                  B: {pair.subject_b}
                </td>
                <td className={`${styles.tableCell} ${styles.textCenter}`}>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={pair.count}
                    onChange={(e) =>
                      updateAltWeekPair(pair.id, {
                        count: Number(e.target.value),
                      })
                    }
                    className={styles.smallNumberInput60}
                  />
                </td>
                <td className={styles.tableCell}>
                  <button
                    type="button"
                    onClick={() => removeAltWeekPair(pair.id)}
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
      <p className={styles.notesText}>
        ※ ソルバー実行時に、A週教科のスロットへ自動的に
        B週教科（alt_subject）がタグ付けされます。
      </p>
    </div>
  );
}
