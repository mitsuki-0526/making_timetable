# Tauri Windows exe ビルドガイド

## 概要

時間割作成ツールをWindowsネイティブアプリケーション（exe/インストーラー）として配布するための手順です。

---

## 必要な環境

### 1. Rust ツールチェーンのインストール

Tauri 2 は Rust で書かれています。以下のいずれかの方法でインストールしてください。

**方法A: rustup （推奨）**

```powershell
# Rust公式サイトから rustup をダウンロード・実行
# https://rustup.rs/

# または、Windows Package Manager を使用
winget install Rustlang.Rust.MSVC
```

**方法B: Microsoft Visual C++ ビルドツールのインストール**

Rust のコンパイルには MSVC（Microsoft Visual C++）が必要です。以下を確認・インストールしてください：

```powershell
# Visual Studio Build Tools for Visual Studio 2022
# https://visualstudio.microsoft.com/downloads/
# 「Desktop development with C++」ワークロードを選択

# または Rust インストール時に自動でセットアップされる場合があります
```

### 2. Node.js & pnpm

既にインストール済みの場合はスキップしてください。

```powershell
# Node.js (LTS) をインストール
winget install OpenJS.NodeJS.LTS

# pnpm をインストール
npm install -g pnpm
```

---

## ビルド手順

### 1. リポジトリのクローンと依存インストール

```powershell
git clone https://github.com/mitsuki-0526/making_timetable.git
cd making_timetable

# JavaScript 依存をインストール
pnpm install
```

### 2. フロントエンド本番ビルド

```powershell
pnpm run build
```

このコマンドが正常に完了すると、`dist/` ディレクトリにWeb版の本番ファイルが生成されます。

### 3. Tauri exe / インストーラーの作成

```powershell
# Windows exe とインストーラーをビルド
pnpm run tauri:build
```

**初回実行時の注意:**
- `tauri-build` が Cargo の依存をダウンロード・コンパイルするため、数分～数十分かかる場合があります。
- インターネット接続が必要です。

**ビルド完了後:**
- `src-tauri/target/release/` に Windows exe ファイルが生成されます。
- `src-tauri/target/release/bundle/nsis/` に NSIS インストーラー（`.exe`）が生成されます。

**GitHub Actions での補足:**
- リポジトリの Windows CI は `windows-2022` ランナーで動かします。
- このランナーには NSIS が標準で入っているため、CI 側で `choco install nsis` を追加実行しません。
- `windows-latest` は時期によってイメージ内容が変わるため、インストーラー生成の再現性を優先して固定しています。

### 4. インストーラーの配布

生成されたインストーラーを以下の場所に配置してください。

```
src-tauri/target/release/bundle/nsis/
├── 時間割作成ツール_[バージョン].exe  ← これが最終配布ファイル
└── ...
```

---

## ビルドトラブルシューティング

### Error: cargo が見つからない

**原因:** Rust がインストールされていない、または PATH に含まれていない

**解決策:**

```powershell
# Rust インストール状況を確認
rustc --version
cargo --version

# PATH を再読み込み（必要に応じて）
$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + `;` + [System.Environment]::GetEnvironmentVariable('Path', 'User')
```

### Error: MSVC ビルドツールが見つからない

**原因:** Visual Studio Build Tools がインストールされていない

**解決策:**

1. Visual Studio 2022 Community Edition（無料）をダウンロード
   - https://visualstudio.microsoft.com/downloads/
2. インストール時に「Desktop development with C++」を選択
3. インストール完了後、PowerShell を再起動して再ビルド

### Error: network issue during build

**原因:** インターネット接続の問題または npm レジストリの遅延

**解決策:**

```powershell
# インターネット接続を確認
ping github.com

# Rust アップデートを確認
rustup self update
rustup update

# 再度ビルドを試行
pnpm run tauri:build
```

---

## 開発ビルド（デバッグモード）

本番インストーラーではなく、開発用の exe を生成する場合：

```powershell
pnpm run tauri:dev
```

このコマンドは以下を実行します：
1. Vite 開発サーバーを localhost:5173 で起動
2. Tauri デバッグアプリケーションをネイティブウィンドウで起動

開発サーバーに変更を加えると、ネイティブアプリに即座に反映されます。

---

## カスタマイズ

### ウィンドウサイズの変更

`src-tauri/tauri.conf.json` の `app.windows` セクションを編集：

```json
"app": {
  "windows": [
    {
      "title": "時間割作成ツール",
      "width": 1280,   // ← ここを変更
      "height": 900,   // ← ここを変更
      "minWidth": 1024,
      "minHeight": 720,
      "resizable": true,
      "fullscreen": false
    }
  ]
}
```

### インストーラー設定の変更

`src-tauri/tauri.conf.json` の `bundle` セクションを編集：

```json
"bundle": {
  "active": true,
  "targets": ["nsis"],  // Windows NSIS インストーラー
  "icon": [...]
}
```

---

## 参考リンク

- [Tauri 2 公式ドキュメント](https://v2.tauri.app/)
- [Tauri on Windows](https://v2.tauri.app/start/prerequisites/#windows)
- [Rust インストール](https://www.rust-lang.org/ja/tools/install)
- [Visual Studio 2022 ダウンロード](https://visualstudio.microsoft.com/downloads/)

---

## サポート

ビルドに関する問題が発生した場合は、以下のリソースを参照してください：

- このリポジトリの Issues タブ
- Tauri 公式 Discord コミュニティ
