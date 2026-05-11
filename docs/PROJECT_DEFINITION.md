# プロジェクト定義：時間割作成アシストツール

## 1. プロジェクトの最終目標
学校現場における時間割作成業務を効率化するツールを開発する。
機密情報保護のため外部APIは使用せず（デフォルト）、ローカル環境で「AIによる条件の翻訳」「数理最適化ソルバーによる自動配置」「人間による直感的な微調整」を組み合わせたハイブリッド型システムを構築する。

---

## 2. プロジェクト構成（web版 + Tauri配布）

```
making_timetable/          ← リポジトリルート
├── src/                   ← 共通フロントエンド（React + Vite）
├── src-tauri/             ← Tauri ネイティブラッパー（Windows exe配布）
├── electron/              ← 旧ラッパー（互換維持用）
├── desktop/               ← 旧計画資産（参照専用）
└── docs/                  ← プロジェクトドキュメント
```

---

## 3. 技術スタック

| 役割 | 技術 |
|---|---|
| UI | React + Vite + Zustand |
| Web配布 | GitHub Pages |
| Windows exe配布 | Tauri 2（Rust + WebView2） |
| ファイル保存/読込 | ブラウザ: File System Access API / Tauri: dialog + fs plugin |

---

## 4. 配布方針

1. Web版は従来どおり GitHub Pages で公開する。
2. Windowsデスクトップ版は Tauri でビルドし、`nsis` インストーラーを正式配布物とする。
3. 保存データ（JSON）はユーザーのドキュメント配下 `時間割作成ツール/save` を既定フォルダとして利用する。
4. デスクトップ版の自動更新は Tauri 公式 updater（Ed25519 ローカル署名・無料）を用いる。ソースリポは private のまま、配信専用の public リポ `mitsuki-0526/making_timetable-releases` の GitHub Releases にインストーラ・`.sig`・`latest.json` を publish し、アプリは `https://github.com/mitsuki-0526/making_timetable-releases/releases/latest/download/latest.json` を更新エンドポイントとして参照する。リリースはソースリポでタグ `v*` を push すると `.github/workflows/release.yml` が自動でビルド・署名・配信を行う。

---

## 5. 実装方針（2026-04更新）

1. フロントエンドは単一コードベースを維持し、ランタイム判定で Web / Tauri の保存APIを切り替える。
2. Tauri実行時は保存・読込ダイアログの既定パスを `save` フォルダに固定し、未作成時は自動作成する。
3. 互換性維持のため旧ディレクトリは当面残すが、新規機能は `src` と `src-tauri` を優先する。
