# 中学校向け時間割作成ツール v2.0 - ソースコード解説

> 非エンジニア向け（学校の先生や管理職向け）のソースコード解説ドキュメント

## このアプリについて

**中学校の時間割を効率的に作成・管理するためのWebアプリケーション** です。教科の配置、教員の割り当て、制約条件の自動チェック、AIによるレビューなどの機能があります。

### 利用方法

- **ブラウザ版（PWA）** - Chrome/Edgeで開いて使う。オフラインでも動作可能
- **開発環境** - `npm run dev` で起動（localhost:5173）

---

## アプリの全体構成図

```
【ユーザーが見る画面】
        ↓
   App.tsx（アプリ全体の司令塔）
        ↓
    ┌─────────────────────────────────────────┐
    │ UIコンポーネント（画面の部品）          │
    │ ・TimetableGrid（クラス別時間割表）    │
    │ ・TeacherScheduleGrid（先生別一覧）    │
    │ ・SettingsModal（設定画面 - 7タブ）    │
    │ ・ConstraintsModal（制約設定 - 6タブ） │
    │ ・SolverPanel（自動配置）              │
    │ ・AIAssistPanel（AI支援）              │
    │ ・FileActions（保存・読込）            │
    │ ・PdfExport（PDF出力）                 │
    │ ・ValidationPanel（問題点の表示）       │
    │ ・SubjectHoursChart（時数グラフ）      │
    └─────────────────────────────────────────┘
        ↓
    ┌─────────────────────────────────────────┐
    │ ストア（useTimetableStore）             │
    │ → 全データを一元管理する「記憶庫」     │
    │ → 6つのスライス（分野別の管理係）     │
    └─────────────────────────────────────────┘
        ↓
    ┌─────────────────────────────────────────┐
    │ ドメインロジック（ビジネスルール）      │
    │ ・教員の自動割り当て                    │
    │ ・特別支援学級の自動連動                │
    │ ・抱き合わせ教科の処理                  │
    │ ・バリデーション（問題検出）            │
    │ ・ソルバー（自動配置アルゴリズム）      │
    │ ・JSON保存・読込                        │
    └─────────────────────────────────────────┘
```

---

## フォルダ構成

```
src/
├── types/          ← データの型定義（「教員とは何か」「時間割エントリとは何か」の定義）
├── constants/      ← 定数（曜日＝月〜金、時限＝1〜6、勤務形態の種類）
├── domain/         ← ビジネスロジック（画面に依存しない計算処理）
│   ├── timetable/  ← コマの操作、教員割当、特支連動
│   ├── validation/ ← 問題検出（教員の重複、時数の過不足など）
│   ├── serialization/ ← JSONファイルの保存・読込・旧版変換
│   └── solver/     ← 自動配置（ランダムグリーディ法）
├── store/          ← データの記憶庫（Zustand）
│   └── slices/     ← 分野別の管理係（教員、クラス、制約など）
├── hooks/          ← カスタムフック（ソルバー用）
├── lib/            ← 外部API連携（Gemini AI）
└── components/     ← 画面の部品
    ├── common/     ← 共通部品（モーダル、タブ）
    ├── grid/       ← 時間割グリッド
    ├── cell/       ← セル編集（教科・教員選択）
    ├── settings/   ← 設定モーダル（7タブ）
    ├── constraints/← 制約モーダル（6タブ）
    └── solver/     ← ソルバー（自動配置）
```

---

## 主要な画面と対応ファイル

### メイン画面
| 画面要素 | ファイル | 説明 |
|---------|---------|------|
| アプリ全体 | `App.tsx` | ヘッダー、タブ切替、レイアウト |
| クラス別時間割 | `grid/TimetableGrid.tsx` | メインの時間割表 |
| 先生別一覧 | `grid/TeacherScheduleGrid.tsx` | 先生ごとのコマ割り |
| 教科時数グラフ | `SubjectHoursChart.tsx` | 規定時数との比較 |
| 問題点パネル | `ValidationPanel.tsx` | バリデーション結果 |

### 設定モーダル（「設定」ボタン）
| タブ | ファイル | 設定内容 |
|------|---------|---------|
| 教科設定 | `settings/SubjectsTab.tsx` | 教科の追加と週時数 |
| クラス設定 | `settings/ClassesTab.tsx` | 学年・クラスの管理 |
| 教員設定 | `settings/TeachersTab.tsx` | 教員の追加・編集 |
| 教員グループ | `settings/TeacherGroupsTab.tsx` | 道徳等のグループ |
| 合同クラス | `settings/ClassGroupsTab.tsx` | 合同授業の設定 |
| 抱き合わせ | `settings/PairingsTab.tsx` | 技術↔家庭科等 |
| 複数学年合同 | `settings/CrossGradeTab.tsx` | 学年横断の授業 |

### 制約モーダル（「制約」ボタン）
| タブ | ファイル | 設定内容 |
|------|---------|---------|
| 固定コマ | `constraints/FixedSlotsTab.tsx` | 朝礼・集会等 |
| 教員制約 | `constraints/TeacherConstraintsTab.tsx` | 日次・週次の上限 |
| 教科配置 | `constraints/SubjectPlacementTab.tsx` | 時限制限・連続日数 |
| 施設 | `constraints/FacilitiesTab.tsx` | 体育館等の管理 |
| 隔週ペア | `constraints/AltWeekTab.tsx` | A週/B週の設定 |
| 連続配置 | `constraints/SequencesTab.tsx` | 2時間連続授業 |

### その他の機能
| 機能 | ファイル | 説明 |
|------|---------|------|
| 保存・読込 | `FileActions.tsx` | JSON形式でデータを保存/読込 |
| PDF出力 | `PdfExport.tsx` | 印刷用の時間割表を生成 |
| AI支援 | `AIAssistPanel.tsx` | Gemini AIによるレビュー・自動生成 |
| ソルバー | `solver/SolverPanel.tsx` | 自動配置の実行・結果適用 |

---

## 技術スタック（使っている道具）

| 道具 | 役割 | たとえるなら |
|------|------|-------------|
| TypeScript | プログラミング言語 | 日本語（ルール厳密版） |
| React | 画面の描画 | 舞台装置 |
| Vite | 開発ツール | 大工道具一式 |
| Zustand | データの管理 | 事務局の書類棚 |
| Vitest | テスト | 品質検査員 |
| Gemini API | AI連携 | 外部コンサルタント |

---

## 更新履歴

- **v2.0** (2026-04) - TypeScript完全移行、TDD再構築、全Phase完了
- **v1.0** (2026-03) - 初版（JavaScript/JSX）
