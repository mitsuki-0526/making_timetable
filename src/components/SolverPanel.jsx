import { useRef, useState } from "react";
import { useTimetableStore } from "../store/useTimetableStore";
import Modal from "./Modal";
import styles from "./SolverPanel.module.css";

// ─── M3 チップスタイル ────────────────────────────────────────────────
const chipStyle = (selected, color = "primary") => ({
  padding: "0.3rem 0.875rem",
  borderRadius: "var(--md-shape-full)",
  border: `1px solid ${selected ? `var(--md-${color})` : "var(--md-outline-variant)"}`,
  background: selected ? `var(--md-${color}-container)` : "transparent",
  color: selected
    ? `var(--md-on-${color}-container)`
    : "var(--md-on-surface-variant)",
  fontSize: "13px",
  fontWeight: selected ? 600 : 400,
  cursor: "pointer",
  fontFamily: "var(--md-font-plain)",
  display: "inline-flex",
  alignItems: "center",
  gap: "0.25rem",
  transition: "all 0.15s",
});

const SolverPanel = ({ onClose }) => {
  const {
    teachers,
    teacher_groups,
    structure,
    subject_constraints,
    settings,
    fixed_slots,
    subject_placement,
    alt_week_pairs,
    cross_grade_groups,
    class_groups,
    subject_pairings,
    subject_sequences,
    setGeneratedTimetable,
    timetable,
  } = useTimetableStore();

  // ─── UI state ──────────────────────────────────────────────────────
  const [timeLimit, setTimeLimit] = useState(30);
  const [overwriteMode, setOverwriteMode] = useState("empty");
  const [status, setStatus] = useState("idle"); // idle/running/done/error
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [progress, setProgress] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const workerRef = useRef(null);
  const timerRef = useRef(null);

  // ─── 情報サマリー ───────────────────────────────────────────────────
  const totalClasses = structure.grades.reduce(
    (s, g) => s + (g.classes?.length || 0) + (g.special_classes?.length || 0),
    0,
  );
  const totalSubjects = Object.values(structure.required_hours)
    .flatMap(Object.keys)
    .filter((v, i, a) => a.indexOf(v) === i).length;
  const filledSlots = timetable.filter((e) => e.subject).length;

  // ─── タイマー ──────────────────────────────────────────────────────
  const startTimer = () => {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  };
  const stopTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = null;
  };

  // ─── 適用処理 ────────────────────────────────────────────────────────
  const handleApply = () => {
    if (!result?.timetable?.length) return;

    let toApply;
    if (overwriteMode === "all") {
      toApply = result.timetable;
    } else {
      // 空きスロットのみ追加（既存エントリは保持）
      const existingKeys = new Set(
        timetable.map(
          (e) => `${e.day_of_week}|${e.period}|${e.grade}|${e.class_name}`,
        ),
      );

      // 既存エントリの教科カウント（alt_subject も含む）を集計
      // クラスごとに { [subject]: count } を作成
      const classKey = (grade, class_name) => `${grade}|${class_name}`;
      const counts = {};
      for (const e of timetable) {
        if (!e?.subject) continue;
        const k = classKey(e.grade, e.class_name);
        if (!counts[k]) counts[k] = {};
        counts[k][e.subject] = (counts[k][e.subject] || 0) + 1;
        if (e.alt_subject) {
          counts[k][e.alt_subject] = (counts[k][e.alt_subject] || 0) + 1;
        }
      }

      // クラス → 規定時数マップを解決するヘルパ
      const reqForClass = (grade, class_name) => {
        const isSpecial = /特支/.test(class_name);
        const key = `${grade}_${isSpecial ? "特支" : "通常"}`;
        return structure?.required_hours?.[key] || {};
      };

      // 新規エントリを順番に走査し、規定時数を超過しないもののみ採用
      // ソルバー側の制約ずれや隔週ペアのカウントずれで起こる教科の超過配置を防ぐ
      const filteredNew = [];
      for (const e of result.timetable) {
        const slotKey = `${e.day_of_week}|${e.period}|${e.grade}|${e.class_name}`;
        if (existingKeys.has(slotKey)) continue;
        if (!e?.subject) continue;

        const k = classKey(e.grade, e.class_name);
        const req = reqForClass(e.grade, e.class_name);
        if (!counts[k]) counts[k] = {};

        const curMain = counts[k][e.subject] || 0;
        const reqMain = req[e.subject];
        // 規定時数が定義されていて、現在数がそれに達している場合はスキップ
        if (reqMain != null && curMain >= reqMain) continue;

        if (e.alt_subject) {
          const curAlt = counts[k][e.alt_subject] || 0;
          const reqAlt = req[e.alt_subject];
          if (reqAlt != null && curAlt >= reqAlt) continue;
        }

        filteredNew.push(e);
        counts[k][e.subject] = curMain + 1;
        if (e.alt_subject) {
          counts[k][e.alt_subject] = (counts[k][e.alt_subject] || 0) + 1;
        }
      }

      toApply = [...timetable, ...filteredNew];
    }

    setGeneratedTimetable(toApply);
    onClose();
  };

  // ─── キャンセル ──────────────────────────────────────────────────────
  const handleCancel = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    stopTimer();
    setStatus("idle");
  };

  // ─── ブラウザ内ソルバー ───────────────────────────────────────────
  const runBrowserSolver = () => {
    setStatus("running");
    setProgress(0);
    setAttempts(0);
    setResult(null);
    setErrorMsg("");
    startTimer();

    // Web Worker を生成
    const worker = new Worker(
      new URL("../lib/jsSolver.worker.js", import.meta.url),
      { type: "module" },
    );
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === "progress") {
        setProgress(msg.score ?? 0);
        setAttempts(msg.attempts ?? 0);
      } else if (msg.type === "done") {
        stopTimer();
        setProgress(
          msg.required > 0
            ? Math.round((msg.placed / msg.required) * 100)
            : 100,
        );
        setResult({
          timetable: msg.timetable,
          count: msg.count,
          placed: msg.placed,
          required: msg.required,
          message:
            msg.required > 0
              ? `${msg.placed} / ${msg.required} コマを配置しました（配置率 ${Math.round((msg.placed / msg.required) * 100)}%）`
              : `${msg.count} コマの時間割を生成しました。`,
        });
        setStatus("done");
        worker.terminate();
        workerRef.current = null;
      } else if (msg.type === "error") {
        stopTimer();
        setErrorMsg(msg.message);
        setStatus("error");
        worker.terminate();
        workerRef.current = null;
      }
    };

    worker.onerror = (e) => {
      stopTimer();
      setErrorMsg(`ソルバーエラー: ${e.message}`);
      setStatus("error");
      workerRef.current = null;
    };

    worker.postMessage({
      type: "solve",
      data: {
        teachers,
        teacher_groups: teacher_groups || [],
        structure,
        subject_constraints,
        settings,
        fixed_slots: fixed_slots || [],
        subject_placement: subject_placement || {},
        cross_grade_groups: cross_grade_groups || [],
        class_groups: class_groups || [],
        subject_pairings: subject_pairings || [],
        alt_week_pairs: alt_week_pairs || [],
        subject_sequences: subject_sequences || [],
        // 空きコマのみ埋めるモードでは既存エントリを渡して必要コマ数を正しく計算する
        existing_timetable: overwriteMode === "empty" ? timetable || [] : [],
        time_limit: timeLimit,
      },
    });
  };

  const handleRun = () => runBrowserSolver();

  const isRunning = status === "running";
  const timeLimits = [5, 10, 30, 60, 120];

  // ─── レンダリング ───────────────────────────────────────────────────
  return (
    <Modal
      title="時間割 自動生成"
      onClose={onClose}
      disableOverlayClose={isRunning}
      bodyClassName={styles.panelBody}
    >
      <p className="help-text">
        登録されたマスタデータと制約に基づいて時間割を自動生成します
      </p>
      {/* データ概要 */}
      <div className={styles.statsRow}>
        {[
          { label: "学年数", value: structure.grades.length },
          { label: "総クラス", value: totalClasses },
          { label: "教科数", value: totalSubjects },
          { label: "配置済み", value: filledSlots },
        ].map(({ label, value }) => (
          <div key={label} className={styles.statCard}>
            <div className={styles.statValue}>{value}</div>
            <div className={styles.statLabel}>{label}</div>
          </div>
        ))}
      </div>

      {/* 最大探索時間 */}
      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>
          最大探索時間
          <span className={styles.timeLimitLabel}>{timeLimit}秒</span>
        </legend>
        <div className={styles.chipRowCompact}>
          {timeLimits.map((t) => (
            <button
              key={t}
              type="button"
              disabled={isRunning}
              onClick={() => setTimeLimit(t)}
              style={chipStyle(timeLimit === t)}
            >
              {timeLimit === t && (
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "12px" }}
                >
                  check
                </span>
              )}
              {t}秒
            </button>
          ))}
        </div>
      </fieldset>

      {/* 適用モード */}
      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>適用モード</legend>
        <div className={styles.chipRowCompact}>
          <button
            type="button"
            disabled={isRunning}
            onClick={() => setOverwriteMode("empty")}
            style={chipStyle(overwriteMode === "empty", "secondary")}
          >
            {overwriteMode === "empty" && (
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "12px" }}
              >
                check
              </span>
            )}
            空きコマのみ埋める
          </button>
          <button
            type="button"
            disabled={isRunning}
            onClick={() => setOverwriteMode("all")}
            style={chipStyle(overwriteMode === "all", "error")}
          >
            {overwriteMode === "all" && (
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "12px" }}
              >
                check
              </span>
            )}
            全て上書き
          </button>
        </div>
      </fieldset>

      {/* 進捗バー */}
      {(isRunning || status === "done") && (
        <div>
          <div className={styles.progressMeta}>
            <span className={styles.progressLabel}>
              {isRunning
                ? `探索中 … ${elapsed}秒 / ${attempts}回試行`
                : "生成完了"}
            </span>
            <span className={styles.progressCount}>
              {Math.round(progress)}%
            </span>
          </div>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{
                background:
                  status === "done"
                    ? "var(--md-primary)"
                    : "var(--md-secondary)",
                width: `${progress}%`,
                transition: isRunning ? "width 0.5s ease" : "width 0.3s ease",
              }}
            />
          </div>
        </div>
      )}

      {/* エラー表示 */}
      {status === "error" && (
        <div className={styles.errorBox}>
          <div className={styles.errorTitle}>
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: "16px",
                verticalAlign: "middle",
                marginRight: "4px",
              }}
            >
              warning
            </span>
            エラー
          </div>
          {errorMsg}
        </div>
      )}

      {/* 結果表示 */}
      {status === "done" && result && (
        <div className={styles.resultBox}>
          <div className={styles.resultTitle}>
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: "16px",
                verticalAlign: "middle",
                marginRight: "4px",
              }}
            >
              check_circle
            </span>
            生成完了
          </div>
          <div className={styles.resultMessage}>{result.message}</div>
        </div>
      )}

      {/* アクションボタン */}
      <div className={styles.actionRow}>
        {isRunning ? (
          <button
            type="button"
            onClick={handleCancel}
            className={styles.buttonDanger}
          >
            中断
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className={styles.buttonSecondary}
          >
            キャンセル
          </button>
        )}

        {status === "done" && result ? (
          <button
            type="button"
            onClick={handleApply}
            className={styles.buttonPrimary}
          >
            時間割に適用する
          </button>
        ) : !isRunning ? (
          <button
            type="button"
            onClick={handleRun}
            className={styles.buttonPrimaryIcon}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "16px", verticalAlign: "middle" }}
            >
              play_arrow
            </span>
            自動生成を開始
          </button>
        ) : null}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </Modal>
  );
};

export default SolverPanel;
