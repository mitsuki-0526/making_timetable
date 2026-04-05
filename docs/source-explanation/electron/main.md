# デスクトップアプリ起動

> 対応ソースコード: `electron/main.js`

## このファイルの役割

このファイルは、**ブラウザなしで Windows のアプリケーションとして動作させるための仕組み** を作ります。

つまり：

- **ブラウザ版** - Chrome や Firefox を開いて使う
- **デスクトップ版** - Windows の `.exe` ファイルをダブルクリックして使う

この二者を可能にするのが、このファイルです。

---

## どうやってアプリをデスクトップ化するのか？

```
通常のブラウザアプリ        デスクトップアプリ（Electron）
    ↓                          ↓
Chrome や Firefox 内         自分用の小型ブラウザ内
    ↓                          ↓
ブラウザのアドレスバーから    Windows のアプリとして
http://... を開く           直接 .exe ファイルを実行
```

Electron（エレクトロン）というツールを使うと、ブラウザなしで、Chromium（Chrome の元になったソフト）を使ってアプリを表示します。

---

## 主な機能

### 1. ウィンドウの作成

```javascript
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
```

**何をしているか：**

| 設定 | わかりやすい説明 |
|-----|-----------------|
| `width: 1200` | ウィンドウの横幅を 1200 ピクセル |
| `height: 800` | ウィンドウの高さを 800 ピクセル |
| `nodeIntegration: true` | Node.js のコードをウィンドウ内で使える（ファイルアクセスなど） |
| `contextIsolation: false` | セキュリティ機能を簡易化（デモ向け） |

### 2. 開発時と本番時で異なるファイルを読み込む

```javascript
if (app.isPackaged) {
  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
} else {
  mainWindow.loadURL(DEV_URL);
}
```

#### 開発時（コードを編集している時）

```javascript
} else {
  mainWindow.loadURL(DEV_URL);
  // mainWindow.webContents.openDevTools();
}
```

- **読み込むファイル:** `http://localhost:5173/making_timetable/`（Vite の開発サーバー）
- **何が起こるか:** コードを保存すると、自動的に画面が更新されます。

#### 本番時（`.exe` ファイルで配布する時）

```javascript
if (app.isPackaged) {
  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
}
```

- **読み込むファイル:** `dist/index.html`（ビルドされた本番ファイル）
- **何が起こるか:** スタンドアロンで動作し、インターネット接続なしでも使えます。

### 3. アプリの起動と終了

```javascript
app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

**何をしているか：**

| 処理 | わかりやすい説明 |
|-----|-----------------|
| `app.whenReady()` | Electron の準備が完了したら |
| `createWindow()` | ウィンドウを作成（アプリを起動） |
| `app.on('activate')` | Mac で Dock をクリックした時 |
| `window-all-closed` | ウィンドウが全て閉じたら |
| `app.quit()` | アプリを終了（Windows の場合） |

---

## コードの詳しい説明

### ステップ1: 必要なモジュールをインポート

```javascript
const { app, BrowserWindow } = require('electron');
const path = require('path');
```

- **app** - Electron アプリ全体を制御する
- **BrowserWindow** - ウィンドウを作成・管理する
- **path** - ファイルパスを扱う Node.js のモジュール

### ステップ2: 開発時と本番時でファイルの場所を設定

```javascript
const DEV_URL = 'http://localhost:5173/making_timetable/';
```

開発時は、Vite の開発サーバーから読み込みます。

### ステップ3: ウィンドウ作成関数を定義

```javascript
function createWindow() {
  // ウィンドウを作成
  // ファイルを読み込む
  // ウィンドウを表示
}
```

### ステップ4: アプリの起動・終了を管理

```javascript
app.whenReady().then(() => {
  // Electron 準備完了 → ウィンドウを作成
})

app.on('window-all-closed', () => {
  // ウィンドウ全て閉じたら → アプリを終了
})
```

---

## わかりやすい流れ

```
【Windows ユーザーが .exe をダブルクリック】
        ↓
    Electron 起動
        ↓
  electron/main.js が実行
        ↓
  createWindow() 関数が実行
        ↓
  【開発時か本番時か確認】
    開発時 → http://localhost:5173... を読み込む
    本番時 → dist/index.html を読み込む
        ↓
  【Chromium ウィンドウが開く】
  幅 1200px × 高さ 800px のウィンドウが表示
        ↓
  時間割作成ツールが表示される
```

---

## 関連するファイル

- **[vite.config.mjs](../vite.config.md)** - ビルド設定  
  `ELECTRON=true` の環境変数により、デスクトップ版向けのビルドが行われます。

- **[src/main.jsx](../main.md)** - アプリの開始ファイル  
  このファイルで読み込まれる `index.html` から、`main.jsx` が実行されます。

- **[package.json](../../package.json)** - アプリの設定ファイル  
  Electron の起動コマンドや、ビルド方法が記載されています。

---

## わかりやすい比喩

このファイルは、**映画館の上映マネージャー** のようなものです：

| 映画館 | このファイル |
|--------|-----------|
| スクリーンの大きさを決める | ウィンドウサイズを設定 |
| 字幕版・吹き替え版を選ぶ | 開発版・本番版を選ぶ |
| 営業開始・営業終了を管理 | アプリの起動・終了を管理 |
| 観客が帰ったら営業終了 | ウィンドウ全て閉じたらアプリ終了 |

---

## 技術用語の説明

| 用語 | わかりやすい説明 |
|-----|-----------------|
| **Electron** | ブラウザなしで、Web アプリをデスクトップアプリ化するツール |
| **BrowserWindow** | Electron で作成するウィンドウ（アプリの画面） |
| **isPackaged** | アプリが `.exe` として配布されているか（本番化されているか）を判定 |
| **loadFile** | ローカルファイルを読み込む |
| **loadURL** | インターネットの URL を読み込む |
| **require** | Node.js のモジュールをインポートする（古い書き方） |
| **app.quit()** | アプリを完全に終了する |

---

## セキュリティに関する注記

コード内のコメントにもありますが、このファイルは設定が簡易化されています：

```javascript
contextIsolation: false, // 今回はシンプルなデモ構築のためfalseを許容
```

**本番環境では、セキュリティを強化することが推奨されます。** 特にファイルアクセスやネットワーク通信を行う場合は、Preload スクリプト（セキュリティを強化するファイル）の使用が推奨されています。

---

## まとめ

**electron/main.js は、ブラウザなしでアプリを動かす「エンジン」です。** このファイルがあることで：

1. Windows の `.exe` ファイルを作成できる
2. 開発時はブラウザで、本番時は独立したアプリとして動作できる
3. インターネット接続なしで使える

という利点が生まれています。

---

## 補足：デスクトップアプリをビルドするコマンド

```bash
# ビルド設定で ELECTRON=true を指定
ELECTRON=true npm run build

# その後、electron-builder などのツールで .exe を生成
npm run electron-build
```

このコマンドにより、Windows 用の `.exe` ファイルが生成されます。
