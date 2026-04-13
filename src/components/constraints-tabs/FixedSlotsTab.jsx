import { useState } from "react";
import { useTimetableStore } from "../../store/useTimetableStore";
import styles from "./FixedSlotsTab.module.css";

const DAYS = ["月", "火", "水", "木", "金"];
const PERIODS = [1, 2, 3, 4, 5, 6];

export default function FixedSlotsTab() {
  const { structure, fixed_slots, addFixedSlot, removeFixedSlot } =
    useTimetableStore();

  const [form, setForm] = useState({
    scope: "all",
    grade: "",
    class_name: "",
    day_of_week: "月",
    period: 1,
    subject: "",
    label: "",
  });

  const allSubjects = [
    ...new Set(
      Object.values(structure.required_hours || {}).flatMap((h) =>
        Object.keys(h),
      ),
    ),
  ].sort();

  const gradeOptions = (structure.grades || []).map((g) => g.grade);
  const classOptions = form.grade
    ? (() => {
        const g = (structure.grades || []).find(
          (gr) => gr.grade === Number(form.grade),
        );
        if (!g) return [];
        return [...(g.classes || []), ...(g.special_classes || [])];
      })()
    : [];

  const handleAdd = () => {
    if (!form.subject) {
      alert("教科を選択してください");
      return;
    }
    if (form.scope === "grade" && !form.grade) {
      alert("学年を選択してください");
      return;
    }
    if (form.scope === "class" && (!form.grade || !form.class_name)) {
      alert("学年とクラスを選択してください");
      return;
    }
    addFixedSlot({
      scope: form.scope,
      grade: form.scope !== "all" ? Number(form.grade) : null,
      class_name: form.scope === "class" ? form.class_name : null,
      day_of_week: form.day_of_week,
      period: Number(form.period),
      subject: form.subject,
      label: form.label || form.subject,
    });
    setForm((f) => ({ ...f, subject: "", label: "" }));
  };

  const scopeLabel = (scope, grade, class_name) => {
    if (scope === "all") return "全校共通";
    if (scope === "grade") return `${grade}年生全クラス`;
    return `${grade}年 ${class_name}`;
  };

  return (
    <div>
      <p className={styles.smallText}>
        特定の曜日・時限に固定する授業を登録します。
        <br />
        <strong>全校共通</strong>（例: 月1限は全校朝会）、
        <strong>学年指定</strong>（例: 3年の水5限は学活）、
        <strong>クラス指定</strong>も選べます。
      </p>

      <div className={styles.sectionCard}>
        <div className={styles.formRow}>
          <label className={styles.fieldLabelContainer}>
            <span className={styles.fieldLabelHead}>適用範囲</span>
            <select
              value={form.scope}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  scope: e.target.value,
                  grade: "",
                  class_name: "",
                }))
              }
              className={styles.selectInput}
            >
              <option value="all">全校共通</option>
              <option value="grade">学年指定</option>
              <option value="class">クラス指定</option>
            </select>
          </label>

          {form.scope !== "all" && (
            <label className={styles.fieldLabelContainer}>
              <span className={styles.fieldLabelHead}>学年</span>
              <select
                value={form.grade}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    grade: e.target.value,
                    class_name: "",
                  }))
                }
                className={styles.selectInput}
              >
                <option value="">選択</option>
                {gradeOptions.map((g) => (
                  <option key={g} value={g}>
                    {g}年
                  </option>
                ))}
              </select>
            </label>
          )}

          {form.scope === "class" && (
            <label className={styles.fieldLabelContainer}>
              <span className={styles.fieldLabelHead}>クラス</span>
              <select
                value={form.class_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, class_name: e.target.value }))
                }
                className={styles.selectInput}
              >
                <option value="">選択</option>
                {classOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className={styles.fieldLabelContainer}>
            <span className={styles.fieldLabelHead}>曜日</span>
            <select
              value={form.day_of_week}
              onChange={(e) =>
                setForm((f) => ({ ...f, day_of_week: e.target.value }))
              }
              className={styles.selectInput}
            >
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {d}曜
                </option>
              ))}
            </select>
          </label>

          <label className={styles.fieldLabelContainer}>
            <span className={styles.fieldLabelHead}>時限</span>
            <select
              value={form.period}
              onChange={(e) =>
                setForm((f) => ({ ...f, period: e.target.value }))
              }
              className={styles.selectInput}
            >
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {p}限
                </option>
              ))}
            </select>
          </label>

          <label className={styles.fieldLabelContainer}>
            <span className={styles.fieldLabelHead}>教科</span>
            <select
              value={form.subject}
              onChange={(e) =>
                setForm((f) => ({ ...f, subject: e.target.value }))
              }
              className={styles.selectInput}
            >
              <option value="">選択</option>
              {allSubjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.fieldLabelContainer}>
            <span className={styles.fieldLabelHead}>ラベル（任意）</span>
            <input
              value={form.label}
              onChange={(e) =>
                setForm((f) => ({ ...f, label: e.target.value }))
              }
              placeholder="例: 全校朝会"
              maxLength={20}
              className={styles.textInput}
            />
          </label>
        </div>

        <button type="button" onClick={handleAdd} className={styles.addButton}>
          ＋ 追加
        </button>
      </div>

      {(fixed_slots || []).length === 0 ? (
        <p className={styles.emptyMessage}>固定コマはまだ登録されていません</p>
      ) : (
        <table className={styles.detailsTable}>
          <thead>
            <tr className={styles.tableHeaderRow}>
              {["適用範囲", "曜日・時限", "教科", "ラベル", ""].map((h) => (
                <th key={h} className={styles.tableCellHeader}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(fixed_slots || []).map((slot) => (
              <tr key={slot.id} className={styles.tableRowStripe}>
                <td className={styles.tableCell}>
                  {scopeLabel(slot.scope, slot.grade, slot.class_name)}
                </td>
                <td className={styles.tableCell}>
                  {slot.day_of_week}曜 {slot.period}限
                </td>
                <td className={styles.tableCell}>{slot.subject}</td>
                <td className={`${styles.tableCell} ${styles.tableCellMuted}`}>
                  {slot.label || "-"}
                </td>
                <td className={styles.tableCell}>
                  <button
                    type="button"
                    onClick={() => removeFixedSlot(slot.id)}
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
