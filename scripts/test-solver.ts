/**
 * ソルバーテストスクリプト
 * 使い方: pnpm run test:solver <セーブデータ.json>
 */

import { readFileSync } from "node:fs";
import { solve } from "@/lib/jsSolver.worker";
import {
  checkCrossGroupTeacherConflicts,
  checkTeacherGroupConflicts,
  checkTeacherTimeConflicts,
} from "@/lib/validation";
import type { SolverInput, TimetableEntry, TimetableFileData } from "@/types";

// ── 引数チェック ─────────────────────────────────────────────
const dataPath = process.argv[2];
if (!dataPath) {
  console.error("使い方: pnpm run test:solver <セーブデータ.json>");
  process.exit(1);
}

const raw = readFileSync(dataPath, "utf-8");
const fileData: TimetableFileData = JSON.parse(raw);

// ── SolverInput を組み立て ────────────────────────────────────
const input: SolverInput = {
  teachers: fileData.teachers ?? [],
  teacher_groups: fileData.teacher_groups ?? [],
  structure: fileData.structure,
  subject_constraints: fileData.subject_constraints ?? {},
  settings: {
    ...(fileData.settings ?? {}),
    lunch_after_period:
      (fileData.settings as { lunch_after_period?: number })
        ?.lunch_after_period ?? 4,
  },
  fixed_slots: fileData.fixed_slots ?? [],
  subject_placement: fileData.subject_placement ?? {},
  cross_grade_groups: fileData.cross_grade_groups ?? [],
  class_groups: fileData.class_groups ?? [],
  subject_pairings: fileData.subject_pairings ?? [],
  alt_week_pairs: fileData.alt_week_pairs ?? [],
  subject_sequences: fileData.subject_sequences ?? [],
  existing_timetable: [],
  time_limit: 30,
  teacher_constraints: fileData.teacher_constraints ?? {},
  subject_facility: fileData.subject_facility ?? {},
};

// ── 競合チェック関数 ──────────────────────────────────────────
function countConflicts(entries: TimetableEntry[]): {
  teacherTime: number;
  group: number;
  crossGroup: number;
  total: number;
} {
  const teacherTime = checkTeacherTimeConflicts(
    entries,
    input.teachers,
    input.class_groups,
    input.cross_grade_groups,
  ).length;
  const group = checkTeacherGroupConflicts(
    entries,
    input.teacher_groups,
    input.class_groups,
    input.cross_grade_groups,
  ).length;
  const crossGroup = checkCrossGroupTeacherConflicts(
    entries,
    input.teacher_groups,
    input.teachers,
    input.class_groups,
    input.cross_grade_groups,
  ).length;
  return {
    teacherTime,
    group,
    crossGroup,
    total: teacherTime + group + crossGroup,
  };
}

// ── テスト実行 ────────────────────────────────────────────────
const RUNS = 5;
console.log(`\n===== ソルバーテスト (${RUNS}回試行) =====`);
console.log(`データ: ${dataPath}`);
console.log(
  `教員: ${input.teachers.length}人 / グループ: ${input.teacher_groups.length}個`,
);
console.log("");

type RunResult = {
  run: number;
  placed: number;
  required: number;
  rate: string;
  conflicts: ReturnType<typeof countConflicts>;
  entries: TimetableEntry[];
};

const results: RunResult[] = [];

for (let i = 1; i <= RUNS; i++) {
  const start = Date.now();
  const result = solve(input);
  const elapsed = Date.now() - start;
  const conflicts = countConflicts(result.entries);
  const rate =
    result.required_count > 0
      ? ((result.placed_count / result.required_count) * 100).toFixed(1)
      : "0.0";

  results.push({
    run: i,
    placed: result.placed_count,
    required: result.required_count,
    rate,
    conflicts,
    entries: result.entries,
  });

  const conflictMark = conflicts.total > 0 ? "⚠" : "✓";
  console.log(
    `試行 ${i}: ${rate}% (${result.placed_count}/${result.required_count})` +
      `  競合=${conflicts.total}(教員重複:${conflicts.teacherTime} グループ重複:${conflicts.group} クロスグループ:${conflicts.crossGroup})` +
      `  ${elapsed}ms ${conflictMark}`,
  );
}

