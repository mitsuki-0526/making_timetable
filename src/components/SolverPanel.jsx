import React, { useState, useRef } from 'react';
import { useTimetableStore } from '../store/useTimetableStore';

// ─── M3 チップスタイル ────────────────────────────────────────────────
const chipStyle = (selected, color = 'primary') => ({
  padding: '0.3rem 0.875rem',
  borderRadius: 'var(--md-shape-full)',
  border: `1px solid ${selected ? `var(--md-${color})` : 'var(--md-outline-variant)'}`,
  background: selected ? `var(--md-${color}-container)` : 'transparent',
  color: selected ? `var(--md-on-${color}-container)` : 'var(--md-on-surface-variant)',
  fontSize: '13px', fontWeight: selected ? 600 : 400,
  cursor: 'pointer', fontFamily: 'var(--md-font-plain)',
  display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
  transition: 'all 0.15s',
});

const SolverPanel = ({ onClose }) => {
  const {
    teachers, teacher_groups, structure, subject_constraints, settings,
    fixed_slots, teacher_constraints, subject_placement,
    facilities, subject_facility, alt_week_pairs, cross_grade_groups, class_groups,
    subject_pairings, subject_sequences,
    setGeneratedTimetable, timetable,
  } = useTimetableStore();

  // ─── UI state ──────────────────────────────────────────────────────
  const [mode, setMode]               = useState('browser'); // 'browser' | 'highs'
  const [timeLimit, setTimeLimit]     = useState(10);        // browser mode default
  const [overwriteMode, setOverwriteMode] = useState('empty');
  const [status, setStatus]           = useState('idle');    // idle/running/done/error
  const [result, setResult]           = useState(null);
  const [errorMsg, setErrorMsg]       = useState('');
  const [progress, setProgress]       = useState(0);
  const [attempts, setAttempts]       = useState(0);
  const [elapsed, setElapsed]         = useState(0);
  const workerRef  = useRef(null);
  const timerRef   = useRef(null);

  // ─── 情報サマリー ───────────────────────────────────────────────────
  const totalClasses  = structure.grades.reduce((s, g) =>
    s + (g.classes?.length || 0) + (g.special_classes?.length || 0), 0);
  const totalSubjects = Object.values(structure.required_hours)
    .flatMap(Object.keys).filter((v, i, a) => a.indexOf(v) === i).length;
  const filledSlots   = timetable.filter(e => e.subject).length;

  // ─── タイマー ──────────────────────────────────────────────────────
  const startTimer = () => {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
  };
  const stopTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = null;
  };

  // ─── 適用処理 ────────────────────────────────────────────────────────
  const handleApply = () => {
    if (!result?.timetable?.length) return;

    let toApply;
    if (overwriteMode === 'all') {
      toApply = result.timetable;
    } else {
      // 空きスロットのみ追加（既存エントリは保持）
      const existingKeys = new Set(
        timetable.map(e => `${e.day_of_week}|${e.period}|${e.grade}|${e.class_name}`)
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
        const key = `${grade}_${isSpecial ? '特支' : '通常'}`;
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
    setStatus('idle');
  };

  // ─── Worker を起動する共通処理 ────────────────────────────────────
  // isModule=true  → ESモジュールWorker（jsSolver）
  // isModule=false → クラシックWorker（highsSolver: importScripts使用）
  const runWorker = (workerUrl, postData, isModule = true) => {
    setStatus('running');
    setProgress(0);
    setAttempts(0);
    setResult(null);
    setErrorMsg('');
    startTimer();

    const workerOptions = isModule ? { type: 'module' } : undefined;
    const worker = new Worker(workerUrl, workerOptions);
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        setProgress(msg.score ?? 0);
        setAttempts(msg.attempts ?? 0);
      } else if (msg.type === 'done') {
        stopTimer();
        const pct = msg.required > 0
          ? Math.round((msg.placed / msg.required) * 100)
          : 100;
        setProgress(pct);
        setResult({
          timetable: msg.timetable,
          count:     msg.count,
          placed:    msg.placed,
          required:  msg.required,
          message: msg.required > 0
            ? `${msg.placed} / ${msg.required} コマを配置しました（配置率 ${pct}%）`
            : `${msg.count} コマの時間割を生成しました。`,
        });
        setStatus('done');
        worker.terminate();
        workerRef.current = null;
      } else if (msg.type === 'error') {
        stopTimer();
        setErrorMsg(msg.message);
        setStatus('error');
        worker.terminate();
        workerRef.current = null;
      }
    };

    worker.onerror = (e) => {
      stopTimer();
      setErrorMsg(`ソルバーエラー: ${e.message}`);
      setStatus('error');
      workerRef.current = null;
    };

    worker.postMessage({ type: 'solve', data: postData });
  };

  // ─── ブラウザ内ソルバー（グリーディ法） ─────────────────────────
  const runBrowserSolver = () => {
    runWorker(
      new URL('../lib/jsSolver.worker.js', import.meta.url),
      {
        teachers,
        teacher_groups:     teacher_groups     || [],
        structure,
        subject_constraints,
        settings,
        fixed_slots:        fixed_slots        || [],
        subject_placement:  subject_placement  || {},
        cross_grade_groups: cross_grade_groups || [],
        class_groups:       class_groups       || [],
        subject_pairings:   subject_pairings   || [],
        alt_week_pairs:     alt_week_pairs     || [],
        subject_sequences:  subject_sequences  || [],
        existing_timetable: overwriteMode === 'empty' ? (timetable || []) : [],
        time_limit: timeLimit,
      }
    );
  };

  // ─── HiGHS ソルバー（MIP・高精度） ───────────────────────────────
  // クラシック Worker として起動し、public/highs.js を importScripts で読み込む
  const runHighsSolver = () => {
    runWorker(
      new URL('../lib/highsSolver.worker.js', import.meta.url),
      {
        teachers,
        teacher_groups:     teacher_groups     || [],
        structure,
        subject_constraints,
        settings,
        fixed_slots:        fixed_slots        || [],
        subject_placement:  subject_placement  || {},
        cross_grade_groups: cross_grade_groups || [],
        class_groups:       class_groups       || [],
        subject_pairings:   subject_pairings   || [],
        alt_week_pairs:     alt_week_pairs     || [],
        subject_sequences:  subject_sequences  || [],
        existing_timetable: overwriteMode === 'empty' ? (timetable || []) : [],
        time_limit: timeLimit,
        // highs.js / highs.wasm の場所を Worker に伝える
        baseUrl: import.meta.env.BASE_URL,
      },
      false, // クラシックWorker（importScripts使用のためESM非使用）
    );
  };

  const handleRun = () => {
    if (mode === 'browser') runBrowserSolver();
    else                    runHighsSolver();
  };

  const isRunning = status === 'running';
  const timeLimits = mode === 'browser' ? [5, 10, 20, 30] : [30, 60, 120, 300];
  const modeLabel = mode === 'browser'
    ? 'ブラウザ内で動作するグリーディ法ソルバーです。高速ですぐ使えます。'
    : 'HiGHS（混合整数計画法）を使った高精度ソルバーです。サーバー不要でブラウザ内で動作します。';

  // ─── レンダリング ───────────────────────────────────────────────────
  return (
    <div className="modal-overlay" onClick={isRunning ? undefined : onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '560px', width: '92vw' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="modal-header">
          <div>
            <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--md-on-surface)' }}>
              時間割 自動生成
            </div>
            <div style={{ fontSize: '13px', color: 'var(--md-on-surface-variant)', marginTop: '2px' }}>
              登録されたマスタデータと制約に基づいて時間割を自動生成します
            </div>
          </div>
          {!isRunning && (
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--md-on-surface-variant)', fontSize: '1.2rem', lineHeight: 1, padding: '4px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              aria-label="閉じる"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
            </button>
          )}
        </div>

        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* データ概要 */}
          <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
            {[
              { label: '学年数',    value: structure.grades.length },
              { label: '総クラス', value: totalClasses },
              { label: '教科数',   value: totalSubjects },
              { label: '配置済み', value: filledSlots },
            ].map(({ label, value }) => (
              <div key={label} style={{
                flex: '1 1 70px', minWidth: '70px',
                background: 'var(--md-surface-container)',
                borderRadius: 'var(--md-shape-md, 12px)',
                padding: '0.5rem 0.75rem', textAlign: 'center',
              }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--md-primary)', fontFamily: 'var(--md-font-mono)' }}>{value}</div>
                <div style={{ fontSize: '11px', color: 'var(--md-on-surface-variant)', marginTop: '1px' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* 実行モード選択 */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--md-on-surface-variant)', display: 'block', marginBottom: '0.5rem' }}>実行モード</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button" disabled={isRunning}
                onClick={() => { setMode('browser'); setTimeLimit(10); setStatus('idle'); setResult(null); }}
                style={chipStyle(mode === 'browser', 'secondary')}
              >
                {mode === 'browser' && <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check</span>}
                グリーディ法（高速）
              </button>
              <button
                type="button" disabled={isRunning}
                onClick={() => { setMode('highs'); setTimeLimit(60); setStatus('idle'); setResult(null); }}
                style={chipStyle(mode === 'highs', 'primary')}
              >
                {mode === 'highs' && <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check</span>}
                HiGHS（高精度・MIP）
              </button>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--md-on-surface-variant)', margin: '0.4rem 0 0', lineHeight: 1.5 }}>
              {modeLabel}
            </p>
          </div>

          {/* 最大探索時間 */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--md-on-surface-variant)', display: 'block', marginBottom: '0.5rem' }}>
              最大探索時間
              <span style={{ marginLeft: '0.5rem', color: 'var(--md-primary)', fontFamily: 'var(--md-font-mono)', fontWeight: 700 }}>{timeLimit}秒</span>
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {timeLimits.map(t => (
                <button key={t} type="button" disabled={isRunning} onClick={() => setTimeLimit(t)} style={chipStyle(timeLimit === t)}>
                  {timeLimit === t && <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check</span>}
                  {t}秒
                </button>
              ))}
            </div>
          </div>

          {/* 適用モード */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--md-on-surface-variant)', display: 'block', marginBottom: '0.5rem' }}>適用モード</label>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <button type="button" disabled={isRunning} onClick={() => setOverwriteMode('empty')} style={chipStyle(overwriteMode === 'empty', 'secondary')}>
                {overwriteMode === 'empty' && <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check</span>}空きコマのみ埋める
              </button>
              <button type="button" disabled={isRunning} onClick={() => setOverwriteMode('all')} style={chipStyle(overwriteMode === 'all', 'error')}>
                {overwriteMode === 'all' && <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check</span>}全て上書き
              </button>
            </div>
          </div>

          {/* 進捗バー */}
          {(isRunning || status === 'done') && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '13px', color: 'var(--md-on-surface-variant)' }}>
                  {isRunning
                    ? mode === 'browser'
                      ? `探索中 … ${elapsed}秒 / ${attempts}回試行`
                      : `最適化中 … ${elapsed}秒`
                    : '生成完了'}
                </span>
                <span style={{ fontSize: '13px', fontFamily: 'var(--md-font-mono)', color: 'var(--md-primary)' }}>{Math.round(progress)}%</span>
              </div>
              <div style={{ height: '6px', borderRadius: 'var(--md-shape-full)', background: 'var(--md-surface-container-high)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 'var(--md-shape-full)',
                  background: status === 'done' ? 'var(--md-primary)' : 'var(--md-secondary)',
                  width: `${progress}%`,
                  transition: isRunning ? 'width 0.5s ease' : 'width 0.3s ease',
                }} />
              </div>
            </div>
          )}

          {/* エラー表示 */}
          {status === 'error' && (
            <div style={{
              background: 'var(--md-error-container)', color: 'var(--md-on-error-container)',
              borderRadius: 'var(--md-shape-md, 12px)', padding: '0.875rem 1rem',
              fontSize: '13px', whiteSpace: 'pre-wrap', lineHeight: 1.6,
            }}>
              <div style={{ fontWeight: 600, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>warning</span>
                エラー
              </div>
              {errorMsg}
            </div>
          )}

          {/* 結果表示 */}
          {status === 'done' && result && (
            <div style={{
              background: 'var(--md-primary-container)', color: 'var(--md-on-primary-container)',
              borderRadius: 'var(--md-shape-md, 12px)', padding: '0.875rem 1rem',
            }}>
              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>
                生成完了
              </div>
              <div style={{ fontSize: '13px' }}>{result.message}</div>
            </div>
          )}

          {/* HiGHS モードの補足案内 */}
          {mode === 'highs' && status === 'idle' && (
            <div style={{
              background: 'var(--md-surface-container)', borderRadius: 'var(--md-shape-md, 12px)',
              padding: '0.75rem 1rem', fontSize: '12px', color: 'var(--md-on-surface-variant)',
              borderLeft: '3px solid var(--md-primary)',
            }}>
              <div style={{ fontWeight: 500, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>info</span>
                HiGHS（混合整数計画法）について
              </div>
              <div style={{ lineHeight: 1.6 }}>
                数学的に最適な教科配置を求めます。クラス・教科数が多い場合は探索時間が長くなります。
                時間内に最適解が見つからない場合は途中結果を返します。
              </div>
            </div>
          )}

          {/* アクションボタン */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            {isRunning ? (
              <button
                onClick={handleCancel}
                style={{
                  padding: '0.625rem 1.25rem', border: `1px solid var(--md-error)`,
                  borderRadius: 'var(--md-shape-full)', background: 'var(--md-error-container)',
                  color: 'var(--md-on-error-container)', cursor: 'pointer',
                  fontSize: '14px', fontWeight: 500, fontFamily: 'var(--md-font-brand)',
                }}
              >中断</button>
            ) : (
              <button
                onClick={onClose}
                style={{
                  padding: '0.625rem 1.25rem', border: `1px solid var(--md-outline-variant)`,
                  borderRadius: 'var(--md-shape-full)', background: 'transparent',
                  cursor: 'pointer', fontSize: '14px', fontWeight: 500,
                  color: 'var(--md-on-surface-variant)', fontFamily: 'var(--md-font-brand)',
                }}
              >キャンセル</button>
            )}

            {status === 'done' && result ? (
              <button
                onClick={handleApply}
                style={{
                  padding: '0.625rem 1.5rem', border: 'none',
                  borderRadius: 'var(--md-shape-full)', background: 'var(--md-primary)',
                  color: 'var(--md-on-primary)', cursor: 'pointer',
                  fontSize: '14px', fontWeight: 500, fontFamily: 'var(--md-font-brand)',
                }}
              >時間割に適用する</button>
            ) : !isRunning ? (
              <button
                onClick={handleRun}
                style={{
                  padding: '0.625rem 1.5rem', border: 'none',
                  borderRadius: 'var(--md-shape-full)', background: 'var(--md-primary)',
                  color: 'var(--md-on-primary)', cursor: 'pointer',
                  fontSize: '14px', fontWeight: 500, fontFamily: 'var(--md-font-brand)',
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>play_arrow</span>
                自動生成を開始
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default SolverPanel;
