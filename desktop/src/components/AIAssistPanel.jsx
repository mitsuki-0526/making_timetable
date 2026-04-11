import React, { useState } from 'react';
import { useTimetableStore } from '../store/useTimetableStore';
import {
  buildReviewPrompt,
  buildGenerationPrompt,
  parseGeneratedTimetable,
} from '../lib/gemini';
import { callLocalLLM, runSolver, getStoredOllamaUrl, getStoredModel } from '../lib/localLLM';

// マークダウン風テキストを簡易HTMLに変換して表示
const FormattedText = ({ text }) => {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div style={{ fontSize: '0.88rem', lineHeight: 1.75, color: '#1E293B' }}>
      {lines.map((line, i) => {
        if (/^#{1,3} /.test(line)) {
          const content = line.replace(/^#+\s/, '');
          return <p key={i} style={{ fontWeight: 700, fontSize: '0.95rem', margin: '0.8rem 0 0.2rem', color: '#0F172A' }}>{content}</p>;
        }
        if (/^[・\-\*] /.test(line)) {
          return (
            <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '3px' }}>
              <span style={{ color: '#6366F1', flexShrink: 0 }}>•</span>
              <span>{line.replace(/^[・\-\*] /, '')}</span>
            </div>
          );
        }
        if (line.trim() === '') return <div key={i} style={{ height: '0.5rem' }} />;
        return <p key={i} style={{ margin: '2px 0' }}>{line}</p>;
      })}
    </div>
  );
};

