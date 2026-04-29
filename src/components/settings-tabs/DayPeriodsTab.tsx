import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DAYS, PERIODS } from "@/constants";
import { getPeriodsForDay } from "@/lib/dayPeriods";
import type { DayOfWeek, Period } from "@/types";
import { useTimetableStore } from "../../store/useTimetableStore";

export default function DayPeriodsTab() {
  const { settings, updateDayMaxPeriod } = useTimetableStore();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[13px] font-semibold text-foreground">
          曜日ごとの授業時限数
        </h3>
        <p className="pt-1 text-[11px] text-muted-foreground">
          各曜日の最大時限数を設定します。最大時限を超えるコマは表示・編集・出力・自動生成の対象外になります。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        {DAYS.map((day) => (
          <div key={day} className="space-y-1">
            <Label
              htmlFor={`dayMaxPeriod-${day}`}
              className="text-[11px] text-muted-foreground"
            >
              {day}曜日
            </Label>
            <Select
              value={String(settings.day_periods?.[day] ?? 6)}
              onValueChange={(value) =>
                updateDayMaxPeriod(day as DayOfWeek, Number(value) as Period)
              }
            >
              <SelectTrigger id={`dayMaxPeriod-${day}`} className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((period) => (
                  <SelectItem key={period} value={String(period)}>
                    {period}限まで
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        {DAYS.map((day) => {
          const periods = getPeriodsForDay(settings, day as DayOfWeek);
          return (
            <section key={day} className="border border-border bg-background">
              <header className="border-b border-border bg-surface px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">
                {day}曜日の授業時限
              </header>
              <div className="flex flex-wrap gap-1 px-3 py-2">
                {periods.map((period) => (
                  <span
                    key={period}
                    className="rounded-sm border border-border px-2 py-0.5 text-[12px] tabular-nums text-foreground"
                  >
                    {period}限
                  </span>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
