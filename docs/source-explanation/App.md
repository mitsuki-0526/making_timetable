# アプリの指揮者

> 対応ソースコード: `src/App.tsx`

## 2026年4月の新UIメモ

現在の App は、左メニュー・中央の時間割表示・右側の詳細パネルという3カラム構成です。

- 中央は「クラス週表示」「全校時間割」「教員表示」「時数表示」を切り替えます
- 右側の詳細パネルでは、選択したセルの教科、担当、B週設定、グループ担当、合同コマ操作を行います
- 週表示とマトリクス表示では、Ctrl/Cmd+クリックで複数セルを選び、右側から合同コマにまとめられます
- 上部ヘッダーの「元に戻す」「やり直す」はボタンだけでなく、Ctrl/Cmd+Z、Ctrl+Y、Ctrl/Cmd+Shift+Z のキー操作にも対応します
- 画面テーマはライト固定で、上部ヘッダーにダークモード切替ボタンはありません
- Windows の拡大縮小や小さめの画面高さでも使いやすいよう、左サイドバーは縦スクロールでき、画面が低い時はヘッダーやサイドバーの余白だけを少し詰める compact 表示に自動で切り替わります
- 左サイドバーと右側の詳細パネルは、それぞれ境界線を左右にドラッグして幅を調整でき、ダブルクリックで標準の幅に戻せます
- 左右のサイドバーは上部のボタンから収納・再表示でき、必要な時だけ中央の時間割を広く使えます
- 全校時間割の見出し右側には表示倍率の操作があり、100% を基準に拡大・縮小できます。左端の見出し列は標準サイズのまま保ち、表は左寄せで表示されます。ボタン1つで標準倍率に戻せます
- 左サイドバーの「メニュー」「パレット」「操作」はそれぞれ折りたたみできます。折りたたみボタンは目立ちすぎない黒い矢印だけの表示です。教科はドラッグだけでなくクリックで選んで、時間割のセルを順番にクリックして入れていくこともできます
- 左サイドバーの「フィルタ」も折りたたみできます。必要ない時はたたんで、パレットや操作欄の見える範囲を広く取れます
- これらの折りたたみは、右端の矢印だけでなく見出し名そのものを押しても切り替わります。パレットをたたむと、その下の操作欄が上へ詰まって並びます

このため、以前の「セルをクリックすると小さなメニューが開く」形から、今は「セルを選んで右側で編集する」形に役割が移っています。

## このファイルの役割

このファイルは、**アプリ全体の「指揮者」** の役割を果たします。オーケストラの指揮者が全ての楽器を統括するように、App.tsx は画面上の全てのボタン、表、パネルを管理します。

アプリケーションで見えているほぼすべてのもの（上のヘッダー、時間割の表、各種ボタン、ポップアップ画面など）は、このファイルで組み立てられています。

---

## 主な機能

### 1. 画面のレイアウト（全体の配置）

App.tsx は、ブラウザの画面を3つの部分に分けて構成しています：

```
┌─────────────────────────────────────────┐
│  ヘッダー（上部のボタンやタイトル）    │
├─────────────────────────────────────────┤
│                                         │
│  メインコンテンツ（中央の内容）        │
│  • 時間割の表                           │
│  • チェック結果の表示                   │
│  • 先生のスケジュール表                 │
│                                         │
└─────────────────────────────────────────┘
```

### 2. 各ボタンの役割と配置

App.jsx は、画面上部のボタンを並べています：

#### ファイル操作

