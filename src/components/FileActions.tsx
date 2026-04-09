import { useRef } from 'react'
import { FileDown, FileUp } from 'lucide-react'
import { useTimetableStore } from '@/store/useTimetableStore'
import { exportState } from '@/domain/serialization'
import { importState } from '@/domain/serialization'
import { convertV1toV2 } from '@/domain/serialization/convertV1toV2'

/**
 * JSON保存・読込コンポーネント
 * - 保存: File System Access API対応なら上書き保存、非対応ならダウンロード
 * - 読込: JSONファイルを読み込んでストア復元
 */
export function FileActions() {
  const fileHandleRef = useRef<FileSystemFileHandle | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const store = useTimetableStore()

  const getExportData = () => {
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

  const handleSave = async () => {
    const json = getExportData()

    // File System Access API対応チェック
    if ('showSaveFilePicker' in window && fileHandleRef.current) {
      try {
        const writable = await fileHandleRef.current.createWritable()
        await writable.write(json)
        await writable.close()
        return
      } catch {
        // フォールバック
      }
    }

    // File System Access API で新規保存
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as unknown as { showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle> })
          .showSaveFilePicker({
            suggestedName: 'timetable.json',
            types: [{ description: '時間割データ', accept: { 'application/json': ['.json'] } }],
          })
        fileHandleRef.current = handle
        const writable = await handle.createWritable()
        await writable.write(json)
        await writable.close()
        return
      } catch {
        // ユーザーがキャンセルした場合
        return
      }
    }

    // フォールバック: ダウンロード
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'timetable.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleLoad = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      let result = importState(parsed)

      // v2形式で失敗した場合、v1形式からの変換を試みる
      if (!result.success) {
        const convertResult = convertV1toV2(parsed)
        if (convertResult.success) {
          result = { success: true, data: convertResult.data }
        } else {
          alert(`読込エラー: ${result.error}\n\n旧版変換も失敗: ${convertResult.error}`)
          return
        }
      }

      // ストアに反映
      useTimetableStore.setState(result.data)
    } catch {
      alert('JSONの解析に失敗しました。ファイルの形式を確認してください。')
    }

    // inputをリセット（同じファイルを再選択可能にする）
    e.target.value = ''
  }

  return (
    <>
      <button className="header-btn" onClick={handleSave}>
        <FileDown size={14} /> 保存
      </button>
      <button className="header-btn" onClick={handleLoad}>
        <FileUp size={14} /> 読込
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </>
  )
}
