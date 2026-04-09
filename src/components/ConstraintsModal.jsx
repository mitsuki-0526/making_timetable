import { useState } from "react";
import { useTimetableStore } from "../store/useTimetableStore";
import styles from "./ConstraintsModal.module.css";

const DAYS = ["月", "火", "水", "木", "金"];
const PERIODS = [1, 2, 3, 4, 5, 6];

// ─────────────────────────────────────────────
// タブ① 固定コマ
// ─────────────────────────────────────────────
function FixedSlotsTab() {
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

// ─────────────────────────────────────────────
// タブ② 時間帯設定
// ─────────────────────────────────────────────
function TimezoneTab() {
  const { settings, updateLunchPeriod } = useTimetableStore();
  const lunchAfter = settings.lunch_after_period ?? 4;

  const amPeriods = PERIODS.filter((p) => p <= lunchAfter);
  const pmPeriods = PERIODS.filter((p) => p > lunchAfter);

  return (
    <div>
      <p className={styles.infoText}>
        昼休みの区切りを設定します。「午前」「午後」の判定は教科配置制約に使用されます。
      </p>

      {/* 昼休み設定 */}
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

      {/* 時限プレビュー */}
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

// ─────────────────────────────────────────────
// タブ③ 教員制約
// ─────────────────────────────────────────────
function TeacherConstraintsTab() {
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

// ─────────────────────────────────────────────
// タブ⑤ 施設制約
// ─────────────────────────────────────────────
function FacilityTab() {
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

      {/* 施設追加 */}
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

      {/* 施設一覧 */}
      {(facilities || []).length === 0 ? (
        <p className={styles.emptyCard}>施設が登録されていません</p>
      ) : (
        <div className={styles.facilityTagList}>
          {(facilities || []).map((fac) => (
            <div key={fac.id} className={styles.facilityTag}>
              <span className={styles.facilityTagLabel}>🏫 {fac.name}</span>
              <button
                type="button"
                onClick={() => removeFacility(fac.id)}
                className={styles.facilityTagRemove}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 教科→施設マッピング */}
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

// ─────────────────────────────────────────────
// タブ④ 教科配置制約
// ─────────────────────────────────────────────
function SubjectConstraintsTab() {
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

// ─────────────────────────────────────────────
// タブ⑥ 隔週授業
// ─────────────────────────────────────────────
function AltWeekTab() {
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

  // class_key の選択肢
  const classKeyOptions = (structure.grades || []).flatMap((g) => {
    const opts = [];
    if ((g.classes || []).length > 0)
      opts.push({ value: `${g.grade}_通常`, label: `${g.grade}年 通常クラス` });
    if ((g.special_classes || []).length > 0)
      opts.push({ value: `${g.grade}_特支`, label: `${g.grade}年 特支クラス` });
    return opts;
  });

  // 教科一覧
  const allSubjects = [
    ...new Set(
      Object.values(structure.required_hours || {}).flatMap((h) =>
        Object.keys(h),
      ),
    ),
  ].sort();

  // 選択された class_key の required_hours から利用可能な教科を絞る
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

      {/* 追加フォーム */}
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

      {/* 登録済みリスト */}
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

// ─────────────────────────────────────────────
// タブ⑦ 連続配置
// ─────────────────────────────────────────────
function SubjectSequenceTab() {
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
  const [className, setClassName] = useState(""); // '' = 学年全体
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

        {/* 登録フォーム */}
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

      {/* 登録済み一覧 */}
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

// ─────────────────────────────────────────────
// メインモーダル
// ─────────────────────────────────────────────
const TABS = [
  { id: "fixed", label: "🔒 固定コマ" },
  { id: "timezone", label: "⏰ 時間帯" },
  { id: "teacher", label: "👨‍🏫 教員制約" },
  { id: "subject", label: "📚 教科配置" },
  { id: "facility", label: "🏫 施設制約" },
  { id: "altweek", label: "🔄 隔週授業" },
  { id: "sequence", label: "⏩ 連続配置" },
];

export default function ConstraintsModal({ onClose }) {
  const [activeTab, setActiveTab] = useState("fixed");

  return (
    <div
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      className={styles.modalOverlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onClose();
        }
      }}
    >
      <div className={styles.modalDialog}>
        {/* ヘッダー */}
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>📋 条件設定</h2>
          <button
            type="button"
            onClick={onClose}
            className={styles.modalHeaderClose}
          >
            ✕
          </button>
        </div>

        {/* タブ */}
        <div className={styles.tabRow}>
          {TABS.map((tab) => (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`${styles.tabButton} ${
                activeTab === tab.id ? styles.tabButtonActive : ""
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* コンテンツ */}
        <div className={styles.modalContent}>
          {activeTab === "fixed" && <FixedSlotsTab />}
          {activeTab === "timezone" && <TimezoneTab />}
          {activeTab === "teacher" && <TeacherConstraintsTab />}
          {activeTab === "subject" && <SubjectConstraintsTab />}
          {activeTab === "facility" && <FacilityTab />}
          {activeTab === "altweek" && <AltWeekTab />}
          {activeTab === "sequence" && <SubjectSequenceTab />}
        </div>

        {/* フッター */}
        <div className={styles.modalFooter}>
          <button
            type="button"
            onClick={onClose}
            className={styles.footerButton}
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
