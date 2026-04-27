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
import type {
  DayOfWeek,
  Period,
  SolverDoneMessage,
  SolverMessage,
  TimetableEntry,
} from "@/types";
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

interface Diagnostic {
  grade: number;
  class_name: string;
  subject: string;
  missing: number;
  reason: string;
  sample_slots?: {
    day: DayOfWeek;
    period: Period;
    candidates: {
      teacher_id: string | null;
      teacher_group_id: string | null;
      name?: string;
      dailyLoad?: number;
      weeklyLoad?: number;
    }[];
  }[];
}
const SolverPanel = ({ onClose }: SolverPanelProps) => {
  const {
    teachers,
    tt_assignments,
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
    teacher_constraints,
    subject_facility,
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
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const workerRef = useRef<Worker | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalClasses = structure.grades.reduce(
    (s, g) => s + (g.classes?.length || 0),
    0,
  );
  const getCandidateLabel = (candidate: {
    teacher_id: string | null;
    teacher_group_id: string | null;
    name?: string;
  }) => {
    if (candidate.name) return candidate.name;
    if (candidate.teacher_id) {
      return (
        teachers.find((teacher) => teacher.id === candidate.teacher_id)?.name ??
        candidate.teacher_id
      );
    }
    if (candidate.teacher_group_id) return candidate.teacher_group_id;
    return "候補なし";
  };
  const totalSubjects = Array.from(
    new Set(Object.values(structure.required_hours).flatMap(Object.keys)),
  ).length;
  const filledSlots = timetable.filter(
    (e) => e.subject || e.alt_subject,
  ).length;

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
        // done メッセージに任意で diagnostics が含まれる場合があるため
        // 型を拡張して安全に扱う
        const doneMsg = msg as SolverDoneMessage & {
          diagnostics?: Diagnostic[];
        };
        stopTimer();
        const p =
          doneMsg.required > 0
            ? Math.round((doneMsg.placed / doneMsg.required) * 100)
            : 100;
        setProgress(p);
        setResult({
          timetable: doneMsg.timetable,
          count: doneMsg.count,
          placed: doneMsg.placed,
          required: doneMsg.required,
          message:
            doneMsg.required > 0
              ? `${doneMsg.placed} / ${doneMsg.required} コマを配置しました（配置率 ${p}%）`
              : `${doneMsg.count} コマの時間割を生成しました。`,
        });
        setDiagnostics(doneMsg.diagnostics || []);
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
        teacher_groups: [],
        tt_assignments: tt_assignments || [],
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
        teacher_constraints: teacher_constraints || {},
        subject_facility: subject_facility || {},
      },
    });
  };

  const isRunning = status === "running";
  const timeLimits = [5, 10, 30, 60, 120];

  return (
    <Dialog open onOpenChange={(open) => !open && !isRunning && onClose()}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        style={{ maxWidth: "1200px", width: "95vw", height: "80vh" }}
        className="max-w-[1400px] w-[95vw] h-[80vh] overflow-hidden flex flex-col p-0 gap-0"
      >
        <DialogHeader className="p-5 border-b border-border-strong shrink-0 bg-background">
          <DialogTitle className="text-[15px] font-semibold">
            時間割 自動生成
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 space-y-5">
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            登録された基礎構成データと制約条件をもとに時間割を自動生成します。生成後、適用モードに応じて時間割へ反映します。
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
            <div
              className={
                result.required > 0 && result.placed < result.required
                  ? "border border-warning/40 bg-warning/10 text-warning px-3 py-2 text-[12px]"
                  : "border border-success/30 bg-success/10 text-success px-3 py-2 text-[12px]"
              }
            >
              <p className="font-semibold">
                {result.required > 0 && result.placed < result.required
                  ? "自動生成が部分的に完了しました"
                  : "自動生成に成功しました"}
              </p>
              <p className="opacity-90">{result.message}</p>
              {diagnostics && diagnostics.length > 0 && (
                <div className="mt-2 text-[12px] text-foreground">
                  <p className="font-medium">未配置の教科（診断）</p>
                  <ul className="list-disc ml-5">
                    {diagnostics.map((d) => (
                      <li
                        key={`${d.grade}-${d.class_name}-${d.subject}`}
                        className="leading-tight"
                      >
                        <div>
                          {d.grade}学年 {d.class_name} — {d.subject} ×
                          {d.missing}：{d.reason}
                        </div>
                        {d.sample_slots && d.sample_slots.length > 0 && (
                          <ul className="list-decimal ml-6 mt-1 text-[12px]">
                            {d.sample_slots.map((s) => (
                              <li
                                key={`${s.day}-${s.period}`}
                                className="leading-tight"
                              >
                                {s.day} / {s.period}限 — 候補:{" "}
                                {s.candidates
                                  .map((c) => {
                                    const label = getCandidateLabel(c);
                                    const load =
                                      typeof c.dailyLoad === "number" ||
                                      typeof c.weeklyLoad === "number"
                                        ? ` (日:${c.dailyLoad ?? 0} 週:${c.weeklyLoad ?? 0})`
                                        : "";
                                    return `${label}${load}`;
                                  })
                                  .join(", ")}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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