// ── 最良結果の詳細表示 ───────────────────────────────────────
const best = results.sort((a, b) => {
  if (a.conflicts.total !== b.conflicts.total)
    return a.conflicts.total - b.conflicts.total;
  return b.placed - a.placed;
})[0];

console.log(`\n===== 最良結果 (試行${best.run}) =====`);
console.log(`配置率: ${best.rate}% (${best.placed}/${best.required})`);
console.log(`競合合計: ${best.conflicts.total}`);

if (best.conflicts.crossGroup > 0) {
  console.log("\n--- クロスグループ競合の詳細 ---");
  const details = checkCrossGroupTeacherConflicts(
    best.entries,
    input.teacher_groups,
    input.teachers,
    input.class_groups,
    input.cross_grade_groups,
  );
  // 重複排除して表示
  const seen = new Set<string>();
  for (const v of details) {
    const key = `${v.teacher_name}|${v.day}|${v.period}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const teacher = input.teachers.find((t) => t.id === v.teacher_id);
    const groups = input.teacher_groups
      .filter((g) => g.teacher_ids.includes(v.teacher_id))
      .map((g) => g.name)
      .join(", ");
    console.log(
      `  ${v.teacher_name}先生 ${v.day}曜${v.period}限` +
        `  (${v.grade}-${v.class_name})` +
        `  所属グループ: [${groups}]`,
    );
    if (!teacher)
      console.log(`    ※ 教員ID ${v.teacher_id} がteachersに見つかりません`);
  }
}

if (best.conflicts.teacherTime > 0) {
  console.log("\n--- 教員時間重複の詳細 ---");
  const details = checkTeacherTimeConflicts(
    best.entries,
    input.teachers,
    input.class_groups,
    input.cross_grade_groups,
  );
  const seen = new Set<string>();
  for (const v of details) {
    const key = `${v.teacher_name}|${v.day}|${v.period}`;
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(
      `  ${v.teacher_name}先生 ${v.day}曜${v.period}限 (${v.grade}-${v.class_name})`,
    );
  }
}

console.log("");
if (best.conflicts.total === 0) {
  console.log("✓ 競合なし！");
} else {
  console.log(`⚠ 競合 ${best.conflicts.total} 件が残っています。`);
}

// 未配置の診断情報
if (best.placed < best.required) {
  console.log(`\n--- 未配置コマ: ${best.required - best.placed}件 ---`);

  // ソルバー diagnostics があれば表示
  const diagResult = solve(input);
  if (diagResult.diagnostics && diagResult.diagnostics.length > 0) {
    console.log("(diagnostics)");
    for (const d of diagResult.diagnostics) {
      console.log(
        `  ${d.grade}-${d.class_name} 「${d.subject}」 ${d.missing}コマ未配置`,
      );
      console.log(`    理由: ${d.reason}`);
    }
  }

  // エントリから全件を直接集計して表示
  console.log("(配置数集計)");
  const counts: Record<string, number> = {};
  for (const e of best.entries) {
    if (!e.subject) continue;
    const k = `${e.grade}-${e.class_name}|${e.subject}`;
    counts[k] = (counts[k] ?? 0) + 1;
  }
  const reqHours = fileData.structure.required_hours as Record<
    string,
    Record<string, number>
  >;
  for (const gradeObj of (fileData.structure.grades ?? []) as {
    grade: number;
    classes: string[];
    special_classes?: string[];
  }[]) {
    const allClasses = [
      ...gradeObj.classes,
      ...(gradeObj.special_classes ?? []),
    ];
    for (const cls of allClasses) {
      const ck = `${gradeObj.grade}_通常`;
      const required = reqHours[ck] ?? {};
      for (const [subj, req] of Object.entries(required)) {
        const placed = counts[`${gradeObj.grade}-${cls}|${subj}`] ?? 0;
        if (placed < (req as number)) {
          console.log(
            `  ${gradeObj.grade}-${cls} 「${subj}」 ${placed}/${req}コマ配置済`,
          );
        }
      }
    }
  }
}
