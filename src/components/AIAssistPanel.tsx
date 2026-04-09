import { useState } from 'react'
import { Bot, Loader2, RefreshCw, Settings, Wand2 } from 'lucide-react'
import { useTimetableStore } from '@/store/useTimetableStore'
import { exportState } from '@/domain/serialization'
import { importState } from '@/domain/serialization'
import { callGemini, getApiKey, setApiKey, getModel, setModel, testConnection } from '@/lib/gemini'
import type { GeminiModel } from '@/lib/gemini'
import { ModalShell } from './common/ModalShell'

const MODEL_OPTIONS: { value: GeminiModel; label: string }[] = [
  { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite（高速・低コスト）' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash（バランス型）' },
  { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash（安定版）' },
]

type Props = {
  isOpen: boolean
  onClose: () => void
}

export function AIAssistPanel({ isOpen, onClose }: Props) {
  const store = useTimetableStore()
  const [apiKey, setApiKeyState] = useState(getApiKey() ?? '')
  const [model, setModelState] = useState(getModel())
  const [showSettings, setShowSettings] = useState(!getApiKey())
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [testResult, setTestResult] = useState<boolean | null>(null)

  const handleSaveSettings = () => {
    setApiKey(apiKey)
    setModel(model)
    setShowSettings(false)
  }

  const handleTest = async () => {
    setApiKey(apiKey)
    setModel(model)
    setTestResult(null)
    setLoading(true)
    try {
      const ok = await testConnection()
      setTestResult(ok)
    } finally {
      setLoading(false)
    }
  }

  const buildStatePrompt = () => {
    const state = exportState({
      teachers: store.teachers,
      teacher_groups: store.teacher_groups,
      timetable: store.timetable,
      structure: store.structure,
      settings: store.settings,
      cell_groups: store.cell_groups,
      fixed_slots: store.fixed_slots,
      subject_constraints: store.subject_constraints,
      subject_placements: store.subject_placements,
      subject_pairings: store.subject_pairings,
      class_groups: store.class_groups,
      facilities: store.facilities,
      subject_facilities: store.subject_facilities,
      teacher_constraints: store.teacher_constraints,
      alt_week_pairs: store.alt_week_pairs,
      subject_sequences: store.subject_sequences,
      cross_grade_groups: store.cross_grade_groups,
    })
    return JSON.stringify(state, null, 2)
  }

  const [generatedJson, setGeneratedJson] = useState<string | null>(null)

  const handleReview = async () => {
    setLoading(true)
    setError('')
    setResult('')
    setGeneratedJson(null)
    try {
      const stateJson = buildStatePrompt()
      const prompt = `あなたは中学校の時間割作成のエキスパートです。以下のJSON形式の時間割データを分析し、問題点と改善提案を日本語で簡潔にまとめてください。

重点チェック項目:
1. 教員の過負荷（コマ数偏り）
2. 教科の規定時数との差異
3. 教員の配置不可時間の違反
4. 非常勤教員の出勤日制約
5. 施設の同時使用超過
6. その他の改善提案

時間割データ:
${stateJson}`

      const response = await callGemini(prompt)
      setResult(response)
    } catch (e) {
      setError(e instanceof Error ? e.message : '不明なエラー')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async () => {
    setLoading(true)
    setError('')
    setResult('')
    setGeneratedJson(null)
    try {
      const stateJson = buildStatePrompt()
      const prompt = `あなたは中学校の時間割作成のエキスパートです。以下のJSON形式のマスタデータ（教員、クラス、教科、制約）を元に、timetableフィールドを埋めた時間割草案をJSON形式で生成してください。

重要な制約:
1. 各クラスの教科は規定時数を満たすこと
2. 同一教員が同日同時限に複数クラスに配置されないこと
3. 教員の配置不可時間を遵守すること
4. 非常勤教員は出勤可能日のみ配置すること
5. 固定コマは変更しないこと

出力形式: 元のJSONの全フィールドをそのまま返し、timetableフィールドのみを新しいエントリで埋めてください。
JSON以外のテキストは出力しないでください。コードブロックのマークダウン記法も不要です。

マスタデータ:
${stateJson}`

      const response = await callGemini(prompt)

      // JSONを抽出（コードブロック記法を除去）
      let jsonStr = response.trim()
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      }

      setGeneratedJson(jsonStr)
      setResult('時間割草案を生成しました。内容を確認して「適用」ボタンで反映してください。')
    } catch (e) {
      setError(e instanceof Error ? e.message : '不明なエラー')
    } finally {
      setLoading(false)
    }
  }

  const handleApplyGenerated = () => {
    if (!generatedJson) return
    try {
      const parsed = JSON.parse(generatedJson)
      const result = importState(parsed)
      if (!result.success) {
        setError(`適用エラー: ${result.error}`)
        return
      }
      useTimetableStore.setState({ ...result.data } as Parameters<typeof useTimetableStore.setState>[0])
      setResult('時間割草案を適用しました。')
      setGeneratedJson(null)
    } catch {
      setError('AIの出力をJSONとして解析できませんでした。再生成をお試しください。')
    }
  }

  return (
    <ModalShell title="AI支援" isOpen={isOpen} onClose={onClose} height="auto">
      {showSettings ? (
        <div>
          <h3 className="section-title">API設定</h3>
          <div className="form-field" style={{ marginBottom: 8 }}>
            <label>Gemini APIキー</label>
            <input
              className="form-input"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKeyState(e.target.value)}
              placeholder="AIza..."
              style={{ width: '100%' }}
            />
          </div>
          <div className="form-field" style={{ marginBottom: 12 }}>
            <label>モデル</label>
            <select className="form-select" value={model} onChange={(e) => setModelState(e.target.value as GeminiModel)}>
              {MODEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={handleSaveSettings} disabled={!apiKey}>保存</button>
            <button className="btn btn-secondary" onClick={handleTest} disabled={loading || !apiKey}>
              {loading ? <><Loader2 size={12} className="spin" /> テスト中...</> : '接続テスト'}
            </button>
            {testResult !== null && (
              <span style={{ fontSize: 12, color: testResult ? '#10b981' : '#dc2626', alignSelf: 'center' }}>
                {testResult ? '接続成功' : '接続失敗'}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={handleReview} disabled={loading}>
                {loading ? <><Loader2 size={12} /> 処理中...</> : <><Bot size={12} /> レビュー</>}
              </button>
              <button className="btn btn-secondary" onClick={handleGenerate} disabled={loading} style={{ background: '#f5f3ff', color: '#7c3aed' }}>
                <Wand2 size={12} /> 自動生成
              </button>
            </div>
            <button className="btn btn-secondary" onClick={() => setShowSettings(true)}>
              <Settings size={12} /> API設定
            </button>
          </div>

          {error && (
            <div style={{ background: '#fef2f2', color: '#dc2626', padding: 8, borderRadius: 6, fontSize: 12, marginBottom: 8 }}>
              {error}
              <button className="btn btn-secondary" onClick={handleReview} style={{ marginLeft: 8 }}>
                <RefreshCw size={10} /> リトライ
              </button>
            </div>
          )}

          {result && (
            <div style={{ background: '#f9fafb', padding: 12, borderRadius: 6, fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {result}
            </div>
          )}

          {generatedJson && (
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={handleApplyGenerated}>
                草案を適用
              </button>
              <button className="btn btn-secondary" onClick={() => setGeneratedJson(null)}>
                破棄
              </button>
            </div>
          )}

          {!result && !error && !loading && (
            <p className="empty-state">
              「レビュー」で時間割を分析、「自動生成」でAIが草案を作成します
            </p>
          )}
        </div>
      )}
    </ModalShell>
  )
}
