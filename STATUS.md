# 時間割作成ツール — 現状ドキュメント

最終更新: 2026-04-18

---

## 概要

Vite + React で構築した中学校向け時間割作成 SPA。
GitHub Pages にデプロイ済み。状態管理は Zustand。

- **リポジトリ**: `C:\Users\20020\making_timetable`
- **デプロイ先**: GitHub Pages（`/making_timetable/` ベース）
- **デプロイコマンド**: `npm run deploy`

---

## ファイル構成

```
src/
├── App.jsx                    # ルートコンポーネント（ヘッダー・メインレイアウト）
├── main.jsx
├── store/
│   └── useTimetableStore.js   # Zustand ストア（全状態・アクション）
├── components/
│   ├── TimetableGrid.jsx      # メイン時間割グリッド（Ctrl+クリック選択・合同グループ化）
│   ├── CellDropdown.jsx       # セル編集ドロップダウン（教科・教員選択・右クリックメニュー）
│   ├── TeacherScheduleGrid.jsx# 先生ごとのコマ数表示
│   ├── ValidationPanel.jsx    # バリデーション（連続日数違反・未設定コマ等）
│   ├── SettingsModal.jsx      # 基礎構成モーダル（教員・クラス・教科・各種ルール設定）
│   ├── FileActions.jsx        # JSON保存・読込（File System Access API 対応）
│   ├── PdfExport.jsx          # PDF出力（新規ウィンドウ + window.print()）
│   └── AIAssistPanel.jsx      # AI支援パネル（Gemini API 連携）
└── lib/
    └── gemini.js              # Gemini API ユーティリティ・プロンプトビルダー
```

---

## ストアの状態 (`useTimetableStore`)

| フィールド | 型 | 説明 |
|---|---|---|
| `teachers` | `Teacher[]` | 教員マスタ |
| `teacher_groups` | `TeacherGroup[]` | 道徳・総合等の教員グループ |
| `class_groups` | `ClassGroup[]` | 合同クラス定義（分割教科あり） |
| `structure` | `Structure` | 学年・クラス構成・規定時数 |
| `timetable` | `TimetableEntry[]` | コマ配置データ |
| `subject_constraints` | `object` | 教科別の連続授業日数上限 |
| `subject_pairings` | `SubjectPairing[]` | 抱き合わせ教科設定 |
| `cell_groups` | `CellGroup[]` | 合同コマグループ（`{id}`） |
| `settings` | `object` | 午後開始時限など |

### TimetableEntry の主要フィールド

```js
{
  day_of_week,    // '月'〜'金'
  period,         // 1〜6
  grade,          // 学年（数値）
  class_name,     // クラス名（文字列）
  teacher_id,     // A週担当教員ID（または通常担当）
  subject,        // A週教科（または通常教科）
  alt_teacher_id, // B週担当教員ID（隔週授業）
  alt_subject,    // B週教科（隔週授業）
  teacher_group_id, // 教員グループID（道徳等）
  cell_group_id,  // 合同コマグループID（複数クラス合同授業）
}
```

---

## 主な機能

### 新UIのセル編集（App.tsx / Inspector.tsx / WeekGrid.tsx / MatrixView.tsx）
- 週表示・マトリクス表示とも、セルを選択して右側の「詳細」パネルから教科・担当・B週設定・グループ担当を編集できる
- 週表示とマトリクス表示の両方で、Ctrl/Cmd+クリックによる複数セル選択に対応
- 複数選択したセルは、右側の詳細パネルから合同コマとしてグループ化できる
- 既に合同コマに属しているセルは、右側の詳細パネルからグループ解除できる

### 時間割グリッド (`TimetableGrid.jsx`)
- 行＝クラス、列＝曜日×時限
- セルクリックで `CellDropdown` を開く（教科・教員をプルダウン選択）
- **Ctrl+クリック** で複数セル選択（青枠で強調）
- 選択中は上部にバナー表示「🔗 N セル選択中 右クリック → グループ化 ／ Esc で選択解除」
- **右クリック** → コンテキストメニューで「グループ化」「グループ解除」

### セルグループ（合同コマ）
- Ctrl+クリック → 右クリック → 「Nセルをグループ化」でグループ作成
- グループ内のセルは左枠に同色の太線で視覚的に区別（`GROUP_COLORS` 配列でローテーション）
- 🔗合同 バッジを表示
- `cell_group_id` はエントリ更新時（教科変更等）でも保持される（`preservedCellGroupId` パターン）
- TeacherScheduleGrid・PDF出力でも合同グループの全クラスを1スロットにまとめて表示

### 隔週授業（A週/B週）
- A週に教科をセット後、B週タブで別教科を登録
- `alt_subject` / `alt_teacher_id` フィールドに格納
- PDF出力では A/B 両方を同一セル内に表示（`[A]` `[B]` バッジ付き）