| ボタン | 役割 | 詳細ページ |
|--------|------|---------|
| **💾 上書保存** | 前回読み込んだファイルに上書き保存 | [FileActions.md](./components/FileActions.md#上書き保存機能) |
| **📥 保存** | 新しいファイル名で保存（ダウンロード） | [FileActions.md](./components/FileActions.md#新規保存機能) |
| **📂 読込** | 前に保存した時間割ファイルを読み込む | [FileActions.md](./components/FileActions.md#ファイル読込機能) |

#### 時間割編集ツール

| ボタン | 役割 | 詳細ページ |
|--------|------|---------|
| **📄 PDF出力** | 時間割を PDF ファイルで出力 | [PdfExport.md](./components/PdfExport.md) |
| **📊 コマ数確認** | 教科ごとの授業時間数を棒グラフで表示 | [SubjectHoursChart.md](./components/SubjectHoursChart.md) |
| **🤖 AI支援** | AI に時間割作成を相談 | [AIAssistPanel.md](./components/AIAssistPanel.md) |
| **📋 条件設定** | 時間割のルール（連続授業禁止など）を設定 | [ConstraintsModal.md](./components/ConstraintsModal.md) |
| **⚙️ 基礎構成** | 先生や教科の情報を管理 | [SettingsModal.md](./components/SettingsModal.md) |

### 3. メインの表示エリア

App.jsx は、3つの大きなコンポーネント（UI部品）を中央に配置します：

```javascript
<main className="main-content">
  <TimetableGrid />           // 時間割の表
  <ValidationPanel />         // チェック結果の表示
  <TeacherScheduleGrid />     // 先生のスケジュール表
</main>
```

- **TimetableGrid** - 中学校のカリキュラムを表示する大きな表
- **ValidationPanel** - 時間割のエラーや警告をリストで表示
- **TeacherScheduleGrid** - 各先生のスケジュールを別の表で表示

### 4. ポップアップ画面（モーダル）の管理

複数のポップアップ画面を、App.jsx が一括管理しています：

```javascript
{isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
{isConstraintsOpen && <ConstraintsModal onClose={() => setIsConstraintsOpen(false)} />}
{isChartOpen && <SubjectHoursChart onClose={() => setIsChartOpen(false)} />}
{isAIOpen && <AIAssistPanel onClose={() => setIsAIOpen(false)} />}
```

これは、「ボタンが押されたら、ポップアップを開く」という仕組みです：

| ポップアップ | いつ開くか | 説明 |
|------------|---------|------|
| SettingsModal | 基礎構成ボタン | 先生・教科の情報を編集 |
| ConstraintsModal | 条件設定ボタン | 時間割のルールを設定 |
| SubjectHoursChart | コマ数確認ボタン | 教科の授業時間をグラフ表示 |
| AIAssistPanel | AI支援ボタン | AI に時間割作成を相談 |

---

## コードの詳しい説明

### ステップ1: 必要な部品をインポート（呼び出す）

```javascript
import React, { useState } from 'react';
import TimetableGrid from './components/TimetableGrid';
import ValidationPanel from './components/ValidationPanel';
// ... 他の部品も同様に呼び出す
```

App.jsx が使う全てのボタンやパネルをここで呼び出します。

### ステップ2: 画面の開閉状態を管理する

```javascript
const [isSettingsOpen, setIsSettingsOpen] = useState(false);
const [isConstraintsOpen, setIsConstraintsOpen] = useState(false);
const [isChartOpen, setIsChartOpen] = useState(false);
const [isAIOpen, setIsAIOpen] = useState(false);
```

ポップアップ画面が開いているか閉じているかを記憶します。

- `useState(false)` - 最初は全て「閉じた状態」
 - `setIsSettingsOpen(true)` - 基礎構成ボタンを押すと「開いた状態」に変わる

### ステップ3: ボタンをクリックしたら、ポップアップを開く

```javascript
<button onClick={() => setIsChartOpen(true)}>
  📊 コマ数確認
</button>
```

ボタンがクリックされたら、`setIsChartOpen(true)` で画面を開きます。

---

## 関連するファイル

### 外側の関連
- **[src/main.jsx](./main.md)** - このファイルを起動するファイル

### UIコンポーネント（画面の部品）
- **[TimetableGrid](./components/TimetableGrid.md)** - 時間割の表
- **[ValidationPanel](./components/ValidationPanel.md)** - チェック表示
- **[TeacherScheduleGrid](./components/TeacherScheduleGrid.md)** - 先生のスケジュール表
- **[FileActions](./components/FileActions.md)** - ファイル保存・読込
- **[PdfExport](./components/PdfExport.md)** - PDF出力
- **[SubjectHoursChart](./components/SubjectHoursChart.md)** - コマ数グラフ
- **[AIAssistPanel](./components/AIAssistPanel.md)** - AI支援パネル
- **[SettingsModal](./components/SettingsModal.md)** - 基礎構成画面
- **[ConstraintsModal](./components/ConstraintsModal.md)** - 条件設定画面

### データ管理
- **[useTimetableStore](./store/useTimetableStore.md)** - 時間割データの倉庫

---

## わかりやすい比喩

App.jsx は、**学校の校長室** のような役割です：

| 校長室 | App.jsx |
|--------|---------|
| 全ての先生の動きを把握 | 全てのボタンとパネルを管理 |
| 必要に応じて会議室を用意 | 必要に応じてポップアップを開く |
| 学校の運営ルールを決める | 画面レイアウトとルールを決める |
| 他の部門と連携 | 他のコンポーネントと連携 |

---

## 技術用語の説明

| 用語 | わかりやすい説明 |
|-----|-----------------|
| **コンポーネント** | UI（画面）を作る再利用可能な部品 |
| **import** | ファイルから何かを呼び出す |
| **useState** | 画面の状態（開いている/閉じている など）を記憶する仕組み |
| **JSX** | HTML のような書き方で JavaScript コードを書く言語 |
| **onClick** | ボタンがクリックされた時に実行する処理 |
| **モーダル** | 背景が暗くなる特別なポップアップ画面 |

---

## まとめ

**App.tsx は、このアプリケーションの「脳」です。** ユーザーがボタンをクリックした時、どの表示に切り替えるか、どのセルを編集対象にするか、どのパネルを開くかをまとめて管理しています。

新UIでは特に、中央の時間割と右側の詳細パネルをつなぐ役割が重要です。
