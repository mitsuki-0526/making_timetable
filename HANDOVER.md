# 引き継ぎ書 — 時間割作成ツール v2.0

作成日: 2026-04-09（Phase 8〜11完了時点で更新）

---

## 1. プロジェクト概要

中学校向け時間割作成Webアプリ（GitHub Pages PWA）をゼロから再構築済み。
旧版の構造的問題（巨大単一ストア、テストなし、型なし）を解消し、TDDで新規構築した。

## 2. 現在の状態

### 全Phase完了

| レイヤー | 内容 | テスト数 |
|---------|------|---------|
| **types/** (5ファイル) | 全ドメインモデルの型定義 | — |
| **constants/** (1ファイル) | DAYS, PERIODS, EMPLOYMENT_TYPES | — |
| **domain/timetable/** (5ファイル) | 教員割当、特支連動、抱き合わせ、統合操作、セルグループ | 29 |
| **domain/validation/** (5ファイル) | 固定コマ、教員、教科、施設、統合バリデーション | 27 |
| **domain/serialization/** (3ファイル) | JSON export/import | 5 |
| **domain/solver/** (4ファイル) | ソルバー型定義、入力構築、結果適用、Web Worker | — |
| **store/** (7ファイル) | Zustand 6スライス + 統合ストア | 12 |
| **hooks/** (1ファイル) | useSolverWorker | — |
| **lib/** (1ファイル) | Gemini APIユーティリティ | — |
| **components/** (25ファイル) | App, グリッド, セル, 設定モーダル(7タブ), 制約モーダル(6タブ), ソルバー, AI, ファイルI/O, PDF | — |
| **合計** | **57ファイル** | **87テスト全パス** |

### ビルド状態
- `npx vitest run` → 87テスト全パス
- `npx vite build` → 成功（dist/ 生成済み）
- `npx tsc --noEmit` → 型エラーなし

---

## 3. アーキテクチャ

```
src/
├── types/              ← 型定義（全ドメインモデル）
├── constants/          ← 定数
├── domain/             ← ビジネスロジック（Pure functions, React非依存）
│   ├── timetable/      ← コマ操作・教員割当・連動ロジック
│   ├── validation/     ← バリデーション（9種類の違反検出）
│   ├── serialization/  ← JSON import/export
│   └── solver/         ← ソルバー（型定義・入力構築・結果適用・Worker）
├── store/              ← Zustand（6スライス、domain関数を呼ぶ薄いラッパー）
│   └── slices/
├── hooks/              ← カスタムHooks（useSolverWorker）
├── lib/                ← 外部API連携（Gemini API）
├── components/         ← UIコンポーネント
│   ├── common/         ← ModalShell, TabContainer
│   ├── grid/           ← TimetableGrid, TeacherScheduleGrid
│   ├── cell/           ← CellDropdown, AltWeekForm, TeacherPicker
│   ├── settings/       ← SettingsModal + 7タブ
│   ├── constraints/    ← ConstraintsModal + 6タブ
│   └── solver/         ← SolverPanel
└── __tests__/          ← テスト（srcと同構造）
```

**設計原則:**
- `domain/` は React/Zustand に一切依存しない pure functions → テスト容易
- `store/` は domain 関数を呼ぶ薄いラッパー → ステート管理のみ
- `components/` は表示と入力ハンドリングのみ → ビジネスロジックを含まない

---

## 4. 技術スタック

| 役割 | 技術 | バージョン |
|------|------|-----------|
| 言語 | TypeScript (strict) | ~6.0 |
| UI | React | ^19.2 |
| ビルド | Vite | ^8.0 |
| 状態管理 | Zustand | ^5.0 |
| アイコン | lucide-react | ^0.500 |
| テスト | Vitest + jsdom | ^3.2 |
| AI | Gemini API | gemini-2.0-flash-lite |
| デプロイ | GitHub Pages (gh-pages) | — |

---

## 5. 実装済み機能一覧

### Phase 1〜7（ドメインロジック + 基本UI）
- 型定義、定数、ドメインロジック、ストア、基本コンポーネント

### Phase 8: 設定・制約UI
- **設定モーダル**: 教科設定、クラス設定、教員設定、教員グループ、合同クラス、抱き合わせ教科、複数学年合同
- **制約モーダル**: 固定コマ、教員制約、教科配置制約、施設管理、隔週ペア、連続配置
- **セル詳細UI**: B週(隔週)設定フォーム、教員手動選択

### Phase 9: ファイルI/O + PDF + AI
- **FileActions**: JSON保存(File System Access API + ダウンロードフォールバック) / 読込
- **PdfExport**: 新規ウィンドウ + window.print（クラス別時間割 + 先生別コマ数表）
- **AIAssistPanel**: Gemini APIキー設定、接続テスト、時間割レビュー

### Phase 10: ソルバー
- **jsSolver.worker.ts**: ランダムグリーディ法（Web Worker実行）
- **buildSolverInput.ts**: ストア状態→ソルバー入力変換
- **applySolverResult.ts**: 結果適用（全上書き/空きのみ）
- **SolverPanel.tsx**: 実行UI（進捗バー、結果表示、適用ボタン）
- **useSolverWorker.ts**: Worker管理Hook

### Phase 11: PWA + 仕上げ
- **manifest.json**: PWA設定
- **sw.js**: Service Worker（ネットワーク優先 + キャッシュフォールバック）
- **index.html**: PWA対応メタタグ、SW登録

---

## 6. 開発コマンド

```bash
npm run dev          # Vite開発サーバー (localhost:5173)
npm run build        # プロダクションビルド
npm run test         # vitest run（全テスト一括）
npm run test:watch   # vitest（ウォッチモード）
npx tsc --noEmit     # 型チェックのみ
npm run deploy       # GitHub Pages デプロイ
```

---

## 7. 今後の改善項目

- [ ] Phase 8〜11のコンポーネントテスト追加（React Testing Library）
- [ ] CSSフレームワーク導入（Tailwind CSS推奨）
- [ ] デザイントークン整理
- [ ] CellDropdownにAltWeekForm/TeacherPickerの統合
- [ ] AI自動生成機能（レビューに加えてJSON形式での草案生成）
- [ ] 旧版JSON→新版JSON変換スクリプト
- [ ] E2Eテスト（Playwright）

---

## 8. 注意事項

- ブランチは `fork/rebuild-plan`（mainから分岐）
- `vite.config.ts` の `base` は `/making_timetable/`（GitHub Pages用）
- Gemini APIキーは `localStorage` に保存
- Service Workerはネットワーク優先戦略（オフラインフォールバック付き）
- vitest.config.ts で `@/` エイリアス設定済み
