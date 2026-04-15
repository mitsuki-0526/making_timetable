import { useState } from "react";
import { DAYS, PERIODS } from "@/constants";
import type { DayOfWeek, FixedSlotScope, Period } from "@/types";
import { useTimetableStore } from "../../store/useTimetableStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Lock, Plus, Trash2, Info } from "lucide-react";

export default function FixedSlotsTab() {
  const { structure, fixed_slots, addFixedSlot, removeFixedSlot } =
    useTimetableStore();

  const [form, setForm] = useState<{
    scope: FixedSlotScope;
    grade: string;
    class_name: string;
    day_of_week: DayOfWeek;
    period: Period;
    subject: string;
    label: string;
  }>({
    scope: "all",
    grade: "",
    class_name: "",
    day_of_week: "月",
    period: 1,
    subject: "",
    label: "",
  });

  const allSubjects = [
    ...new Set(
      Object.values(structure.required_hours || {}).flatMap((h) =>
        Object.keys(h),
      ),
    ),
  ].sort();

  const gradeOptions = (structure.grades || []).map((g) => g.grade);
  const classOptions = form.grade
    ? (() => {
        const g = (structure.grades || []).find(
          (gr) => gr.grade === Number(form.grade),
        );
        if (!g) return [];
        return [...(g.classes || []), ...(g.special_classes || [])];
      })()
    : [];

  const handleAdd = () => {
    if (!form.subject) return;
    if (form.scope === "grade" && !form.grade) return;
    if (form.scope === "class" && (!form.grade || !form.class_name)) return;
    addFixedSlot({
      scope: form.scope,
      grade: form.scope !== "all" ? Number(form.grade) : undefined,
      class_name: form.scope === "class" ? form.class_name : undefined,
      day_of_week: form.day_of_week,
      period: Number(form.period) as Period,
      subject: form.subject,
      label: form.label || form.subject,
    });
    setForm((f) => ({ ...f, subject: "", label: "" }));
  };

  const scopeLabel = (
    scope: FixedSlotScope,
    grade?: number,
    class_name?: string,
  ) => {
    if (scope === "all") return "全校共通";
    if (scope === "grade") return `${grade}年生全クラス`;
    return `${grade}年 ${class_name}`;
  };

  const canAdd =
    form.subject &&
    (form.scope === "all" ||
      (form.scope === "grade" && form.grade) ||
      (form.scope === "class" && form.grade && form.class_name));

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center gap-2 border-l-4 border-primary pl-3 py-1">
        <Lock className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-bold">固定コマの設定</h3>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 text-xs text-blue-700 dark:text-blue-400">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>特定の曜日・時限に固定する授業を登録します。</p>
      </div>

      {/* Add Form */}
      <Card className="border-primary/20 bg-primary/5 shadow-sm">
        <CardHeader className="pb-3 border-b border-primary/10">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-primary">
            <Plus className="h-4 w-4" />
            固定コマを追加
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-3">
            {/* Scope */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">適用範囲</Label>
              <Select
                value={form.scope}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    scope: v as FixedSlotScope,
                    grade: "",
                    class_name: "",
                  }))
                }
              >
                <SelectTrigger className="h-9 w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全校共通</SelectItem>
                  <SelectItem value="grade">学年指定</SelectItem>
                  <SelectItem value="class">クラス指定</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Grade */}
            {form.scope !== "all" && (
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">学年</Label>
                <Select
                  value={form.grade}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, grade: v, class_name: "" }))
                  }
                >
                  <SelectTrigger className="h-9 w-24">
                    <SelectValue placeholder="選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {gradeOptions.map((g) => (
                      <SelectItem key={g} value={String(g)}>{g}年</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Class */}
            {form.scope === "class" && (
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">クラス</Label>
                <Select
                  value={form.class_name}
                  onValueChange={(v) => setForm((f) => ({ ...f, class_name: v }))}
                  disabled={!form.grade}
                >
                  <SelectTrigger className="h-9 w-24">
                    <SelectValue placeholder="選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {classOptions.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Day */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">曜日</Label>
              <Select
                value={form.day_of_week}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, day_of_week: v as DayOfWeek }))
                }
              >
                <SelectTrigger className="h-9 w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((d) => (
                    <SelectItem key={d} value={d}>{d}曜</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Period */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">時限</Label>
              <Select
                value={String(form.period)}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, period: Number(v) as Period }))
                }
              >
                <SelectTrigger className="h-9 w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODS.map((p) => (
                    <SelectItem key={p} value={String(p)}>{p}限</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">教科</Label>
              <Select
                value={form.subject}
                onValueChange={(v) => setForm((f) => ({ ...f, subject: v }))}
              >
                <SelectTrigger className="h-9 w-32">
                  <SelectValue placeholder="選択" />
                </SelectTrigger>
                <SelectContent>
                  {allSubjects.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleAdd} disabled={!canAdd} className="gap-2 h-9">
              <Plus className="h-4 w-4" />
              追加
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {(fixed_slots || []).length === 0 ? (
        <div className="py-10 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-muted-foreground gap-2">
          <Lock className="h-10 w-10 opacity-20" />
          <p className="text-sm italic">固定コマはまだ登録されていません</p>
        </div>
      ) : (
        <Card className="shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/80 border-b">
                <th className="p-2.5 text-left font-bold text-muted-foreground">適用範囲</th>
                <th className="p-2.5 text-left font-bold text-muted-foreground">曜日・時限</th>
                <th className="p-2.5 text-left font-bold text-muted-foreground">教科</th>
                <th className="p-2.5 text-left font-bold text-muted-foreground">ラベル</th>
                <th className="p-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {fixed_slots.map((slot) => (
                <tr key={slot.id} className="hover:bg-muted/10 transition-colors">
                  <td className="p-2.5">
                    <Badge variant="outline" className="text-xs font-normal">
                      {scopeLabel(slot.scope, slot.grade, slot.class_name)}
                    </Badge>
                  </td>
                  <td className="p-2.5">
                    <span className="font-bold">{slot.day_of_week}曜</span>
                    <span className="text-muted-foreground ml-1">{slot.period}限</span>
                  </td>
                  <td className="p-2.5">
                    <Badge variant="secondary" className="font-bold text-xs">{slot.subject}</Badge>
                  </td>
                  <td className="p-2.5 text-muted-foreground">{slot.label || "-"}</td>
                  <td className="p-2 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeFixedSlot(slot.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
