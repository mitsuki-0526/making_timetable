import { useState } from 'react'
import { Play, Square, Check } from 'lucide-react'
import { useTimetableStore } from '@/store/useTimetableStore'
import { useSolverWorker } from '@/hooks/useSolverWorker'
import { buildSolverInput } from '@/domain/solver/buildSolverInput'
import { applySolverResult } from '@/domain/solver/applySolverResult'
import { ModalShell } from '../common/ModalShell'

type Props = {
  isOpen: boolean
  onClose: () => void
}

export function SolverPanel({ isOpen, onClose }: Props) {
  const store = useTimetableStore()
  const setTimetable = useTimetableStore((s) => s.setTimetable)
  const { running, progress, result, error, start, cancel } = useSolverWorker()

  const [mode, setMode] = useState<'full' | 'empty_only'>('empty_only')
  const [iterations, setIterations] = useState(100)

  const handleStart = () => {
    const input = buildSolverInput(store, mode)
    start(input, mode, iterations)
  }

  const handleApply = () => {
    if (!result) return
    const updated = applySolverResult(store.timetable, result, mode)
    setTimetable(updated)
    onClose()
  }

  return (
    <ModalShell title="ソルバー" isOpen={isOpen} onClose={onClose} width="600px" height="auto">
      <div>
        <h3 className="section-title">設定</h3>
        <div className="form-row">
          <div className="form-field">
            <label>適用モード</label>
            <select className="form-select" value={mode} onChange={(e) => setMode(e.target.value as 'full' | 'empty_only')} disabled={running}>
              <option value="empty_only">空きコマのみ埋める</option>
              <option value="full">全上書き（固定コマは保持）</option>
            </select>
          </div>
          <div className="form-field">
            <label>試行回数</label>
            <input
              className="form-input"
              type="number"
              min={10}
              max={1000}
              step={10}
              value={iterations}
              onChange={(e) => setIterations(Number(e.target.value))}
              style={{ width: 80 }}
              disabled={running}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12, marginBottom: 16 }}>
          {running ? (
            <button className="btn btn-danger" onClick={cancel}>
              <Square size={12} /> キャンセル
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleStart}>
              <Play size={12} /> 実行
            </button>
          )}
        </div>

        {/* 進捗表示 */}
        {running && progress && (
          <div style={{ background: '#f0f9ff', padding: 12, borderRadius: 6, marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: '#0369a1' }}>
              実行中... {progress.iteration} / {iterations} 試行
            </div>
            <div style={{ marginTop: 4 }}>
              <div style={{ background: '#e0e7ff', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                <div style={{ background: '#3b82f6', height: '100%', width: `${(progress.iteration / iterations) * 100}%`, transition: 'width 0.2s' }} />
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
              最良スコア: {progress.bestScore}
            </div>
          </div>
        )}

        {/* エラー */}
        {error && (
          <div style={{ background: '#fef2f2', color: '#dc2626', padding: 12, borderRadius: 6, fontSize: 12, marginBottom: 12 }}>
            エラー: {error}
          </div>
        )}

        {/* 結果 */}
        {result && (
          <div style={{ background: '#f0fdf4', padding: 12, borderRadius: 6, marginBottom: 12 }}>
            <h4 style={{ fontSize: 13, fontWeight: 600, color: '#065f46', marginBottom: 8 }}>結果</h4>
            <table className="data-table" style={{ marginTop: 0 }}>
              <tbody>
                <tr>
                  <td style={{ color: '#6b7280' }}>対象スロット</td>
                  <td style={{ fontWeight: 500 }}>{result.stats.totalSlots}コマ</td>
                </tr>
                <tr>
                  <td style={{ color: '#6b7280' }}>配置成功</td>
                  <td style={{ fontWeight: 500 }}>{result.stats.filledSlots}コマ</td>
                </tr>
                <tr>
                  <td style={{ color: '#6b7280' }}>充足率</td>
                  <td style={{ fontWeight: 500 }}>
                    {result.stats.totalSlots > 0
                      ? `${Math.round((result.stats.filledSlots / result.stats.totalSlots) * 100)}%`
                      : '—'
                    }
                  </td>
                </tr>
                <tr>
                  <td style={{ color: '#6b7280' }}>経過時間</td>
                  <td style={{ fontWeight: 500 }}>{(result.stats.elapsedMs / 1000).toFixed(1)}秒</td>
                </tr>
                <tr>
                  <td style={{ color: '#6b7280' }}>教員割当済み</td>
                  <td style={{ fontWeight: 500 }}>
                    {result.assignments.filter((a) => a.teacher_id !== null).length} /
                    {result.assignments.length}コマ
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={handleApply}>
                <Check size={12} /> 結果を適用
              </button>
              <button className="btn btn-secondary" onClick={handleStart}>
                再実行
              </button>
            </div>
          </div>
        )}

        {!running && !result && !error && (
          <p className="empty-state">
            ランダムグリーディ法で時間割を自動配置します。<br />
            複数回の試行から最良の結果を選択します。
          </p>
        )}
      </div>
    </ModalShell>
  )
}
