import { useRef, useState } from "react";
import {
  Sparkles,
  Timer,
  Play,
  StopCircle,
  CheckCircle2,
  AlertCircle,
  Info,
  BarChart3,
  Users,
  BookOpen,
  Layers,
} from "lucide-react";
import type { SolverMessage, TimetableEntry } from "@/types";
import { useTimetableStore } from "../store/useTimetableStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

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
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const totalClasses = structure.grades.reduce(
    (s, g) => s + (g.classes?.length || 0) + (g.special_classes?.length || 0),
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

      const reqForClass = (grade: number, class_name: string) => {
        const isSpecial = /特支/.test(class_name);
        const key = `${grade}_${isSpecial ? "特支" : "通常"}`;
        return structure?.required_hours?.[key] || {};
      };

      const filteredNew: TimetableEntry[] = [];
      for (const e of result.timetable) {
        const slotKey = `${e.day_of_week}|${e.period}|${e.grade}|${e.class_name}`;
        if (existingKeys.has(slotKey)) continue;
        if (!e?.subject) continue;

        const k = classKey(e.grade, e.class_name);
        const req = reqForClass(e.grade, e.class_name);
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
          msg.required && msg.required > 0
            ? Math.round((msg.placed! / msg.required) * 100)
            : 100;
        setProgress(p);
        setResult({
          timetable: msg.timetable!,
          count: msg.count!,
          placed: msg.placed!,
          required: msg.required!,
          message:
            msg.required && msg.required > 0
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
        <DialogHeader className="p-6 border-b shrink-0 bg-muted/30">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Sparkles className="h-5 w-5 text-primary" />
            時間割 自動生成
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg border">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              登録されたマスタデータと制約に基づいて時間割を自動生成します。
              <br />
              複雑な条件はAIが自動的に調整を行い、最適な初期配置を作成します。
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "学年数", value: structure.grades.length, icon: Layers },
              { label: "総クラス", value: totalClasses, icon: Users },
              { label: "配置済み", value: filledSlots, icon: BarChart3 },
              { label: "総教科", value: totalSubjects, icon: BookOpen },
            ].map((stat) => (
              <Card key={stat.label} className="bg-muted/10">
                <CardContent className="p-3 flex flex-col items-center justify-center text-center">
                  <stat.icon className="h-4 w-4 text-muted-foreground mb-1" />
                  <div className="text-xl font-bold">{stat.value}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">
                    {stat.label}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 rounded-lg border space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Timer className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold">最大探索時間</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {timeLimits.map((t) => (
                  <Button
                    key={t}
                    type="button"
                    variant={timeLimit === t ? "default" : "outline"}
                    size="sm"
                    className="h-8 rounded-full"
                    disabled={isRunning}
                    onClick={() => setTimeLimit(t)}
                  >
                    {t}秒
                  </Button>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-lg border space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <Layers className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold">適用モード</h3>
              </div>
              <RadioGroup
                value={overwriteMode}
                onValueChange={(v) => setOverwriteMode(v as any)}
                disabled={isRunning}
                className="flex flex-col gap-3"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="empty" id="mode-empty" />
                  <Label
                    htmlFor="mode-empty"
                    className="text-sm cursor-pointer underline-offset-4 hover:underline"
                  >
                    空きコマのみ埋める
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value="all"
                    id="mode-all"
                    className="data-[state=checked]:bg-destructive data-[state=checked]:border-destructive"
                  />
                  <Label
                    htmlFor="mode-all"
                    className="text-sm cursor-pointer text-destructive/80 hover:text-destructive"
                  >
                    全て上書き（リセット）
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          {(isRunning || status === "done") && (
            <div className="space-y-3 p-4 bg-muted/30 rounded-lg border animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {isRunning ? (
                    <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                  <span className="font-medium">
                    {isRunning
                      ? `探索中 … ${elapsed}秒 / ${attempts}回試行`
                      : "生成完了"}
                  </span>
                </div>
                <span className="font-mono text-primary font-bold">
                  {Math.round(progress)}%
                </span>
              </div>
              <Progress value={progress} className="h-3" />
            </div>
          )}

          {status === "error" && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg flex gap-3">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div className="text-sm">
                <p className="font-bold">エラーが発生しました</p>
                <p className="opacity-90">{errorMsg}</p>
              </div>
            </div>
          )}

          {status === "done" && result && (
            <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 rounded-lg flex gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <div className="text-sm">
                <p className="font-bold">自動生成に成功しました</p>
                <p className="opacity-90">{result.message}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 border-t bg-muted/30 flex sm:justify-between items-center gap-4">
          <div className="flex-1">
            {isRunning ? (
              <Button
                variant="destructive"
                onClick={handleCancel}
                className="gap-2"
              >
                <StopCircle className="h-4 w-4" /> 中断
              </Button>
            ) : (
              <Button variant="ghost" onClick={onClose}>
                キャンセル
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {status === "done" && result ? (
              <Button
                onClick={handleApply}
                className="gap-2 bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle2 className="h-4 w-4" /> 時間割に適用する
              </Button>
            ) : !isRunning ? (
              <Button onClick={runBrowserSolver} className="gap-2">
                <Play className="h-4 w-4" /> 自動生成を開始
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
export default SolverPanel;
