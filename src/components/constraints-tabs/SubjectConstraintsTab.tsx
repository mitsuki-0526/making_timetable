import { DAYS, PERIODS } from "@/constants";
import type { DayOfWeek, Period, SubjectPlacement } from "@/types";
import { useTimetableStore } from "../../store/useTimetableStore";
import { Checkbox } from "@/components/ui/checkbox";
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
    <div className="space-y-4">
      <div>
        <h3 className="text-[13px] font-semibold text-foreground">
          教科ごとの配置制約
        </h3>
        <p className="pt-1 text-[11px] text-muted-foreground">
          教科ごとに配置可能な時限・曜日・午後制限・分散設定を行います。昼休み境界: {lunchAfter}限まで午前 / {lunchAfter + 1}限以降午後
        </p>
      </div>

      <div className="overflow-auto border border-border-strong bg-background">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr>
              <th className="border-b border-border bg-surface px-2 py-1.5 text-left text-[11px] font-semibold text-muted-foreground min-w-[72px]">
                教科
              </th>
              <th className="border-b border-l border-border bg-surface px-2 py-1.5 text-center text-[11px] font-semibold text-muted-foreground min-w-[160px]">
                配置可能時限
              </th>
              <th className="border-b border-l border-border bg-surface px-2 py-1.5 text-center text-[11px] font-semibold text-muted-foreground min-w-[140px]">
                配置可能曜日
              </th>
              <th className="border-b border-l border-border bg-surface px-2 py-1.5 text-center text-[11px] font-semibold text-muted-foreground min-w-[60px]">
                1日最大
              </th>
              <th className="border-b border-l border-border bg-surface px-2 py-1.5 text-center text-[11px] font-semibold text-muted-foreground min-w-[60px]">
                午後1日
              </th>
              <th className="border-b border-l border-border bg-surface px-2 py-1.5 text-center text-[11px] font-semibold text-muted-foreground min-w-[60px]">
                午後分散
              </th>
              <th className="border-b border-l border-border bg-surface px-2 py-1.5 text-center text-[11px] font-semibold text-muted-foreground min-w-[60px]">
                全体分散
              </th>
              <th className="border-b border-l border-border bg-surface px-2 py-1.5 text-center text-[11px] font-semibold text-muted-foreground min-w-[60px]">
                2コマ
              </th>
            </tr>
          </thead>
          <tbody>
            {allSubjects.map((subj, idx) => {
              const allowed = (get(subj, "allowed_periods") as Period[]) || [];
              const allowedDays =
                (get(subj, "allowed_days") as DayOfWeek[]) || [];
              const isLast = idx === allSubjects.length - 1;
              return (
                <tr key={subj}>
                  <td
                    className={`px-2 py-1 font-semibold text-foreground ${!isLast ? "border-b border-border" : ""}`}
                  >
                    {subj}
                  </td>
                  <td
                    className={`border-l border-border px-2 py-1 ${!isLast ? "border-b border-border" : ""}`}
                  >
                    <div className="flex flex-wrap justify-center gap-1">
                      {PERIODS.map((p) => {
                        const isPM = p > lunchAfter;
                        const active = allowed.includes(p as Period);
                        return (
                          <button
                            type="button"
                            key={p}
                            onClick={() => togglePeriod(subj, p as Period)}
                            className={cn(
                              "h-6 w-6 rounded-sm border text-[11px] tabular-nums transition-colors",
                              active
                                ? "border-foreground bg-foreground text-background"
                                : "border-border bg-background text-muted-foreground hover:border-border-strong",
                              isPM && !active && "bg-surface",
                            )}
                            title={isPM ? "午後" : "午前"}
                          >
                            {p}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td
                    className={`border-l border-border px-2 py-1 ${!isLast ? "border-b border-border" : ""}`}
                  >
                    <div className="flex flex-wrap justify-center gap-1">
                      {DAYS.map((d) => {
                        const active = allowedDays.includes(d as DayOfWeek);
                        return (
                          <button
                            type="button"
                            key={d}
                            onClick={() => toggleDay(subj, d as DayOfWeek)}
                            className={cn(
                              "h-6 w-6 rounded-sm border text-[11px] transition-colors",
                              active
                                ? "border-foreground bg-foreground text-background"
                                : "border-border bg-background text-muted-foreground hover:border-border-strong",
                            )}
                          >
                            {d}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td
                    className={`border-l border-border px-1 py-1 text-center ${!isLast ? "border-b border-border" : ""}`}
                  >
                    <input
                      type="number"
                      min="1"
                      max="6"
                      value={String(get(subj, "max_daily") ?? "")}
                      onChange={(e) =>
                        updateNum(subj, "max_daily", e.target.value)
                      }
                      className="h-7 w-12 rounded-sm border border-input bg-background text-center text-[12px] tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </td>
                  <td
                    className={`border-l border-border px-1 py-1 text-center ${!isLast ? "border-b border-border" : ""}`}
                  >
                    <input
                      type="number"
                      min="0"
                      max="6"
                      value={String(get(subj, "max_afternoon_daily") ?? "")}
                      onChange={(e) =>
                        updateNum(subj, "max_afternoon_daily", e.target.value)
                      }
                      className="h-7 w-12 rounded-sm border border-input bg-background text-center text-[12px] tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </td>
                  <td
                    className={`border-l border-border px-1 py-1 text-center ${!isLast ? "border-b border-border" : ""}`}
                  >
                    <Checkbox
                      checked={!!get(subj, "afternoon_spread")}
                      onCheckedChange={() => toggle(subj, "afternoon_spread")}
                    />
                  </td>
                  <td
                    className={`border-l border-border px-1 py-1 text-center ${!isLast ? "border-b border-border" : ""}`}
                  >
                    <Checkbox
                      checked={!!get(subj, "spread_days")}
                      onCheckedChange={() => toggle(subj, "spread_days")}
                    />
                  </td>
                  <td
                    className={`border-l border-border px-1 py-1 text-center ${!isLast ? "border-b border-border" : ""}`}
                  >
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
    </div>
  );
}
