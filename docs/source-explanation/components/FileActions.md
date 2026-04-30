# ファイル操作パネル

> 対応ソースコード: `src/components/FileActions.tsx`

## このファイルの役割

このファイルは、**時間割データの「保存」と「読み込み」をするボタンを管理** します。

先生が作った時間割をコンピュータに保存したり、前に作った時間割を読み込んだりする機能を提供しています。

Tauri版（Windows exe）では、ドキュメント配下の `時間割作成ツール/save` フォルダを既定保存先として使い、フォルダが無い場合は自動作成します。

保存される時間割データには、TT（チームティーチング）で参加している先生全員の情報も含まれます。読み込み時もその情報を復元し、見た目やチェック結果がずれないようにしています。

Excel 出力では、曜日ごとの最大時限数の設定も使います。全曜日の中で一番遅い時限までを表にしつつ、個別の曜日で使わない時限は空欄として出力します。

---

## 3つのボタンと機能

FileActions コンポーネントは、3つの主要なボタンを提供します：

### 1. 上書き保存ボタン 💾

**ボタンの表示:**
```
💾 上書保存（[ファイル名]）
```

**何をするか:**
- 前に読み込んだ時間割ファイルに、現在の変更内容を上書き保存します
- 前に読み込んだファイルがない場合は、このボタンは使えません（グレーアウト）

**使う場面:**
```
1. 保存済みの「2024年度時間割.json」を読み込む
     ↓
2. 時間割をいろいろ編集する
     ↓
3. 「上書保存」ボタンを押す
     ↓
4. 「2024年度時間割.json」に変更が保存される
```

**ファイル読み込み時の処理:**
```javascript
setFileHandle(handle);        // ファイルの「手がかり」を記憶
setFileName(file.name);       // ファイル名を記憶
```

このにより、どのファイルに上書き保存するかが決まります。

### 2. 新規保存ボタン 📥

**ボタンの表示:**
```
📥 保存
```

**何をするか:**
- 現在の時間割を、新しいファイル名で保存します（ダウンロード）
- ブラウザのダウンロード機能を使って、ユーザーが指定した場所に保存されます

