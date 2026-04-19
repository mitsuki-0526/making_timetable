# Gemini AI連携

> 対応ソースコード: `src/lib/gemini.js`

## このファイルの役割

このファイルは、Google の「Gemini」という最新のAI（人工知能）と通信するための道具です。
郵便局の窓口をイメージしてください：
- **手紙を書く** → 質問を作成
- **窓口に出す** → AIに送信
- **返事が来る** → AIから回答を受け取る

このファイルは以下の3つの主な役割を担当しています：

1. **AIとの通信**：質問をAIに送って、回答を受け取る
2. **セキュリティ管理**：APIキー（アクセス用の暗証番号）を安全に保存・管理
3. **質問の作成**：「時間割をレビューしてください」「時間割を自動生成してください」という詳しい質問を組み立てる

---

## 主な機能

### callGemini --- Gemini AIに問い合わせる

- **何をするか**: 質問をGemini AIに送信し、回答を受け取ります。
- **ソースコード**: `src/lib/gemini.js` 行37-80
- **パラメータ**:
  - `apiKey`: Google APIキー（または プロキシURL）
  - `prompt`: AIに送る質問文
- **返す値**: AIからの回答テキスト
- **エラー処理**: APIキーがない、ネットワークエラー、APIの制限に達したなど、問題があれば詳しいエラーメッセージを返します
- **パフォーマンス設定**:
  - 温度（temperature）: 0.4（やや控えめ、回答がブレにくい）
  - 最大出力文字数: 8192文字
- **プロキシ対応**: 学校のセキュリティポリシーの関係で、直接Google APIに接続できない場合は、中継サーバー（プロキシ）を使って通信することもできます。

### testApiKey --- API接続をテストする