### 先生ごとのコマ数 (`TeacherScheduleGrid.jsx`)
- 表示形式：行＝先生、列＝週計 ＋ 月〜金 × 1〜6時限
- **コマ数カウントのロジック**: 「色がついているマスの個数」を数える
  → `getEntries(teacherId, day, period) !== null` のスロット数
  → 合同グループは1スロットで1カウント（クラス数ではない）
  → 教員グループ経由の割当も色付きマスに含まれるためカウント対象
- 役割別の色分け：
  - 青（`#EFF6FF`）: 主担当
  - 紫（`#F5F3FF`）: B週担当
  - 緑（`#D1FAE5`）: 教員グループ経由
  - 黄（`#FEF9C3`）: 合同グループ

### PDF出力 (`PdfExport.jsx`)
- 出力対象を選択するモーダル（時間割グリッド / 先生コマ数）
- `window.open('', '_blank')` で新規ウィンドウを開き `document.write` でHTMLを注入
- `window.print()` で印刷ダイアログ → 「PDFとして保存」でPDF化
- 用紙設定: A4横（`@page { size: A4 landscape; }`）
- 時間割: A週・B週の両方をセル内に表示
- 先生コマ数: `TeacherScheduleGrid` と同形式の大テーブルで出力

### AI支援 (`AIAssistPanel.jsx` + `gemini.js`)
- Gemini API（Google AI Studio）と連携
- 機能①: 時間割レビュー（問題点・改善提案をAIが分析）
- 機能②: 時間割自動生成（JSON形式で草案生成 → ストアに適用）
- APIキーは `localStorage` に保存
- **使用モデル**: `gemini-2.0-flash-lite`（無料枠あり）
- **エンドポイント**: `https://generativelanguage.googleapis.com/v1beta/models`

> **注意**: `gemini-1.5-flash` は廃止済み（v1/v1beta 両方）、`gemini-2.0-flash` は無料枠なし（有料プランのみ）。

### 抱き合わせ教科
- `subject_pairings` に設定した組み合わせは、片方を設定すると他方が自動でセットされる
- 自動生成ソルバーでも、既存時間割や連続配置で確定した教科から同時刻の相手クラスへ抱き合わせを伝播させる

### 自動生成ソルバー
- `subject_sequences` は残コマ数に応じて `min(教科A, 教科B)` 組だけ連続配置タスクを作り、余剰分は通常配置へ残す
- 非共有タスクは、教員候補が見つからない場合でも教科だけ先に配置し、探索終盤で教員割当を再試行する
- 教員割当では、同時刻重複と配置不可時間を守りつつ、必要なら日上限・週上限・連続上限を段階的に緩めて未割当を減らす
- repair フェーズでは、必要に応じて既存コマを別スロットへ退避して未配置タスクを差し込む
- 探索終盤に、同時刻の教員重複や教員グループ重複を検出し、別候補への差し替えを再試行する

### 基礎構成 (`SettingsModal.jsx`)
タブ構成：
1. **クラス設定** — 学年・クラスの追加・削除
2. **教科設定** — 教科の追加・削除・規定時数・連続日数制約
3. **教員設定** — 教員の追加・削除・インライン編集（名前・担当教科・対象学年）・配置不可時間
4. **教員グループ** — 道徳・総合等の複数教員グループ設定
5. **合同クラス** — 合同クラスと分割教科の設定
6. **抱き合わせ** — 教科の連動ペア設定
7. **AI設定** — Gemini APIキーの登録・接続テスト

### ファイル保存・読込 (`FileActions.jsx`)
- **新規保存（📥 保存）**: JSON をダウンロード
- **上書き保存（💾 上書保存）**: File System Access API 対応ブラウザで元ファイルに直接上書き
- **読込（📂 読込）**: JSONを読み込んでストア全体を復元
- 保存されるフィールド: `teachers`, `teacher_groups`, `class_groups`, `structure`, `timetable`, `settings`, `subject_constraints`, `subject_pairings`, `cell_groups`

---

## 既知の制限・注意事項

- File System Access API（上書き保存）は Chrome/Edge のみ対応（Safari/Firefox では通常ダウンロードのみ）
- PDF出力はブラウザのポップアップブロック設定によっては新規ウィンドウが開かない場合がある
- AI自動生成はあくまで草案であり、制約を完全に満たす保証はない（レビューモードの利用を推奨）
- セルグループ化はエントリが存在するセル（教科が設定済み）のみ対象

---

## 開発メモ

### よく使うコマンド
```bash
npm run dev          # ローカル開発サーバー起動
npm run build        # ビルドのみ
npm run deploy       # ビルド → GitHub Pages へデプロイ
```

### セルキーのフォーマット
```
"grade|class_name|day_of_week|period"
例: "1|1組|月|1"
```

### Gemini API の呼び出しポイント
- エンドポイント: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent`
- APIキーは URL クエリパラメータ `?key=...` で渡す
- APIキーは `localStorage` の `gemini_api_key` キーに保存