**ファイル名の自動生成:**
```javascript
`時間割データ_${new Date().toLocaleDateString('ja-JP').replace(/\//g, '')}.json`
```

例：`時間割データ_2024041.json`

**使う場面:**
```
1. 新しく時間割を作成する
     ↓
2. 「保存」ボタンを押す
     ↓
3. ブラウザがダウンロード画面を表示
     ↓
4. ユーザーが保存場所を選んで保存
```

### 3. 読込ボタン 📂

**ボタンの表示:**
```
📂 読込
```

**何をするか:**
- 前に保存した時間割ファイル（`.json`）を読み込みます
- ファイルをコンピュータから選んで開くダイアログが表示されます

**2つの読込方式がある：**

#### 方式1: 最新ブラウザの場合（File System Access API）

```javascript
const [handle] = await window.showOpenFilePicker({
  types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
});
```

- **メリット:** 上書き保存ができる（ファイルの「手がかり」を記憶）
- **対応ブラウザ:** Chrome、Edge（最新版）

#### 方式2: 古いブラウザの場合（フォールバック）

```javascript
fileInputRef.current?.click()  // 隠された <input type="file"> をクリック
```

- **メリット:** ほぼ全てのブラウザで動作
- **デメリット:** 上書き保存はできない（毎回新規保存になる）

---

## 保存されるデータ（JSON ファイル）

ボタンを押すと、下のようなデータが保存されます：

```javascript
{
  "teachers": [...],              // 先生の一覧
  "tt_assignments": [...],        // TT の設定一覧
  "class_groups": [...],          // 学年のグループ分け
  "structure": {...},             // 学校のカリキュラム構造
  "timetable": {...},             // 時間割データ
  "settings": {...},              // アプリの設定
  "subject_constraints": {...},   // 教科の制約条件
  "subject_pairings": [...],      // 教科の組み合わせ
  "cell_groups": [...],           // セルのグループ化
  // ... その他多数のデータ
}
```

これは、時間割を完全に復元するのに必要なすべての情報です。

---

## ボタンの見た目と状態

### 上書き保存ボタンの状態

```javascript
disabled={!fileHandle}  // ファイルが読み込まれていなければ無効
style={{
  background: fileHandle ? '#F59E0B' : '#D1D5DB',  // オレンジ or グレー
  color: fileHandle ? 'white' : '#9CA3AF',         // 白 or グレー
}}
```

| 状態 | ボタンの色 | クリック可能 |
|------|----------|-----------|
| ファイル読込済み | オレンジ | はい |
| ファイル未読込 | グレー | いいえ |

### 新規保存ボタンと読込ボタン

これらのボタンはいつでもクリック可能です。

```javascript
style={{ background: '#10B981', color: 'white' }}  // 新規保存：緑
style={{ background: '#3B82F6', color: 'white' }}  // 読込：青
```

---

## コードの詳しい説明

### ステップ1: ファイルハンドルの管理

```javascript
const [fileHandle, setFileHandle] = useState(null);
const [fileName, setFileName] = useState('');
```

- **fileHandle** - ファイルの「手がかり」（上書き保存に必要）
- **fileName** - ファイルの名前を表示用に保存

### ステップ2: JSON データを作成する関数

```javascript
const buildJson = () => {
  const state = useTimetableStore.getState();
  return JSON.stringify({
    teachers: state.teachers,
    // ... 他のデータ
  }, null, 2);
};
```

現在の時間割データを JSON 形式に変換します。

### ステップ3: 上書き保存の処理

```javascript
const handleOverwriteSave = async () => {
  if (!fileHandle) return;
  try {
    const writable = await fileHandle.createWritable();
    await writable.write(buildJson());
    await writable.close();
    alert(`「${fileName}」に上書き保存しました`);
  } catch (err) {
    alert('上書き保存に失敗しました: ' + err.message);
  }
};
```

1. ファイルに書き込める状態を作る
2. JSON データを書き込む
3. ファイルを閉じる
4. ユーザーに確認メッセージを表示

### ステップ4: 新規保存の処理

```javascript
const handleSaveAs = () => {
  const jsonString = buildJson();
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `時間割データ_${new Date().toLocaleDateString('ja-JP').replace(/\//g, '')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
```

1. JSON データを作成
2. メモリ上に一時的なファイル（Blob）を作成
3. ブラウザにダウンロードを指示
4. 不要になったデータをメモリから削除

### Excel 出力の保存

- ブラウザ版では通常のダウンロードとして保存します
- Tauri のデスクトップ版では、保存ダイアログで選んだパスへ直接書き込みます
- 現在の Tauri 版は `@tauri-apps/plugin-fs` の `writeFile(path, data)` 形式で保存し、旧式の `{ path, contents }` 形式は使いません

### ステップ5: ファイル読込の処理

#### 方式1: 最新ブラウザ版

```javascript
const handleLoadWithAPI = async () => {
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
    });
    const file = await handle.getFile();
    const text = await file.text();
    const jsonData = JSON.parse(text);
    if (jsonData.teachers && jsonData.structure && jsonData.timetable && jsonData.settings) {
      importState(jsonData);      // データを復元
      setFileHandle(handle);      // ファイル情報を記憶（上書き保存用）
      setFileName(file.name);     // ファイル名を記憶
      alert(`「${file.name}」を読み込みました`);
    } else {
      alert('エラー: ファイルの形式が正しくありません。');
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      alert('読み込みに失敗しました: ' + err.message);
    }
  }
};
```

#### 方式2: 古いブラウザ版（フォールバック）

```javascript
const handleFileChange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const jsonData = JSON.parse(event.target.result);
      if (jsonData.teachers && jsonData.structure && jsonData.timetable && jsonData.settings) {
        importState(jsonData);      // データを復元
        setFileHandle(null);        // ファイル情報は記憶しない
        alert(`「${file.name}」を読み込みました（上書き保存は非対応）`);
      } else {
        alert('エラー: ファイルの形式が正しくありません。');
      }
    } catch {
      alert('エラー: ファイルのパースに失敗しました。');
    }
  };
  reader.readAsText(file);
};
```

---

## エラーハンドリング（万が一の時の対応）

ユーザーがファイル操作をキャンセルした場合や、ファイル形式が違う場合の対応：

| エラー | 対応 |
|--------|------|
| ファイル選択をキャンセル | 特に何もしない（AbortError） |
| ファイル形式が違う | 「形式が正しくありません」と表示 |
| JSON パースに失敗 | 「パースに失敗しました」と表示 |
| 上書き保存失敗 | 「上書き保存に失敗しました」と表示 |

---

## 関連するファイル

- **[App.jsx](../App.md#ファイル操作)** - FileActions を配置するファイル
- **[useTimetableStore](../store/useTimetableStore.md#importstate---保存データを読み込む)** - `importState` 関数でデータを復元

---

## わかりやすい比喩

このファイルは、**図書館の「貸出・返却窓口」** のようなものです：

| 図書館の窓口 | このファイル |
|------------|-----------|
| 本を借りる | ファイルを読込 |
| 本を返す | ファイルを上書き保存 |
| 本を複写する | ファイルを新規保存（複製） |
| 借りた本の記録 | ファイルハンドル（どの本か） |

---

## 技術用語の説明

| 用語 | わかりやすい説明 |
|-----|-----------------|
| **JSON** | テキスト形式のデータファイル（わかりやすい）|
| **Blob** | メモリ上の一時的なファイル |
| **FileHandle** | ファイルに対する「手がかり」 |
| **File System Access API** | ファイル操作をするための最新ブラウザ機能 |
| **async/await** | 時間がかかる処理を待つ仕組み |
| **JSON.parse** | テキストをデータに変換する |
| **JSON.stringify** | データをテキストに変換する |
| **try/catch** | エラーが起きた時の処理 |

---

## まとめ

**FileActions は、時間割データの「出入り口」です。** ユーザーがファイルを保存・読込するにはこのコンポーネントを通す必要があります。

3つのボタンで、シンプルながら十分な機能を備えており、古いブラウザから新しいブラウザまで対応できるよう工夫されています。

---

## 使用例：典型的な作業フロー

```
【学年始めに新規作成】
ツールを起動
  ↓
「基礎構成」で先生や教科を登録
  ↓
「時間割の表」に時間を入力
  ↓
「保存」ボタンで「2024年度1年生.json」として保存

【翌週に編集】
「読込」ボタンで「2024年度1年生.json」を読込
  ↓
時間割をドラッグ&ドロップで編集
  ↓
「上書保存」ボタンで即座に保存（ファイル名は自動）

【別学年向けに流用】
「読込」で「2024年度1年生.json」を読込
  ↓
先生と教科を別学年用に変更
  ↓
「保存」で「2024年度2年生.json」として新規保存
```
