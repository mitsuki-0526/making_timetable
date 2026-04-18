import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DAYS, PERIODS } from "@/constants";
import type { DayOfWeek, FixedSlotScope, Period } from "@/types";
import { useTimetableStore } from "../../store/useTimetableStore";

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
    if (scope === "grade") return `${grade}年 全クラス`;
    return `${grade}年 ${class_name}`;
  };

  const canAdd =
    !!form.subject &&
    (form.scope === "all" ||
      (form.scope === "grade" && !!form.grade) ||
      (form.scope === "class" && !!form.grade && !!form.class_name));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[13px] font-semibold text-foreground">
          固定コマの設定
        </h3>
        <p className="pt-1 text-[11px] text-muted-foreground">
          特定の曜日・時限に固定する授業を登録します（全校・学年・クラス単位で指定可能）。
        </p>
      </div>

      {/* Add Form */}
      <div className="border border-border bg-background px-4 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">
              適用範囲
            </Label>
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

          {form.scope !== "all" && (
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">学年</Label>
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
                    <SelectItem key={g} value={String(g)}>
                      {g}年
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {form.scope === "class" && (
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">
                クラス
              </Label>
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
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">曜日</Label>
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
                  <SelectItem key={d} value={d}>
                    {d}曜
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">時限</Label>
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
                  <SelectItem key={p} value={String(p)}>
                    {p}限
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">教科</Label>
            <Select
              value={form.subject}
              onValueChange={(v) => setForm((f) => ({ ...f, subject: v }))}
            >
              <SelectTrigger className="h-9 w-32">
                <SelectValue placeholder="選択" />
              </SelectTrigger>
              <SelectContent>
                {allSubjects.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleAdd} disabled={!canAdd} size="sm">
            追加
          </Button>
        </div>
      </div>

      {/* List */}
      {(fixed_slots || []).length === 0 ? (
        <div className="border border-border bg-background px-3 py-3 text-[12px] text-muted-foreground">
          固定コマが登録されていません
        </div>
      ) : (
        <div className="overflow-auto border border-border-strong bg-background">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr>
                <th className="border-b border-border bg-surface px-2 py-1.5 text-left text-[11px] font-semibold text-muted-foreground">
                  適用範囲
                </th>
                <th className="border-b border-l border-border bg-surface px-2 py-1.5 text-left text-[11px] font-semibold text-muted-foreground">
                  曜日・時限
                </th>
                <th className="border-b border-l border-border bg-surface px-2 py-1.5 text-left text-[11px] font-semibold text-muted-foreground">
                  教科
                </th>
                <th className="border-b border-l border-border bg-surface px-2 py-1.5 text-left text-[11px] font-semibold text-muted-foreground">
                  ラベル
                </th>
                <th
                  className="border-b border-l border-border bg-surface px-2 py-1.5 text-right text-[11px] font-semibold text-muted-foreground w-[64px]"
                  aria-label="削除"
                />
              </tr>
            </thead>
            <tbody>
              {fixed_slots.map((slot, idx) => {
                const isLast = idx === fixed_slots.length - 1;
                return (
                  <tr key={slot.id}>
                    <td
                      className={`px-2 py-1.5 text-muted-foreground ${!isLast ? "border-b border-border" : ""}`}
                    >
                      {scopeLabel(slot.scope, slot.grade, slot.class_name)}
                    </td>
                    <td
                      className={`border-l border-border px-2 py-1.5 ${!isLast ? "border-b border-border" : ""}`}
                    >
                      <span className="font-semibold text-foreground">
                        {slot.day_of_week}曜 {slot.period}限
                      </span>
                    </td>
                    <td
                      className={`border-l border-border px-2 py-1.5 ${!isLast ? "border-b border-border" : ""}`}
                    >
                      <span className="font-semibold text-foreground">
                        {slot.subject}
                      </span>
                    </td>
                    <td
                      className={`border-l border-border px-2 py-1.5 text-muted-foreground ${!isLast ? "border-b border-border" : ""}`}
                    >
                      {slot.label || "-"}
                    </td>
                    <td
                      className={`border-l border-border px-2 py-1 text-right ${!isLast ? "border-b border-border" : ""}`}
                    >
                      <Button
                        variant="ghost"
                        size="xs"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => removeFixedSlot(slot.id)}
                      >
                        削除
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
