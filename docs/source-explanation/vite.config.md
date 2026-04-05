# ビルド設定ファイル

> 対応ソースコード: `vite.config.mjs`

## このファイルの役割

このファイルは、**アプリを「開発」から「本番環境」に変える時のルールブック** です。

わかりやすく言うと：

- **開発時**（コードを書いている時）: アプリはどこから読み込むか？
- **本番化時**（ブラウザで公開する時、またはデスクトップアプリにする時）: ファイルの配置をどう変えるか？

という設定を書いています。

---

## 何が書いてあるか

### 全体の構造

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
  ],
  base: process.env.ELECTRON === 'true' ? './' : '/making_timetable/',
})
```

### ステップ1: Vite と React のプラグインを呼び込む

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
```

- **Vite** - 最新の Web アプリ開発ツール（開発時の起動を高速化）
- **React プラグイン** - React のコードを正しく動作させる

### ステップ2: 基本設定を定義

```javascript
export default defineConfig({
  plugins: [react()],
  base: process.env.ELECTRON === 'true' ? './' : '/making_timetable/',
})
```

#### plugins: [react()]

Vite が React のコードをちゃんと理解して、ブラウザで動くように変換するという指示です。

#### base の設定（重要！）

`base` は、**ファイルの「基準となる場所」** を指定します。

```javascript
base: process.env.ELECTRON === 'true' ? './' : '/making_timetable/',
```

これは、**条件分岐** です：

- **もし `ELECTRON === 'true'` なら** → `./`（デスクトップアプリとして実行）
- **それ以外なら** → `/making_timetable/`（ブラウザ版として実行）

---

## なぜこんな複雑な設定が必要？

### シナリオ1: ブラウザで使う場合

ブラウザでこのアプリを公開する場合、通常は URL が下のようになります：

```
https://example.com/making_timetable/
```

つまり、`making_timetable` というフォルダの中に置かれます。

その場合、ファイルの参照は `base` に `/making_timetable/` を指定する必要があります。こうすると、Vite がファイルパスを自動的に調整してくれます。

### シナリオ2: デスクトップアプリ（Windows）として使う場合

デスクトップアプリの場合、ファイルは `file://` プロトコル（ローカルファイル）で読み込まれます：

```
file:///C:/Users/user/AppData/Local/app/dist/index.html
```

この場合は、`base` に `./`（相対パス）を指定する必要があります。相対パスを使うことで、どこにアプリがインストールされても動作します。

---

## 環境変数による切り替え

### デスクトップアプリをビルドする時

```bash
ELECTRON=true npm run build
```

このコマンドで、`process.env.ELECTRON` が `'true'` に設定されます。すると、`base` が `./`（デスクトップ用）に自動的に変わります。

### ブラウザ版をビルドする時

```bash
npm run build
```

通常のコマンドで、`ELECTRON` 環境変数は設定されないため、`base` は `/making_timetable/`（ブラウザ用）に設定されます。

---

## 関連するファイル

- **[electron/main.js](./electron/main.md)** - デスクトップアプリの起動ファイル  
  デスクトップ化する時、このファイルが `vite.config.mjs` の設定を使います。

- **[src/main.jsx](./main.md)** - アプリの開始ファイル  
  このファイルが、Vite の設定に基づいて正しく読み込まれます。

---

## わかりやすい比喩

このファイルは、**郵便物の配送ルール** のようなものです：

| 郵便物の配送 | このファイル |
|-------------|-----------|
| 宛先の住所を指定 | ファイルの基準場所を指定 |
| 国内配送・国外配送で違う | ブラウザ版・デスクトップ版で違う |
| 配送ルールを指定 | Vite の動作ルールを指定 |
| 正しい住所なら確実に届く | 正しい設定なら確実に動く |

---

## 技術用語の説明

| 用語 | わかりやすい説明 |
|-----|-----------------|
| **Vite** | 最新の Web アプリ開発・ビルドツール |
| **プラグイン** | Vite に新しい機能を追加する拡張機能 |
| **base** | ファイルの基準となる場所（パス） |
| **環境変数** | アプリの動作を指定する値 |
| **process.env** | 環境変数にアクセスする仕組み |
| **ビルド** | ソースコードを本番環境用に変換すること |

---

## まとめ

**vite.config.mjs は、アプリケーションの「指南書」です。** このファイルが、Vite に対して「こういう環境で動かすんだよ」と教えています。

デスクトップアプリ化する時と、ブラウザで公開する時で異なる設定が自動的に適用されるため、同じコードで複数の環境に対応できるようになっています。

---

## 実際の使い方（開発者向け）

### 開発中（ローカルで動かす）

```bash
npm run dev
```

このコマンドで Vite の開発サーバーが起動し、設定に基づいてコードを読み込みます。

### 本番化する

```bash
# ブラウザ版
npm run build

# デスクトップアプリ版
ELECTRON=true npm run build
```

ビルドコマンドが、このファイルの設定を読んで、適切なファイル配置で最終版を作成します。