const AIAssistPanel = ({ onClose }) => {
  const {
    teachers, structure, timetable, settings, subject_constraints,
    fixed_slots, teacher_constraints, subject_placement,
    facilities, subject_facility, alt_week_pairs, cross_grade_groups,
    setGeneratedTimetable,
  } = useTimetableStore();
  const [activeTab, setActiveTab] = useState('solver'); // 'solver' | 'review' | 'generate'

  // --- レビュー状態 ---
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewResult, setReviewResult] = useState('');
  const [reviewError, setReviewError] = useState('');

  // --- 自動生成（LLM）状態 ---
  const [genLoading, setGenLoading] = useState(false);
  const [genResult, setGenResult] = useState(null);
  const [genRawText, setGenRawText] = useState('');
  const [genError, setGenError] = useState('');
  const [genApplied, setGenApplied] = useState(false);

  // --- ソルバー状態 ---
  const [solverLoading, setSolverLoading] = useState(false);
  const [solverResult, setSolverResult] = useState(null);
  const [solverError, setSolverError] = useState('');
  const [solverApplied, setSolverApplied] = useState(false);
  const [timeLimit, setTimeLimit] = useState(60);

  const ollamaUrl = getStoredOllamaUrl();
  const modelName = getStoredModel();

  // ---- レビュー実行 ----
  const handleReview = async () => {
    setReviewLoading(true);
    setReviewResult('');
    setReviewError('');
    try {
      const prompt = buildReviewPrompt(teachers, structure, timetable, subject_constraints);
      const result = await callLocalLLM(prompt);
      setReviewResult(result);
    } catch (e) {
      setReviewError(e.message);
    } finally {
      setReviewLoading(false);
    }
  };

  // ---- 自動生成実行 ----
  const handleGenerate = async () => {
    setGenLoading(true);
    setGenResult(null);
    setGenRawText('');
    setGenError('');
    setGenApplied(false);
    try {
      const prompt = buildGenerationPrompt(teachers, structure, settings, subject_constraints);
      const raw = await callLocalLLM(prompt);
      setGenRawText(raw);
      const parsed = parseGeneratedTimetable(raw);
      setGenResult(parsed);
    } catch (e) {
      setGenError(e.message);
    } finally {
      setGenLoading(false);
    }
  };

  // ---- 生成結果を適用 ----
  const handleApply = () => {
    if (!genResult) return;
    setGeneratedTimetable(genResult);
    setGenApplied(true);
  };

  // ---- 生成結果を破棄 ----
  const handleDiscard = () => {
    setGenResult(null);
    setGenRawText('');
    setGenApplied(false);
  };

  // ---- OR-Tools ソルバー実行 ----
  const handleSolve = async () => {
    setSolverLoading(true);
    setSolverResult(null);
    setSolverError('');
    setSolverApplied(false);
    try {
      const data = await runSolver({
        teachers,
        structure,
        subject_constraints: subject_constraints || {},
        settings: settings || {},
        fixed_slots: fixed_slots || [],
        teacher_constraints: teacher_constraints || {},
        subject_placement: subject_placement || {},
        facilities: facilities || [],
        subject_facility: subject_facility || {},
        alt_week_pairs: alt_week_pairs || [],
        cross_grade_groups: cross_grade_groups || [],
        time_limit: timeLimit,
      });
      setSolverResult(data);
    } catch (e) {
      setSolverError(e.message);
    } finally {
      setSolverLoading(false);
    }
  };

  const handleSolverApply = () => {
    if (!solverResult?.timetable) return;
    setGeneratedTimetable(solverResult.timetable);
    setSolverApplied(true);
  };

  const tabStyle = (tab) => ({
    flex: 1,
    padding: '0.75rem',
    border: 'none',
    background: activeTab === tab ? '#fff' : 'transparent',
    borderBottom: activeTab === tab ? '2px solid #6366F1' : '2px solid transparent',
    fontWeight: activeTab === tab ? 700 : 400,
    color: activeTab === tab ? '#4338CA' : '#64748B',
    cursor: 'pointer',
    fontSize: '0.9rem',
  });

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '680px', width: '95vw' }}>
        {/* ヘッダー */}
        <header className="modal-header" style={{ backgroundColor: '#F5F3FF', borderBottom: '1px solid #DDD6FE' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.3rem' }}>🤖</span>
            <h2 style={{ color: '#4338CA' }}>AI支援（ローカルLLM）</h2>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </header>

        {/* 接続先表示 */}
        <div style={{
          margin: '1rem 1rem 0',
          padding: '0.5rem 0.75rem',
          backgroundColor: '#EFF6FF',
          border: '1px solid #BFDBFE',
          borderRadius: '8px',
          fontSize: '0.82rem',
          color: '#1E40AF',
        }}>
          🖥 ローカル動作 | エンドポイント: <code>{ollamaUrl}</code> | モデル: <code>{modelName}</code>
        </div>

        {/* タブ */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', marginTop: '1rem' }}>
          <button style={tabStyle('solver')} onClick={() => setActiveTab('solver')}>
            ⚙️ OR-Tools最適化
          </button>
          <button style={tabStyle('review')} onClick={() => setActiveTab('review')}>
            📝 AIレビュー
          </button>
          <button style={tabStyle('generate')} onClick={() => setActiveTab('generate')}>
            ✨ AI生成
          </button>
        </div>

        {/* モーダル本体 */}
        <div className="modal-body">

          {/* ===== OR-Toolsソルバータブ ===== */}
          {activeTab === 'solver' && (
            <div>
              <p style={{ fontSize: '0.88rem', color: '#475569', marginBottom: '1rem' }}>
                OR-Tools CP-SAT ソルバーが<strong>必要コマ数・教員制約・固定コマ・教科配置制約</strong>をすべて考慮して
                最適な時間割を数理的に生成します。AIモデルは不要です。
              </p>

              {/* 設定 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', padding: '0.75rem', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>⏱ 計算時間上限</span>
                <select value={timeLimit} onChange={e => setTimeLimit(Number(e.target.value))}
                  style={{ padding: '0.35rem 0.6rem', borderRadius: '5px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}>
                  <option value={30}>30秒</option>
                  <option value={60}>60秒（推奨）</option>
                  <option value={120}>2分</option>
                  <option value={300}>5分</option>
                </select>
                <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>長いほど精度が上がりますが、60秒で十分な場合がほとんどです</span>
              </div>

              {/* 有効な制約の確認 */}
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', fontSize: '0.82rem', color: '#1E40AF' }}>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>✅ 現在有効な制約</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  <Tag label={`教科コマ数 (${Object.keys(subject_constraints || {}).length}教科)`} />
                  {(fixed_slots || []).length > 0 && <Tag label={`固定コマ ${fixed_slots.length}件`} color="#D1FAE5" text="#065F46" />}
                  {Object.keys(teacher_constraints || {}).length > 0 && <Tag label="教員制約あり" color="#D1FAE5" text="#065F46" />}
                  {Object.keys(subject_placement || {}).length > 0 && <Tag label="教科配置制約あり" color="#D1FAE5" text="#065F46" />}
                  {settings?.lunch_after_period && <Tag label={`昼休み: ${settings.lunch_after_period}限後`} />}
                </div>
              </div>

              {!solverResult && !solverApplied && (
                <button className="btn-primary" onClick={handleSolve} disabled={solverLoading}
                  style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', background: 'linear-gradient(135deg, #059669, #047857)' }}>
                  {solverLoading ? '⏳ 最適化計算中...' : '⚙️ 時間割を最適化生成する'}
                </button>
              )}

              {solverLoading && (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#059669' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⚙️</div>
                  OR-Tools が最適解を計算中です...<br />
                  <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginTop: '0.5rem' }}>クラス数・教科数に応じて {timeLimit} 秒まで計算します</div>
                </div>
              )}

              {solverError && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: '8px', color: '#991B1B', fontSize: '0.88rem', whiteSpace: 'pre-wrap' }}>
                  ❌ {solverError}
                  <button className="btn-primary" onClick={handleSolve}
                    style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.85rem', padding: '0.4rem 1rem' }}>
                    再試行
                  </button>
                </div>
              )}

              {solverResult && !solverApplied && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ padding: '0.75rem', background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.88rem', color: '#166534' }}>
                    ✅ <strong>{solverResult.count}コマ</strong>の最適化時間割が生成されました。適用しますか？
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button onClick={handleSolverApply}
                      style={{ flex: 1, padding: '0.65rem', background: '#059669', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
                      ✅ 適用する
                    </button>
                    <button onClick={() => setSolverResult(null)}
                      style={{ flex: 1, padding: '0.65rem', background: '#fff', color: '#64748B', border: '1px solid #CBD5E1', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' }}>
                      ❌ 破棄する
                    </button>
                  </div>
                </div>
              )}

              {solverApplied && (
                <div style={{ marginTop: '1rem', padding: '1rem', background: '#EFF6FF', border: '1px solid #93C5FD', borderRadius: '8px', textAlign: 'center', color: '#1E40AF' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🎉</div>
                  <strong>最適化時間割を適用しました。</strong>
                  <div style={{ fontSize: '0.85rem', marginTop: '0.4rem' }}>ValidationPanelで違反がないか確認してください。</div>
                  <button onClick={() => { setSolverResult(null); setSolverApplied(false); }}
                    style={{ marginTop: '0.75rem', padding: '0.4rem 1.2rem', background: '#fff', color: '#64748B', border: '1px solid #CBD5E1', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                    もう一度生成する
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ===== レビュータブ ===== */}
          {activeTab === 'review' && (
            <div>
              <p style={{ fontSize: '0.88rem', color: '#475569', marginBottom: '1rem' }}>
                現在の時間割データをローカルLLMが分析し、教員負担・教科バランス・改善提案をレポートします。
              </p>

              <button
                className="btn-primary"
                onClick={handleReview}
                disabled={reviewLoading}
                style={{ width: '100%', padding: '0.7rem', fontSize: '0.95rem' }}
              >
                {reviewLoading ? '⏳ 分析中...' : '🔍 AIにレビューを依頼する'}
              </button>

              {reviewLoading && (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#6366F1' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⏳</div>
                  ローカルLLMが時間割を分析しています...
                  <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginTop: '0.5rem' }}>
                    モデルサイズによって時間がかかる場合があります
                  </div>
                </div>
              )}

              {reviewError && (
                <div style={{
                  marginTop: '1rem', padding: '0.75rem',
                  backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5',
                  borderRadius: '8px', color: '#991B1B', fontSize: '0.88rem',
                  whiteSpace: 'pre-wrap',
                }}>
                  ❌ {reviewError}
                </div>
              )}

              {reviewResult && !reviewLoading && (
                <div style={{
                  marginTop: '1rem',
                  padding: '1rem',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  maxHeight: '420px',
                  overflowY: 'auto',
                }}>
                  <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginBottom: '0.5rem' }}>
                    ── ローカルLLMによる分析結果 ──
                  </div>
                  <FormattedText text={reviewResult} />
                </div>
              )}
            </div>
          )}

          {/* ===== 自動生成タブ ===== */}
          {activeTab === 'generate' && (
            <div>
              <div style={{
                marginBottom: '1rem', padding: '0.75rem',
                backgroundColor: '#FEF9C3', border: '1px solid #FDE68A',
                borderRadius: '8px', fontSize: '0.85rem', color: '#92400E',
              }}>
                ⚠ <strong>注意：</strong>
                AIが生成する時間割はあくまで<strong>草案</strong>です。制約を完全に満たさない場合があるため、
                適用後は必ず内容を確認・修正してください。
                現在の時間割は<strong>上書きされます</strong>（事前に保存を推奨）。
              </div>

              {!genResult && !genApplied && (
                <button
                  className="btn-primary"
                  onClick={handleGenerate}
                  disabled={genLoading}
                  style={{ width: '100%', padding: '0.7rem', fontSize: '0.95rem' }}
                >
                  {genLoading ? '⏳ 生成中（しばらくお待ちください）...' : '✨ 時間割を自動生成する'}
                </button>
              )}

              {genLoading && (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#6366F1' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>✨</div>
                  ローカルLLMが時間割を生成しています...
                  <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginTop: '0.5rem' }}>
                    クラス数・教科数、およびモデルサイズによって数分かかる場合があります
                  </div>
                </div>
              )}

              {genError && (
                <div style={{
                  marginTop: '1rem', padding: '0.75rem',
                  backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5',
                  borderRadius: '8px', color: '#991B1B', fontSize: '0.88rem',
                  whiteSpace: 'pre-wrap',
                }}>
                  <div style={{ marginBottom: '0.5rem' }}>❌ {genError}</div>
                  <button
                    className="btn-primary"
                    onClick={handleGenerate}
                    style={{ fontSize: '0.85rem', padding: '0.4rem 1rem' }}
                  >
                    再試行する
                  </button>
                </div>
              )}

              {/* 生成成功 → 確認・適用UI */}
              {genResult && !genApplied && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: '#DCFCE7',
                    border: '1px solid #86EFAC',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    fontSize: '0.88rem',
                    color: '#166534',
                  }}>
                    ✅ <strong>{genResult.length}コマ</strong>分の時間割が生成されました。
                    内容を確認して「適用する」か「破棄する」を選んでください。
                  </div>

                  {/* 生成内容プレビュー */}
                  <div style={{
                    maxHeight: '200px', overflowY: 'auto',
                    border: '1px solid #E2E8F0', borderRadius: '8px',
                    padding: '0.75rem', backgroundColor: '#F8FAFC',
                    fontSize: '0.78rem', color: '#475569',
                    marginBottom: '1rem',
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: '#0F172A' }}>生成内容プレビュー（最初の20コマ）</div>
                    {genResult.slice(0, 20).map((e, i) => (
                      <div key={i} style={{ padding: '1px 0' }}>
                        {e.grade}年{e.class_name} / {e.day_of_week}曜{e.period}限 / {e.subject}
                        {e.teacher_id ? ` / ${teachers.find(t => t.id === e.teacher_id)?.name || e.teacher_id}` : ' / 教員未定'}
                      </div>
                    ))}
                    {genResult.length > 20 && (
                      <div style={{ color: '#94A3B8', marginTop: '4px' }}>…他 {genResult.length - 20} コマ</div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      onClick={handleApply}
                      style={{
                        flex: 1, padding: '0.65rem',
                        backgroundColor: '#4F46E5', color: '#fff',
                        border: 'none', borderRadius: '6px',
                        fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem',
                      }}
                    >
                      ✅ 適用する
                    </button>
                    <button
                      onClick={handleDiscard}
                      style={{
                        flex: 1, padding: '0.65rem',
                        backgroundColor: '#fff', color: '#64748B',
                        border: '1px solid #CBD5E1', borderRadius: '6px',
                        cursor: 'pointer', fontSize: '0.9rem',
                      }}
                    >
                      ❌ 破棄する
                    </button>
                  </div>
                </div>
              )}

              {/* 適用完了メッセージ */}
              {genApplied && (
                <div style={{
                  marginTop: '1rem', padding: '1rem',
                  backgroundColor: '#EFF6FF', border: '1px solid #93C5FD',
                  borderRadius: '8px', textAlign: 'center', color: '#1E40AF',
                }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🎉</div>
                  <strong>時間割を適用しました。</strong>
                  <div style={{ fontSize: '0.85rem', marginTop: '0.4rem', color: '#3B82F6' }}>
                    グリッドを確認し、必要に応じて修正してください。
                  </div>
                  <button
                    onClick={handleDiscard}
                    style={{
                      marginTop: '0.75rem', padding: '0.4rem 1.2rem',
                      backgroundColor: '#fff', color: '#64748B',
                      border: '1px solid #CBD5E1', borderRadius: '6px',
                      cursor: 'pointer', fontSize: '0.85rem',
                    }}
                  >
                    もう一度生成する
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function Tag({ label, color = '#DBEAFE', text = '#1E40AF' }) {
  return (
    <span style={{ background: color, color: text, borderRadius: '12px', padding: '2px 10px', fontSize: '0.78rem', fontWeight: 600 }}>
      {label}
    </span>
  );
}

export default AIAssistPanel;
