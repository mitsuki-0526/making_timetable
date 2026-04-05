# プロジェクト定義：時間割作成アシストツール

## 1. プロジェクトの最終目標
学校現場における時間割作成業務を効率化するツールを開発する。
機密情報保護のため外部APIは使用せず（デフォルト）、ローカル環境で「AIによる条件の翻訳」「数理最適化ソルバーによる自動配置」「人間による直感的な微調整」を組み合わせたハイブリッド型システムを構築する。

---

## 2. プロジェクト構成（2バージョン並行開発）

```
making_timetable/          ← リポジトリルート
├── src/                   ← web版フロントエンド（React + Vite）
├── electron/              ← web版 Electron ラッパー
├── desktop/               ← デスクトップ版（本命・exe配布用）
│   ├── electron/          ← Electron メインプロセス
│   ├── python/            ← Python バックエンド
│   └── src/               ← デスクトップ版 React UI
└── docs/                  ← プロジェクトドキュメント
```

---

## 3. 技術スタック

### web版（making_timetable/ ルート）
| 役割 | 技術 |
|---|---|
| UI | React + Vite + Zustand |
| パッケージング | electron-builder（任意）/ GitHub Pages |
| AI | Gemma 3 (Ollama) / Gemini API（オプション切替） |

### デスクトップ版（desktop/）
| 役割 | 技術 |
|---|---|
| UI | React + Vite + Zustand |
| ネイティブウィンドウ | Electron |
| バックエンド | Python + FastAPI + uvicorn |
| AI（条件翻訳） | Gemma 4（llama-cpp-python によるローカル推論） |
| 最適化ソルバー | Google OR-Tools |
| exe化 | electron-builder（Electron側） |

> **Ollama不要:** デスクトップ版は `llama-cpp-python` を直接使用するため、Ollama のインストールは不要。単体 `.exe` として配布可能。

---

## 4. 処理フローと役割分担（デスクトップ版）

### フェーズ1：条件設定とAIインタビュアー
* **標準条件（UIで制御）:** 先生の出勤不可曜日・最大授業数等をUIで入力。
* **イレギュラー条件（AIが担当）:** 特殊な要望をテキストで入力させる。
* **AIの役割:** Gemma 4 がテキストを解釈し、曖昧な場合は対話で確定。ソルバーが理解できる汎用制約ブロック（`avoid_consecutive` 等）のJSONに変換。（※AIに配置パズル自体は解かせない）

### フェーズ2：ベースの自動配置（OR-Tools）
* OR-Tools CP-SAT ソルバーが制約JSONを受け取り、ハード制約・ソフト制約を計算。
* PCのフルパワーを使って 80〜95% 完成した時間割データを算出。

### フェーズ3：UIでの手動微調整
* 生成された時間割を画面に表示。
* エラー箇所をハイライト表示し、ドラッグ＆ドロップで最終完成。

---

## 5. 開発ロードマップ（デスクトップ版）

* **【Step 1】プロジェクト雛形の作成 ✅**
  `desktop/` ディレクトリ作成。Electron + FastAPI の基本構成を確立。

* **【Step 2】UIの移植とPython API連携**
  web版の React コンポーネントをデスクトップ版に移植し、Python API エンドポイントと接続する。

* **【Step 3】コアエンジンの開発**
  `llama-cpp-python` で Gemma 4 を組み込み、テキスト→JSON変換ロジックを実装。
  OR-Tools CP-SAT で時間割自動生成ロジックを実装。

* **【Step 4】統合と `.exe` 化**
  Python 依存を同梱し、`electron-builder` で単一 `.exe` にパッケージング。
