import { useRef, useState } from "react";
import { useTimetableStore } from "../store/useTimetableStore";
import Modal from "./Modal";
import styles from "./SolverPanel.module.css";

const API_BASE = "http://127.0.0.1:8000";

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
    teacher_constraints,
    subject_placement,
    facilities,
    subject_facility,
    alt_week_pairs,
    cross_grade_groups,
    class_groups,
    subject_pairings,
    subject_sequences,
    setGeneratedTimetable,
    timetable,
  } = useTimetableStore();

  // ─── UI state ──────────────────────────────────────────────────────
  const [mode, setMode] = useState("browser"); // 'browser' | 'server'
  const [timeLimit, setTimeLimit] = useState(10); // browser mode default
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

  // ─── OR-Tools サーバーソルバー ────────────────────────────────────
  const runServerSolver = async () => {
    setStatus("running");
    setProgress(0);
    setResult(null);
    setErrorMsg("");
    startTimer();

    // ヘルスチェック
    try {
      const health = await fetch(`${API_BASE}/api/health`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!health.ok) throw new Error("server not ok");
    } catch {
      stopTimer();
      setStatus("error");
      setErrorMsg(
        "Pythonバックエンドに接続できません。\n以下を実行してサーバーを起動してください：\n\ncd desktop/python\nuv run server.py",
      );
      return;
    }

    // 進捗バー（時間ベース疑似プログレス）
    const prog = setInterval(() => {
      setProgress((p) => Math.min(92, p + (100 / timeLimit) * 0.5));
    }, 500);

    try {
      const res = await fetch(`${API_BASE}/api/solver/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teachers,
          structure,
          subject_constraints,
          settings,
          fixed_slots: fixed_slots || [],
          teacher_constraints: teacher_constraints || {},
          subject_placement: subject_placement || {},
          facilities: facilities || [],
          subject_facility: subject_facility || {},
          alt_week_pairs: alt_week_pairs || [],
          cross_grade_groups: cross_grade_groups || [],
          teacher_groups: teacher_groups || [],
          class_groups: class_groups || [],
          subject_sequences: subject_sequences || [],
          existing_timetable: overwriteMode === "empty" ? timetable || [] : [],
          time_limit: timeLimit,
        }),
        signal: AbortSignal.timeout((timeLimit + 15) * 1000),
      });
      clearInterval(prog);
      stopTimer();
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ detail: `HTTP ${res.status}` }));
        // Pydantic バリデーションエラー（配列形式）と通常エラー（文字列）を両方処理
        let msg;
        if (Array.isArray(err.detail)) {
          msg =
            "リクエスト検証エラー:\n" +
            err.detail
              .map((e) => `・${(e.loc || []).slice(1).join(".")}: ${e.msg}`)
              .join("\n");
        } else {
          msg =
            typeof err.detail === "string"
              ? err.detail
              : JSON.stringify(err.detail);
        }
        setStatus("error");
        setErrorMsg(msg || `サーバーエラー (${res.status})`);
        return;
      }
      const data = await res.json();
      setProgress(100);
      setResult(data);
      setStatus("done");
    } catch (e) {
      clearInterval(prog);
      stopTimer();
      setStatus("error");
      setErrorMsg(
        e.name === "TimeoutError"
          ? `タイムアウト（${timeLimit + 15}秒）しました。`
          : `通信エラー: ${e.message}`,
      );
    }
  };

  const handleRun = () => {
    if (mode === "browser") runBrowserSolver();
    else runServerSolver();
  };

  const isRunning = status === "running";
  const timeLimits = mode === "browser" ? [5, 10, 20, 30] : [30, 60, 120, 300];

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

      {/* 実行モード選択 */}
      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldsetLegend}>実行モード</legend>
        <div className="button-row">
          <button
            type="button"
            disabled={isRunning}
            onClick={() => {
              setMode("browser");
              setTimeLimit(10);
              setStatus("idle");
              setResult(null);
            }}
            style={chipStyle(mode === "browser", "secondary")}
          >
            {mode === "browser" && <span style={{ fontSize: "10px" }}>✓</span>}
            ブラウザ内実行（サーバー不要）
          </button>
          <button
            type="button"
            disabled={isRunning}
            onClick={() => {
              setMode("server");
              setTimeLimit(60);
              setStatus("idle");
              setResult(null);
            }}
            style={chipStyle(mode === "server", "primary")}
          >
            {mode === "server" && <span style={{ fontSize: "10px" }}>✓</span>}
            OR-Tools 高精度（要サーバー）
          </button>
        </div>
        <p className="help-text">
          {mode === "browser"
            ? "ブラウザ内で動作するグリーディ法ソルバーです。Pythonサーバー不要ですぐ使えます。"
            : "Google OR-Tools CP-SAT（制約充足）を使用した高精度ソルバーです。Python バックエンドが必要です。"}
        </p>
      </fieldset>

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
              {timeLimit === t && <span style={{ fontSize: "10px" }}>✓</span>}
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
              <span style={{ fontSize: "10px" }}>✓</span>
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
              <span style={{ fontSize: "10px" }}>✓</span>
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
                ? mode === "browser"
                  ? `探索中 … ${elapsed}秒 / ${attempts}回試行`
                  : `最適化中 … ${elapsed}秒`
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
          <div className={styles.errorTitle}>⚠ エラー</div>
          {errorMsg}
        </div>
      )}

      {/* 結果表示 */}
      {status === "done" && result && (
        <div className={styles.resultBox}>
          <div className={styles.resultTitle}>✓ 生成完了</div>
          <div className={styles.resultMessage}>{result.message}</div>
        </div>
      )}

      {/* OR-Toolsモードのサーバー案内 */}
      {mode === "server" && status === "idle" && (
        <div className={styles.serverHelpBox}>
          <div className={styles.serverHelpTitle}>
            Pythonバックエンドが必要です
          </div>
          <div className={styles.serverHelpCode}>
            {"cd desktop/python\nuv run server.py"}
          </div>
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
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
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
