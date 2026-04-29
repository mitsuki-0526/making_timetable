import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PERIODS } from "@/constants";
import { useTimetableStore } from "../../store/useTimetableStore";

export default function TimezoneTab() {
  const { settings, updateLunchPeriod } = useTimetableStore();
  const lunchAfter = settings.lunch_after_period ?? 4;
  const amPeriods = PERIODS.filter((p) => p <= lunchAfter);
  const pmPeriods = PERIODS.filter((p) => p > lunchAfter);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[13px] font-semibold text-foreground">
          昼休みの設定
        </h3>
        <p className="pt-1 text-[11px] text-muted-foreground">
          昼休みの区切り位置を設定します。「午前」「午後」の判定は、教科配置制約で使用されます。
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label
            htmlFor="lunchAfter"
            className="text-[11px] text-muted-foreground"
          >
            昼休みの位置
          </Label>
          <Select
            value={String(lunchAfter)}
            onValueChange={(val) => updateLunchPeriod(Number(val))}
          >
            <SelectTrigger id="lunchAfter" className="h-9 w-48">
              <SelectValue placeholder="時期を選択" />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.slice(0, PERIODS.length - 1).map((p) => (
                <SelectItem key={p} value={String(p)}>
                  {p}限 と {p + 1}限 の間
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <section className="border border-border bg-background">
          <header className="border-b border-border bg-surface px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">
            午前
          </header>
          <div className="flex flex-wrap gap-1 px-3 py-2">
            {amPeriods.length === 0 ? (
              <span className="text-[11px] text-muted-foreground">なし</span>
            ) : (
              amPeriods.map((p) => (
                <span
                  key={p}
                  className="rounded-sm border border-border px-2 py-0.5 text-[12px] tabular-nums text-foreground"
                >
                  {p}限
                </span>
              ))
            )}
          </div>
        </section>

        <section className="border border-border bg-background">
          <header className="border-b border-border bg-surface px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">
            午後
          </header>
          <div className="flex flex-wrap gap-1 px-3 py-2">
            {pmPeriods.length === 0 ? (
              <span className="text-[11px] text-muted-foreground">なし</span>
            ) : (
              pmPeriods.map((p) => (
                <span
                  key={p}
                  className="rounded-sm border border-border px-2 py-0.5 text-[12px] tabular-nums text-foreground"
                >
                  {p}限
                </span>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
