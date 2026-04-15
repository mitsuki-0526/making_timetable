import { DAYS, PERIODS } from "@/constants";
import type { DayOfWeek, Period, SubjectPlacement } from "@/types";
import { useTimetableStore } from "../../store/useTimetableStore";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { BookOpen, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SubjectConstraintsTab() {
  const { structure, settings, subject_placement, updateSubjectPlacement } =
    useTimetableStore();
  const lunchAfter = settings.lunch_after_period ?? 4;

  const allSubjects = [
    ...new Set(
      Object.values(structure.required_hours || {}).flatMap((h) =>
        Object.keys(h),
      ),
    ),
  ].sort();

  const get = (subj: string, key: keyof SubjectPlacement) =>
    subject_placement[subj]?.[key];

  const updateNum = (
    subj: string,
    key: keyof SubjectPlacement,
    value: string,
  ) => {
    const num = value === "" ? null : parseInt(value, 10);
    updateSubjectPlacement(subj, { [key]: Number.isNaN(num) ? null : num });
  };

  const togglePeriod = (subj: string, period: Period) => {
    const current = (get(subj, "allowed_periods") as Period[]) || [];
    const next = current.includes(period)
      ? current.filter((p) => p !== period)
      : [...current, period].sort((a, b) => a - b);
    updateSubjectPlacement(subj, { allowed_periods: next });
  };

  const toggleDay = (subj: string, day: DayOfWeek) => {
    const current = (get(subj, "allowed_days") as DayOfWeek[]) || [];
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b));
    updateSubjectPlacement(subj, { allowed_days: next });
  };

  const toggle = (subj: string, key: keyof SubjectPlacement) => {
    updateSubjectPlacement(subj, { [key]: !get(subj, key) });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center gap-2 border-l-4 border-primary pl-3 py-1">
        <BookOpen className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-bold">教科ごとの配置制約</h3>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 text-xs text-blue-700 dark:text-blue-400">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          教科ごとに配置可能な時限・午後制限・分散設定をします。昼休みの境界は現在:{" "}
          <strong>{lunchAfter}限まで午前 / {lunchAfter + 1}限以降午後</strong> です。
        </p>
      </div>

      <Card className="shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted/80 border-b">
                <th className="p-2.5 text-left font-bold text-muted-foreground min-w-[72px]">教科</th>
                <th className="p-2.5 text-center font-bold text-muted-foreground min-w-[120px]">配置可能時限</th>
                <th className="p-2.5 text-center font-bold text-muted-foreground min-w-[120px]">配置可能曜日</th>
                <th className="p-2.5 text-center font-bold text-muted-foreground min-w-[60px]">
                  <span className="text-[10px]">1日最大</span>
                </th>
                <th className="p-2.5 text-center font-bold text-muted-foreground min-w-[52px]">
                  <span className="text-[10px]">午後1日</span>
                </th>
                <th className="p-2.5 text-center font-bold text-muted-foreground min-w-[52px]">
                  <span className="text-[10px]">午後分散</span>
                </th>
                <th className="p-2.5 text-center font-bold text-muted-foreground min-w-[52px]">
                  <span className="text-[10px]">全体分散</span>
                </th>
                <th className="p-2.5 text-center font-bold text-muted-foreground min-w-[52px]">
                  <span className="text-[10px]">2コマ</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {allSubjects.map((subj) => {
                const allowed = (get(subj, "allowed_periods") as Period[]) || [];
                const allowedDays =
                  (get(subj, "allowed_days") as DayOfWeek[]) || [];
                return (
                  <tr key={subj} className="group hover:bg-muted/10 transition-colors">
                    <td className="p-2.5">
                      <Badge variant="secondary" className="font-bold text-xs">{subj}</Badge>
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1 justify-center flex-wrap">
                        {PERIODS.map((p) => {
                          const isAM = p <= lunchAfter;
                          const active = allowed.includes(p as Period);
                          return (
                            <button
                              type="button"
                              key={p}
                              onClick={() => togglePeriod(subj, p as Period)}
                              className={cn(
                                "h-6 w-6 rounded text-[10px] font-bold border transition-all",
                                active
                                  ? isAM
                                    ? "bg-blue-500 text-white border-blue-600"
                                    : "bg-orange-400 text-white border-orange-500"
                                  : "bg-background border-border text-muted-foreground hover:border-primary/50",
                              )}
                            >
                              {p}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1 justify-center flex-wrap">
                        {DAYS.map((d) => {
                          const active = allowedDays.includes(d as DayOfWeek);
                          return (
                            <button
                              type="button"
                              key={d}
                              onClick={() => toggleDay(subj, d as DayOfWeek)}
                              className={cn(
                                "h-6 w-6 rounded text-[10px] font-bold border transition-all",
                                active
                                  ? "bg-blue-500 text-white border-blue-600"
                                  : "bg-background border-border text-muted-foreground hover:border-primary/50",
                              )}
                            >
                              {d}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="p-1 text-center">
                      <input
                        type="number"
                        min="1"
                        max="6"
                        value={String(get(subj, "max_daily") ?? "")}
                        onChange={(e) =>
                          updateNum(subj, "max_daily", e.target.value)
                        }
                        className="w-12 h-7 text-center text-xs border rounded-md bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                      />
                    </td>
                    <td className="p-1 text-center">
                      <input
                        type="number"
                        min="0"
                        max="6"
                        value={String(get(subj, "max_afternoon_daily") ?? "")}
                        onChange={(e) =>
                          updateNum(subj, "max_afternoon_daily", e.target.value)
                        }
                        className="w-12 h-7 text-center text-xs border rounded-md bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                      />
                    </td>
                    <td className="p-1 text-center">
                      <Checkbox
                        checked={!!get(subj, "afternoon_spread")}
                        onCheckedChange={() => toggle(subj, "afternoon_spread")}
                      />
                    </td>
                    <td className="p-1 text-center">
                      <Checkbox
                        checked={!!get(subj, "spread_days")}
                        onCheckedChange={() => toggle(subj, "spread_days")}
                      />
                    </td>
                    <td className="p-1 text-center">
                      <Checkbox
                        checked={!!get(subj, "requires_double")}
                        onCheckedChange={() => toggle(subj, "requires_double")}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
