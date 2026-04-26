
@AGENTS.md

- 2026-04-25: `src/lib/jsSolver.worker.ts` の抱き合わせは、相手クラスの対応教科が同時限に成立する場合だけ配置する。repair や移動でも単体へ崩さず、条件を満たせない場合は未配置のまま残す。
- 2026-04-26: 固定コマに教科が入っている場合、solver は通常の候補選定を使って `teacher_id` / `teacher_group_id` を自動補完する。教員グループが選ばれた時は、グループの全員を同時刻 busy にしたまま、利用可能なメンバー1人を `teacher_id` に入れる。合同クラス・複数学年合同は共有担当を優先し、共有時は同じ `teacher_id` / `teacher_group_id` を参加クラスへ付ける。
- 2026-04-26: TT 前提の授業は `TimetableEntry.teacher_ids` / `alt_teacher_ids` に参加教員全員をスナップショット保存する。`src/lib/teamTeaching.ts` が表示・判定の共通ヘルパーになり、セル表示・教師別表示・PDF・保存データはこの配列を優先して扱う。教科変更時も既存の `teacher_group_id` / `teacher_ids` を維持して TT 割当を落とさない。
- 2026-04-26: TT 判定は UI 表示だけでなく `src/lib/validation.ts` の勤務不可チェックや `src/components/Inspector.tsx` の担当表示にも反映する。`teacher_group_id` の有無だけでなく、`teamTeaching` ヘルパーが返す参加教員集合を基準に扱う。
