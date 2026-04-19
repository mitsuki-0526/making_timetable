import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { SolverMessage, TimetableEntry } from "@/types";
import { useTimetableStore } from "../store/useTimetableStore";

interface SolverPanelProps {
  onClose: () => void;
}

interface SolverResult {
  timetable: TimetableEntry[];
  count: number;
  placed: number;
  required: number;
  message: string;
}

const SolverPanel = ({ onClose }: SolverPanelProps) => {
  const {
    teachers,
    teacher_groups,
    structure,
    subject_constraints,
    settings,
    fixed_slots,
    subject_placement,
    alt_week_pairs,
    cross_grade_groups,
    class_groups,
    subject_pairings,
    subject_sequences,
    setGeneratedTimetable,
    timetable,
  } = useTimetableStore();

  const [timeLimit, setTimeLimit] = useState(30);
  const [overwriteMode, setOverwriteMode] = useState<"empty" | "all">("empty");
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">(
    "idle",
  );
  const [result, setResult] = useState<SolverResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [progress, setProgress] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const workerRef = useRef<Worker | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalClasses = structure.grades.reduce(
    (s, g) => s + (g.classes?.length || 0),
    0,
  );
  const totalSubjects = Array.from(
    new Set(Object.values(structure.required_hours).flatMap(Object.keys)),
  ).length;
  const filledSlots = timetable.filter((e) => e.subject).length;

  const startTimer = () => {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleApply = () => {
    if (!result?.timetable?.length) return;

    let toApply: TimetableEntry[];
    if (overwriteMode === "all") {
      toApply = result.timetable;
    } else {
      const existingKeys = new Set(
        timetable.map(
          (e) => `${e.day_of_week}|${e.period}|${e.grade}|${e.class_name}`,
        ),
      );
      const classKey = (grade: number, class_name: string) =>
        `${grade}|${class_name}`;
      const counts: Record<string, Record<string, number>> = {};
      for (const e of timetable) {
        if (!e?.subject) continue;
        const k = classKey(e.grade, e.class_name);
        if (!counts[k]) counts[k] = {};
        counts[k][e.subject] = (counts[k][e.subject] || 0) + 1;
        if (e.alt_subject) {
          counts[k][e.alt_subject] = (counts[k][e.alt_subject] || 0) + 1;
        }
      }

      const reqForClass = (grade: number) => {
        const key = `${grade}_通常`;
        return structure?.required_hours?.[key] || {};
      };

      const filteredNew: TimetableEntry[] = [];
      for (const e of result.timetable) {
        const slotKey = `${e.day_of_week}|${e.period}|${e.grade}|${e.class_name}`;
        if (existingKeys.has(slotKey)) continue;
        if (!e?.subject) continue;

        const k = classKey(e.grade, e.class_name);
        const req = reqForClass(e.grade);
        if (!counts[k]) counts[k] = {};

        const curMain = counts[k][e.subject] || 0;
        const reqMain = req[e.subject];
        if (reqMain != null && curMain >= reqMain) continue;

        if (e.alt_subject) {
          const curAlt = counts[k][e.alt_subject] || 0;
          const reqAlt = req[e.alt_subject];
          if (reqAlt != null && curAlt >= reqAlt) continue;
        }

        filteredNew.push(e);
        counts[k][e.subject] = curMain + 1;
        if (e.alt_subject) {
          counts[k][e.alt_subject] = (counts[k][e.alt_subject] || 0) + 1;
        }
      }
      toApply = [...timetable, ...filteredNew];
    }

    setGeneratedTimetable(toApply);
    onClose();
  };

  const handleCancel = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    stopTimer();
    setStatus("idle");
  };

  const runBrowserSolver = () => {
    setStatus("running");
    setProgress(0);
    setAttempts(0);
    setResult(null);
    setErrorMsg("");
    startTimer();

    const worker = new Worker(
      new URL("../lib/jsSolver.worker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<SolverMessage>) => {
      const msg = e.data;
      if (msg.type === "progress") {
        setProgress(msg.score ?? 0);
        setAttempts(msg.attempts ?? 0);
      } else if (msg.type === "done") {
        stopTimer();
        const p =
          msg.required > 0
            ? Math.round((msg.placed / msg.required) * 100)
            : 100;
        setProgress(p);
        setResult({
          timetable: msg.timetable,
          count: msg.count,
          placed: msg.placed,
          required: msg.required,
          message:
            msg.required > 0
              ? `${msg.placed} / ${msg.required} コマを配置しました（配置率 ${p}%）`
              : `${msg.count} コマの時間割を生成しました。`,
        });
        setStatus("done");
        worker.terminate();
        workerRef.current = null;
      } else if (msg.type === "error") {
        stopTimer();
        setErrorMsg(msg.message || "未知のエラー");
        setStatus("error");
        worker.terminate();
        workerRef.current = null;
      }
    };

    worker.onerror = (e) => {
      stopTimer();
      setErrorMsg(`ソルバーエラー: ${e.message}`);
      setStatus("error");
      workerRef.current = null;
    };

    worker.postMessage({
      type: "solve",
      data: {
        teachers,
        teacher_groups: teacher_groups || [],
        structure,
        subject_constraints,
        settings,
        fixed_slots: fixed_slots || [],
        subject_placement: subject_placement || {},
        cross_grade_groups: cross_grade_groups || [],
        class_groups: class_groups || [],
        subject_pairings: subject_pairings || [],
        alt_week_pairs: alt_week_pairs || [],
        subject_sequences: subject_sequences || [],
        existing_timetable: overwriteMode === "empty" ? timetable || [] : [],
        time_limit: timeLimit,
      },
    });
  };

  const isRunning = status === "running";
  const timeLimits = [5, 10, 30, 60, 120];

  return (
    <Dialog open onOpenChange={(open) => !open && !isRunning && onClose()}>
      <DialogContent className="max-w-3xl w-[95vw] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="p-5 border-b border-border-strong shrink-0 bg-background">
          <DialogTitle className="text-[15px] font-semibold">
            時間割 自動生成
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            登録されたマスタデータと制約条件をもとに時間割を自動生成します。生成後、適用モードに応じて時間割へ反映します。
          </p>

          {/* 概況テーブル（装飾カードの代わりにインラインテーブル） */}
          <div className="border border-border">
            <table className="w-full text-[12px]">
              <tbody className="divide-y divide-border">
                <tr>
                  <th className="w-[30%] bg-surface px-3 py-1.5 text-left font-medium text-muted-foreground">
                    学年数
                  </th>
                  <td className="px-3 py-1.5 tabular-nums">
                    {structure.grades.length}
                  </td>
                  <th className="w-[30%] bg-surface px-3 py-1.5 text-left font-medium text-muted-foreground border-l border-border">
                    総クラス
                  </th>
                  <td className="px-3 py-1.5 tabular-nums">{totalClasses}</td>
                </tr>
                <tr>
                  <th className="bg-surface px-3 py-1.5 text-left font-medium text-muted-foreground">
                    配置済みコマ
                  </th>
                  <td className="px-3 py-1.5 tabular-nums">{filledSlots}</td>
                  <th className="bg-surface px-3 py-1.5 text-left font-medium text-muted-foreground border-l border-border">
                    総教科数
                  </th>
                  <td className="px-3 py-1.5 tabular-nums">{totalSubjects}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* 最大探索時間 — segmented control 風 */}
            <div className="space-y-2">
              <h3 className="text-[12px] font-semibold text-foreground">
                最大探索時間
              </h3>
              <div className="inline-flex border border-border-strong -space-x-px">
                {timeLimits.map((t) => {
                  const active = timeLimit === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      disabled={isRunning}
                      onClick={() => setTimeLimit(t)}
                      className={`relative px-3 py-1.5 text-[12px] tabular-nums border-r border-border last:border-r-0 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 ${
                        active
                          ? "bg-primary text-primary-foreground z-10"
                          : "bg-background text-foreground hover:bg-surface"
                      }`}
                    >
                      {t}秒
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 適用モード */}
            <div className="space-y-2">
              <h3 className="text-[12px] font-semibold text-foreground">
                適用モード
              </h3>
              <RadioGroup
                value={overwriteMode}
                onValueChange={(v) => setOverwriteMode(v as "empty" | "all")}
                disabled={isRunning}
                className="flex flex-col gap-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="empty" id="mode-empty" />
                  <Label
                    htmlFor="mode-empty"
                    className="text-[12px] cursor-pointer"
                  >
                    空きコマのみ埋める
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="mode-all" />
                  <Label
                    htmlFor="mode-all"
                    className="text-[12px] cursor-pointer"
                  >
                    全て上書き（リセット）
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          {(isRunning || status === "done") && (
            <div className="space-y-2 border border-border px-3 py-2.5">
              <div className="flex items-center justify-between text-[12px]">
                <div className="flex items-center gap-2">
                  {isRunning ? (
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse"
                      aria-hidden
                    />
                  ) : (
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full bg-success"
                      aria-hidden
                    />
                  )}
                  <span className="font-medium">
                    {isRunning
                      ? `探索中 … ${elapsed}秒 / ${attempts}回試行`
                      : "生成完了"}
                  </span>
                </div>
                <span className="font-mono tabular-nums text-foreground">
                  {Math.round(progress)}%
                </span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
          )}

          {status === "error" && (
            <div className="border border-destructive/30 bg-destructive/10 text-destructive px-3 py-2 text-[12px]">
              <p className="font-semibold">エラーが発生しました</p>
              <p className="opacity-90">{errorMsg}</p>
            </div>
          )}

          {status === "done" && result && (
            <div className="border border-success/30 bg-success/10 text-success px-3 py-2 text-[12px]">
              <p className="font-semibold">自動生成に成功しました</p>
              <p className="opacity-90">{result.message}</p>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 border-t border-border-strong bg-background flex sm:justify-between items-center gap-3">
          <div className="flex-1">
            {isRunning ? (
              <Button variant="outline" size="sm" onClick={handleCancel}>
                中断
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={onClose}>
                キャンセル
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {status === "done" && result ? (
              <Button size="sm" onClick={handleApply}>
                時間割に適用
              </Button>
            ) : !isRunning ? (
              <Button size="sm" onClick={runBrowserSolver}>
                自動生成を開始
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
export default SolverPanel;
