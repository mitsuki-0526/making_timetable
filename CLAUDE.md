
@AGENTS.md

- 2026-04-27: 教員グループ機能を廃止した。`src/store` と UI から `teacher_groups` / `setEntryGroup` を削除し、複数教員の担当は `tt_assignments` と `TimetableEntry.teacher_ids` / `alt_teacher_ids` に統一した。旧 JSON の `teacher_groups` / `teacher_group_id` は `src/store/useTimetableStore.ts` 読込時だけ `teacher_ids` へ展開して後方互換を保つ。
- 2026-04-25: `src/lib/jsSolver.worker.ts` の抱き合わせは、相手クラスの対応教科が同時限に成立する場合だけ配置する。repair や移動でも単体へ崩さず、条件を満たせない場合は未配置のまま残す。
- 2026-04-26: 固定コマに教科が入っている場合、solver は通常の候補選定を使って `teacher_id` / `teacher_group_id` を自動補完する。教員グループが選ばれた時は、グループの全員を同時刻 busy にしたまま、利用可能なメンバー1人を `teacher_id` に入れる。合同クラス・複数学年合同は共有担当を優先し、共有時は同じ `teacher_id` / `teacher_group_id` を参加クラスへ付ける。
- 2026-04-26: TT 前提の授業は `TimetableEntry.teacher_ids` / `alt_teacher_ids` に参加教員全員をスナップショット保存する。`src/lib/teamTeaching.ts` が表示・判定の共通ヘルパーになり、セル表示・教師別表示・PDF・保存データはこの配列を優先して扱う。教科変更時も既存の `teacher_group_id` / `teacher_ids` を維持して TT 割当を落とさない。
- 2026-04-26: TT 判定は UI 表示だけでなく `src/lib/validation.ts` の勤務不可チェックや `src/components/Inspector.tsx` の担当表示にも反映する。`teacher_group_id` の有無だけでなく、`teamTeaching` ヘルパーが返す参加教員集合を基準に扱う。
- 2026-04-27: `src/components/settings-tabs/TtAssignmentsTab.tsx` を追加し、TT 設定を教員グループとは別に登録できるようにした。最小実装の範囲は設定の CRUD と JSON 保存/読込までで、solver やセル自動反映はまだ `teacher_groups` ベースのまま残している。
- 2026-04-27: `src/lib/ttAssignments.ts` を追加し、TT 設定の一致判定と参加教員スナップショットを共通化した。`src/store/slices/timetableSlice.ts` と `src/lib/teacherAssignment.ts` は教科変更時に TT 設定を自動反映し、`src/lib/jsSolver.worker.ts` / `src/components/SolverPanel.tsx` / `scripts/test-solver.ts` / `scripts/check-solver-summary.ts` も `tt_assignments` を入力に受けて同じ TT 設定を solver に適用する。
- 2026-04-27: `tt_assignments` は `subjects: string[]` で複数教科を持てるようにした。`src/components/settings-tabs/TtAssignmentsTab.tsx` は教科を複数選択で編集でき、`src/lib/ttAssignments.ts` の一致判定は `subjects` を優先しつつ旧データの `subject` も後方互換で読む。
- 2026-04-27: `tt_assignments` は `grades: number[]` で複数学年も持てるようにした。`src/components/settings-tabs/TtAssignmentsTab.tsx` は学年を複数選択で編集でき、`src/lib/ttAssignments.ts` の一致判定は `grades` を優先しつつ旧データの `grade` も後方互換で読む。
- 2026-04-27: 左パレットの旧グループタブを TT 設定ベースへ差し替えた。`src/components/AppSidebar.tsx` は有効な `tt_assignments` を TT タブに表示し、`src/lib/touchDrag.ts` / `src/components/TimetableGrid.tsx` / `src/components/WeekGrid.tsx` / `src/components/MatrixView.tsx` は `tt_assignment` ドラッグを受けて `src/store/slices/timetableSlice.ts` の `setEntryTtAssignment` を呼ぶ。単一教科 TT は空セルへ教科ごと適用でき、複数教科 TT は既存教科が一致するセルにだけ適用する。
- 2026-04-27: `tt_assignments` の対象クラスは学年別 `target_classes` でも保持するようにした。旧データの `class_names` は後方互換で読みつつ、`src/components/settings-tabs/TtAssignmentsTab.tsx` は選択した学年ごとに見出し付きで組ボタンを出し、`src/lib/ttAssignments.ts` と `src/store/slices/timetableSlice.ts` は `grade + class_name` の組み合わせで一致判定する。
- 2026-04-27: 競合表示は `src/hooks/useViolations.ts` で `severity: hard | soft` を付けて返す。`src/components/WarnBanner.tsx` は上部バナーに赤の要修正ラベルと黄の妥協候補ラベルを併記し、`src/components/ConflictList.tsx` も要修正と妥協候補を分けて表示する。セルの `conflictKeys` は hard のみ赤強調する。
- 2026-04-28: `src/lib/jsSolver.worker.ts` は教員重複と勤務不可を solver の最優先 hard 違反として扱う。最終スコアは「hard 違反ゼロ化 > 全コマ充足 > 教員割当数」の順で比較し、deep repair の勤務不可修復では `subject / alt_subject / 共有授業` をまとめて再配置する。固定コマは同一スロット内の教員差し替えだけ試す。