- **何をするか**: Google APIキーが正しく機能しているか確認します。実際にAIに「接続テスト成功」と返答させることで、疎通を確認。
- **ソースコード**: `src/lib/gemini.js` 行83-86
- **パラメータ**: `apiKey`: テストするGoogle APIキー
- **返す値**: テスト成功時は「接続テスト成功」という文字列
- **使用場面**: 【基礎構成】→【AI設定】タブで、ユーザーがAPIキーを入力したときに「接続テスト」ボタンを押して実行
- **関連ファイル**: [基礎構成画面](../components/SettingsModal.md#AI設定タブ) — ここから呼ばれる

---

## プロンプト（質問文）の作成

### buildReviewPrompt --- レビュー用の質問文を作る

- **何をするか**: 作成された時間割を「AIに評価してもらうための質問文」を組み立てます。
- **ソースコード**: `src/lib/gemini.js` 行95-155
- **パラメータ**:
  - `teachers`: 先生のリスト
  - `structure`: 学校の構成（学年・クラス情報）
  - `timetable`: 現在の時間割データ
  - `subject_constraints`: 教科の制約（連続日数上限など）
- **質問の内容**:
  ```
  あなたは日本の中学校の時間割作成の専門家です。以下の時間割を分析し、
  問題点と改善提案を日本語で報告してください。
  ```
  その後、以下の項目をAIに提示します：
  - 各先生の担当状況（何の教科を何コマ担当しているか）
  - 各クラスの時間割表（曜日・時限ごとの教科と先生）
  - 連続日数制約（「国語は3日以上連続配置禁止」など）
  
  分析観点：
  1. 先生の授業負担のバランス
  2. クラスごとの教科配置バランス（午前・午後、週前半・後半の偏り）
  3. 未設定のコマがあるか
  4. 連続日数制約に違反していないか
  5. その他の問題と改善提案

- **返す値**: レビュー用の質問文（長めのテキスト）
- **使用場面**: ユーザーが「時間割をAIレビューする」ボタンを押したときに実行される
- **関連ファイル**: [AI支援パネル](../components/AIAssistPanel.md#レビュー機能) — ここから呼ばれる

### buildGenerationPrompt --- 時間割生成用の質問文を作る

- **何をするか**: 「時間割を自動生成してもらうための質問文」を組み立てます。
- **ソースコード**: `src/lib/gemini.js` 行158-209
- **パラメータ**:
  - `teachers`: 先生のリスト
  - `structure`: 学校の構成と規定時数
  - `settings`: 設定（特支連動ルールなど）
  - `subject_constraints`: 教科の制約
- **質問の内容**:
  ```
  あなたは日本の中学校の時間割作成の専門家AIです。以下の制約をすべて満たす
  時間割の草案をJSON形式で生成してください。
  ```
  その後、以下の情報をAIに提示します：
  - クラス一覧（全学年全クラス）
  - 規定授業時数（各クラス・各教科が週に何コマ必要か）
  - 先生リスト（得意な教科、対応学年、配置不可時間）
  - 特別支援学級の連動ルール
  - 連続配置制約
  
  守るべきルール：
  - 各先生は同じ日同じ時限に1クラスのみ担当可能
  - 配置不可時間に配置してはいけない
  - 各クラスの各教科は規定時数ちょうどになるように配置
  - 特別支援学級は全学年の先生が担当可能
  
  出力形式：
  ```json
  [
    {"day_of_week":"月","period":1,"grade":1,"class_name":"1組","subject":"国語","teacher_id":"T01",...},
    ...
  ]
  ```
  のようなJSON配列のみ返す

- **返す値**: 生成用の質問文
- **使用場面**: ユーザーが「AIで時間割を自動生成」ボタンを押したときに実行される
- **関連ファイル**: [AI支援パネル](../components/AIAssistPanel.md#自動生成機能) — ここから呼ばれる

---

## AIの回答を解析する

### parseGeneratedTimetable --- AIの回答を解析する

- **何をするか**: AIが返してきた回答（文字列）を、アプリで使えるJSON形式に変換・検証します。
- **ソースコード**: `src/lib/gemini.js` 行212-234
- **パラメータ**: `responseText`: AIからの回答テキスト
- **処理内容**:
  1. マークダウン記号（```json...```）を削除してクリーンアップ
  2. JSON配列を抽出
  3. JSON形式として正しいかパース
  4. 必須フィールドをチェック（day_of_week, period, grade, class_name, subject など）
  5. エラーがあれば詳しいエラーメッセージを返す

- **返す値**: パースされたエントリの配列
  ```javascript
  [
    {day_of_week: "月", period: 1, grade: 1, class_name: "1組", subject: "国語", teacher_id: "T01", ...},
    {day_of_week: "月", period: 2, grade: 1, class_name: "1組", subject: "数学", teacher_id: "T02", ...},
    ...
  ]
  ```

- **エラー処理**: JSONが見つからない、形式が間違っている、必須フィールドが不足しているなど、詳しいエラーメッセージを返す
- **使用場面**: AIが生成した時間割をアプリに適用する前に、データが正しいかチェックするときに実行
- **次のステップ**: パースに成功したら、[時間割データの倉庫](./useTimetableStore.md#setGeneratedTimetable-AI生成の時間割を適用する) の `setGeneratedTimetable()` が呼ばれて、アプリに時間割が反映されます。

---

## APIキー・モデル設定の保存・取得

### getStoredApiKey / setStoredApiKey --- APIキーの保存・取得

- **何をするか**: Google APIキーをブラウザのローカルストレージ（パソコンの記憶領域）に保存・取得します。
- **ソースコード**: 
  - `getStoredApiKey`: `src/lib/gemini.js` 行27
  - `setStoredApiKey`: `src/lib/gemini.js` 行28-34
- **セキュリティ注意**:
  - APIキーはブラウザのローカルストレージに保存されます（パソコンの記憶領域）
  - これは**個人用パソコン専用**です。学校の共用パソコンで使う場合は、毎回APIキーを入力してください
  - APIキーを誰かに教えないでください（その人があなたのGoogle APIを勝手に使えるようになります）
  - 学校のセキュリティ方針に従ってください

- **返す値**: 
  - `getStoredApiKey`: 保存されているAPIキー（なければ空文字列）
  - `setStoredApiKey`: なし（保存されるだけ）

### getStoredModel / setStoredModel --- モデル設定の保存・取得

- **何をするか**: どのGeminiモデル（バージョン）を使うか、ブラウザに保存・取得します。
- **ソースコード**: 
  - `getStoredModel`: `src/lib/gemini.js` 行18
  - `setStoredModel`: `src/lib/gemini.js` 行19-25
- **利用可能なモデル**:
  | モデル名 | 推奨度 | 説明 |
  |---------|------|------|
  | gemini-2.0-flash-lite | ⭐推奨 | 最速、実用的な精度 |
  | gemini-2.0-flash | | 少し遅いが高性能 |
  | gemini-1.5-flash | | 標準的なバージョン |
  | gemini-1.5-flash-8b | | 軽量、無料枠が多い |
  | gemini-1.5-pro | | 最高性能だが制限が厳しい |

- **使用例**: 
  ```javascript
  setStoredModel('gemini-2.0-flash-lite');  // 最速モデルを選ぶ
  const model = getStoredModel();            // 現在のモデルを取得（デフォルトは gemini-2.0-flash-lite）
  ```

-- **関連ファイル**: [基礎構成画面](../components/SettingsModal.md#AI設定タブ) — ここで選択可能

---

## 定数・設定値

### DEFAULT_GEMINI_MODEL
- **値**: `'gemini-2.0-flash-lite'`
- **意味**: デフォルトで使用するGeminiモデル

### AVAILABLE_MODELS
- **値**: モデル選択肢の配列
- **含まれる情報**: id（モデル名）、name（日本語表示名）、recommended（推奨フラグ）

### GEMINI_API_BASE
- **値**: `'https://generativelanguage.googleapis.com/v1beta/models'`
- **意味**: Google Gemini APIのベースURL。ここに `/モデル名:generateContent?key=APIキー` を付けてリクエストを送ります。

---

## 通信の流れ（図解）

```
1. ユーザーが「AIレビュー」ボタンをクリック
   ↓
2. buildReviewPrompt() が詳しい質問文を作成
   ↓
3. callGemini(apiKey, question) が Google Gemini API に送信
   ↓
4. Google の サーバー で AI が処理（数秒〜数十秒かかる）
   ↓
5. AI の回答がブラウザに返ってくる
   ↓
6. 回答を画面に表示（例：時間割チェック画面に「問題点」と「改善提案」が表示される）
```

※ 自動生成の場合：
```
1. ユーザーが「AIで自動生成」ボタンをクリック
   ↓
2. buildGenerationPrompt() が生成用の質問文を作成
   ↓
3. callGemini() が Google に送信
   ↓
4. AI が JSON形式の時間割を生成
   ↓
5. parseGeneratedTimetable() が JSON を解析・検証
   ↓
6. setGeneratedTimetable() がアプリに時間割を適用
   ↓
7. 画面に新しい時間割が表示される
```

---

## 関連するファイル

- **[基礎構成画面](../components/SettingsModal.md#AI設定タブ)** — APIキー入力、モデル選択、接続テストをここから実行
- **[AI支援パネル](../components/AIAssistPanel.md)** — レビュー機能、自動生成機能を提供
- **[時間割データの倉庫](./useTimetableStore.md#setGeneratedTimetable-AI生成の時間割を適用する)** — parseGeneratedTimetable() の結果を setGeneratedTimetable() で適用
- **[ローカルAI連携](./localLLM.md)** — ローカルLLMの選択肢もあります（Geminiの代替）
