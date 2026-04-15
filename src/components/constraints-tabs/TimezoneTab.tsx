import { PERIODS } from "@/constants";
import { useTimetableStore } from "../../store/useTimetableStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Utensils, Sun, Moon, Info, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function TimezoneTab() {
  const { settings, updateLunchPeriod } = useTimetableStore();
  const lunchAfter = settings.lunch_after_period ?? 4;

  const amPeriods = PERIODS.filter((p) => p <= lunchAfter);
  const pmPeriods = PERIODS.filter((p) => p > lunchAfter);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-start gap-3 p-4 bg-muted/40 rounded-lg border border-border/50">
        <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground leading-relaxed">
          昼休みの区切りを設定します。「午前」「午後」の判定は、教科配置制約（午前中指定など）の判定基準として使用されます。
        </p>
      </div>

      <Card className="border-primary/20 bg-primary/5 shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 py-2">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2.5 rounded-full border border-primary/20 shadow-inner">
                <Utensils className="h-5 w-5 text-primary" />
              </div>
              <Label
                htmlFor="lunchAfter"
                className="text-sm font-bold whitespace-nowrap"
              >
                昼休みの位置
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={String(lunchAfter)}
                onValueChange={(val) => updateLunchPeriod(Number(val))}
              >
                <SelectTrigger
                  id="lunchAfter"
                  className="w-[180px] h-9 border-primary/30"
                >
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
              <Badge variant="primary" className="h-9 px-3">
                に設定
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-11 items-center gap-4">
        {/* Morning Card */}
        <div className="md:col-span-4 h-full">
          <Card className="h-full border-sky-500/20 bg-sky-500/5 shadow-sm hover:ring-1 ring-sky-500/30 transition-all">
            <CardHeader className="py-3 items-center border-b border-sky-500/10">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-sky-600 dark:text-sky-400">
                <Sun className="h-4 w-4" />
                午前
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex flex-wrap justify-center gap-1.5">
              {amPeriods.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">なし</p>
              ) : (
                amPeriods.map((p) => (
                  <Badge
                    key={p}
                    variant="outline"
                    className="h-8 px-3 rounded-md bg-white/50 dark:bg-black/20 border-sky-200 dark:border-sky-900 font-bold"
                  >
                    {p}限
                  </Badge>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Separator / Lunch Icon */}
        <div className="md:col-span-1 flex flex-row md:flex-col items-center justify-center gap-2 py-4">
          <div className="h-[1px] md:h-10 w-10 md:w-[1px] bg-border/60" />
          <div className="flex flex-col items-center gap-1">
            <div className="bg-primary text-primary-foreground p-1.5 rounded-full shadow-md animate-pulse">
              <Utensils className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold text-primary tracking-tighter uppercase whitespace-nowrap">
              Lunch
            </span>
          </div>
          <div className="h-[1px] md:h-10 w-10 md:w-[1px] bg-border/60" />
        </div>

        {/* Afternoon Card */}
        <div className="md:col-span-4 h-full">
          <Card className="h-full border-orange-500/20 bg-orange-500/5 shadow-sm hover:ring-1 ring-orange-500/30 transition-all">
            <CardHeader className="py-3 items-center border-b border-orange-500/10">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-orange-600 dark:text-orange-400">
                <Moon className="h-4 w-4" />
                午後
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex flex-wrap justify-center gap-1.5">
              {pmPeriods.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">なし</p>
              ) : (
                pmPeriods.map((p) => (
                  <Badge
                    key={p}
                    variant="outline"
                    className="h-8 px-3 rounded-md bg-white/50 dark:bg-black/20 border-orange-200 dark:border-orange-900 font-bold"
                  >
                    {p}限
                  </Badge>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Preview Footer */}
        <div className="md:col-span-2 hidden md:flex flex-col items-center justify-center gap-2 pl-4 border-l border-dashed border-border/40">
          <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest leading-none">
            Status
          </div>
          <Badge
            variant="secondary"
            className="font-mono text-[10px] py-0 px-1.5 h-5 flex items-center gap-1"
          >
            <ArrowRight className="h-2.5 w-2.5" />
            ACTIVE
          </Badge>
        </div>
      </div>
    </div>
  );
}
