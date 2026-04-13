# 追加・変更要件一覧（70bc08a 以降）

コミット `70bc08a863f5d5b9079b64aac9e2106bb24cd3ab` 以降に実装した機能・修正の要件まとめ。

---

## 1. 自動生成ソルバーの改善

### 1-1. グリーディソルバー（jsSolver.worker.js）

- 探索時間を 5秒・10秒・30秒・1分・2分 から選択できるようにする
- ソルバーはグリーディ法のみとし、ユーザーに見えるモード切替は行わない
- **配置可能曜日制限（`allowed_days`）**：教科ごとに配置できる曜日を制限する（例：技術は水曜のみ）
- **連続配置ペア（`subject_sequences`）**：教科Aの直後の時限に教科Bを連続で配置する。ペア数は `min(教科Aのコマ数, 教科Bのコマ数)` とし、余剰分はソロタスクとして通常配置する

### 1-2. SolverPanel UI

- モード選択なし、常にグリーディ法を使用
- 探索時間のチップ選択UI（デフォルト30秒）
- 「空きコマのみ埋める」「全て上書き」の2モードを切替できる
- 進捗表示（配置率%・試行回数・経過時間）
- エラー発生時は詳細なエラーメッセージを表示する（`e.message`・ファイル名・行番号を含む）

---

## 2. Excel出力（FileActions.jsx）

- 「Excel出力」ボタンを追加（紫色）
- `.xlsx` ファイルを1ファイルで出力し、以下の2シートを含む：
  - **シート1「時間割」**：クラスごとの時間割グリッド（教科名のみ・先生名なし、隔週授業は `A:教科名 / B:教科名` 形式）
  - **シート2「先生コマ数」**：先生名・担当教科・週合計・曜日×時限ごとの配置コマ数
- ファイル名は `時間割_YYYYMMDD.xlsx` 形式
- xlsx ライブラリは動的インポート（`import('xlsx')`）で読み込み、初回クリック時のみバンドルを取得する

---

## 3. 先生コマ数一覧（TeacherScheduleGrid.jsx）

- 先生の行をドラッグ＆ドロップで並び替えできるようにする
- ☰ アイコンをドラッグハンドルとして表示
- ドラッグ中の行は半透明（opacity: 0.4）、ドロップ先の行は青枠でハイライト

---

## 4. 設定モーダル（SettingsModal.jsx）

- タブを切り替えてもモーダルのウィンドウサイズが変わらないようにする
- モーダル全体の高さを `height: 90vh` で固定する
- モーダル本体（`.modal-body`）に `flex: 1; min-height: 0` を付与してスクロール可能にする

---

## 5. 条件設定モーダル（ConstraintsModal.jsx）

### 「連続配置」タブを追加（タブ⑦）

- 教科A → 教科B の連続配置ペアを登録・削除できる
- 学年・クラス（未選択 = 学年全体）・教科A・教科B を選択して追加
- 登録済みペアを一覧表示し、削除ボタンで削除できる

### 「配置可能曜日」UI

- 教科配置制約タブ内で、各教科の配置可能曜日をチェックボックスで選択できる

---

## 6. データ保存（FileActions.jsx）

JSON保存時に以下のフィールドをすべて含める：

| フィールド | 説明 |
|---|---|
| `teachers` | 教員マスタ |
| `teacher_groups` | 教員グループ |
| `class_groups` | 合同クラス定義 |
| `structure` | 学年・クラス構成・規定時数 |
| `timetable` | コマ配置データ |
| `settings` | 特支連動・昼休み設定 |
| `subject_constraints` | 教科別連続日数上限 |
| `subject_pairings` | 抱き合わせ教科ペア |
| `cell_groups` | 合同コマグループ |
| `fixed_slots` | 固定コマ |
| `teacher_constraints` | 教員制約 |
| `subject_placement` | 教科配置制約（許可曜日・時限・午後制限） |
| `facilities` | 施設マスタ |
| `subject_facility` | 教科→施設マッピング |
| `alt_week_pairs` | 隔週授業ペア |
| `cross_grade_groups` | 学年横断合同授業 |
| `subject_sequences` | **連続配置ペア（追加）** |

---

## 7. UIリニューアル全般

- アイコンをSVGインラインから Google Material Symbols（`<span class="material-symbols-outlined">`）に統一
- セルの「合同」ラベルを削除（cell_group_id による視覚的グループ化は維持）
- CellDropdown・TimetableGrid・ValidationPanel などの表示を整理

---

## 8. Zustandストアへの追加フィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `subject_sequences` | 配列 | 連続配置ペア `[{ id, grade, class_name, subject_a, subject_b }]`（`class_name=null` で学年全体） |

追加するアクション：

- `addSubjectSequence(seq)` — 新しいペアを追加（`id` は `SEQ${Date.now()}` で自動生成）
- `removeSubjectSequence(id)` — 指定IDのペアを削除

JSON読込時（`loadFromJson`）に `subject_sequences` を復元する。
