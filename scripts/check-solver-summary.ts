import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { SolverInput, TryOnceResult, TimetableFileData } from "@/types";

type SolveFn = (input: SolverInput) => TryOnceResult;

function buildInput(fileData: TimetableFileData): SolverInput {
  return {
    teachers: fileData.teachers ?? [],
    teacher_groups: fileData.teacher_groups ?? [],
    structure: fileData.structure,
    subject_constraints: fileData.subject_constraints ?? {},
    settings: {
      ...(fileData.settings ?? {}),
      lunch_after_period:
        (fileData.settings as { lunch_after_period?: number } | undefined)
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
}

async function loadSolve(workerPath: string): Promise<SolveFn> {
  const modulePath = path.isAbsolute(workerPath)
    ? workerPath
    : path.resolve(workerPath);
  const moduleUrl = pathToFileURL(modulePath).href;
  const mod = (await import(moduleUrl)) as { solve?: SolveFn };
  if (typeof mod.solve !== "function") {
    throw new Error(`solve() が見つかりません: ${modulePath}`);
  }
  return mod.solve;
}

async function main() {
  const dataPath = process.argv[2];
  const workerPath = process.argv[3] ?? "./src/lib/jsSolver.worker.ts";
  const runCount = Number(process.argv[4] ?? "5");

  if (!dataPath) {
    console.error(
      "使い方: npx tsx --tsconfig tsconfig.app.json scripts/check-solver-summary.ts <データ.json> [workerPath] [runCount]",
    );
    process.exit(1);
  }

  const fileData = JSON.parse(
    readFileSync(dataPath, "utf8"),
  ) as TimetableFileData;
  const input = buildInput(fileData);
  const solve = await loadSolve(workerPath);

  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;

  const runs: Array<{
    placed: number;
    required: number;
    diagnostics: TryOnceResult["diagnostics"];
  }> = [];

  try {
    console.log = () => {};
    console.info = () => {};
    console.warn = () => {};

    for (let index = 0; index < runCount; index++) {
      const result = solve(input);
      runs.push({
        placed: result.placed_count,
        required: result.required_count,
        diagnostics: result.diagnostics ?? [],
      });
    }
  } finally {
    console.log = originalLog;
    console.info = originalInfo;
    console.warn = originalWarn;
  }

  const rates = runs.map((run) =>
    run.required > 0 ? (run.placed / run.required) * 100 : 0,
  );
  const missingTotals = new Map<string, number>();
  for (const run of runs) {
    for (const diag of run.diagnostics ?? []) {
      const key = `${diag.grade}-${diag.class_name}|${diag.subject}`;
      missingTotals.set(key, (missingTotals.get(key) ?? 0) + diag.missing);
    }
  }

  console.log(
    JSON.stringify(
      {
        workerPath: path.resolve(workerPath),
        runCount,
        required: runs[0]?.required ?? 0,
        placed: runs.map((run) => run.placed),
        avgRate:
          rates.reduce((total, rate) => total + rate, 0) /
          Math.max(rates.length, 1),
        minRate: rates.length > 0 ? Math.min(...rates) : 0,
        maxRate: rates.length > 0 ? Math.max(...rates) : 0,
        topMissing: [...missingTotals.entries()]
          .sort((left, right) => right[1] - left[1])
          .slice(0, 12),
      },
      null,
      2,
    ),
  );
}

void main();