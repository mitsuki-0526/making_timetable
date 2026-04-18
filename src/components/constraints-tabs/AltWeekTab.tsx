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
import { useTimetableStore } from "../../store/useTimetableStore";

export default function AltWeekTab() {
  const {
    structure,
    alt_week_pairs,
    addAltWeekPair,
    removeAltWeekPair,
    updateAltWeekPair,
  } = useTimetableStore();

  const [form, setForm] = useState({
    class_key: "",
    subject_a: "",
    subject_b: "",
    count: 1,
  });

  const classKeyOptions = (structure.grades || []).flatMap((g) => {
    const opts: { value: string; label: string }[] = [];
    if ((g.classes || []).length > 0)
      opts.push({ value: `${g.grade}_通常`, label: `${g.grade}年 通常クラス` });
    if ((g.special_classes || []).length > 0)
      opts.push({ value: `${g.grade}_特支`, label: `${g.grade}年 特支クラス` });
    return opts;
  });

  const allSubjects = [
    ...new Set(
      Object.values(structure.required_hours || {}).flatMap((h) =>
        Object.keys(h),
      ),
    ),
  ].sort();

  const subjectsForKey = (key: string) =>
    key ? Object.keys(structure.required_hours[key] || {}) : allSubjects;

  const handleAdd = () => {
    if (!form.class_key || !form.subject_a || !form.subject_b) return;
    if (form.subject_a === form.subject_b) return;
    if (form.count < 1) return;
    addAltWeekPair({
      class_key: form.class_key,
      subject_a: form.subject_a,
      subject_b: form.subject_b,
      count: Number(form.count),
    });
    setForm((f) => ({ ...f, subject_a: "", subject_b: "", count: 1 }));
  };

  const classKeyLabel = (key: string) =>
    classKeyOptions.find((o) => o.value === key)?.label || key;

  const canAdd =
    !!form.class_key &&
    !!form.subject_a &&
    !!form.subject_b &&
    form.subject_a !== form.subject_b &&
    form.count >= 1;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[13px] font-semibold text-foreground">
          隔週授業の設定
        </h3>
        <p className="pt-1 text-[11px] text-muted-foreground">
          同じ時限に
          A週・B週で異なる教科を交互に行う「隔週授業」を設定します。規定時数と合わせて指定してください。
        </p>
      </div>

      {/* Add Form */}
      <div className="border border-border bg-background px-4 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">
              クラス区分
            </Label>
            <Select
              value={form.class_key}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  class_key: v,
                  subject_a: "",
                  subject_b: "",
                }))
              }
            >
              <SelectTrigger className="h-9 w-44">
                <SelectValue placeholder="選択" />
              </SelectTrigger>
              <SelectContent>
                {classKeyOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">
              A週の教科
            </Label>
            <Select
              value={form.subject_a}
              onValueChange={(v) => setForm((f) => ({ ...f, subject_a: v }))}
            >
              <SelectTrigger className="h-9 w-32">
                <SelectValue placeholder="選択" />
              </SelectTrigger>
              <SelectContent>
                {subjectsForKey(form.class_key).map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <span className="pb-2 text-muted-foreground">⇄</span>

          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">
              B週の教科
            </Label>
            <Select
              value={form.subject_b}
              onValueChange={(v) => setForm((f) => ({ ...f, subject_b: v }))}
            >
              <SelectTrigger className="h-9 w-32">
                <SelectValue placeholder="選択" />
              </SelectTrigger>
              <SelectContent>
                {subjectsForKey(form.class_key)
                  .filter((s) => s !== form.subject_a)
                  .map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">
              隔週スロット数
            </Label>
            <input
              type="number"
              min="1"
              max="10"
              value={form.count}
              onChange={(e) =>
                setForm((f) => ({ ...f, count: Number(e.target.value) }))
              }
              className="h-9 w-16 rounded-sm border border-input bg-background px-2 text-center text-[12px] tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <Button onClick={handleAdd} disabled={!canAdd} size="sm">
            追加
          </Button>
        </div>
      </div>

      {/* List */}
      {(alt_week_pairs || []).length === 0 ? (
        <div className="border border-border bg-background px-3 py-3 text-[12px] text-muted-foreground">
          隔週授業ペアが登録されていません
        </div>
      ) : (
        <div className="overflow-auto border border-border-strong bg-background">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr>
                <th className="border-b border-border bg-surface px-2 py-1.5 text-left text-[11px] font-semibold text-muted-foreground">
                  クラス区分
                </th>
                <th className="border-b border-l border-border bg-surface px-2 py-1.5 text-left text-[11px] font-semibold text-muted-foreground">
                  A週（主）
                </th>
                <th className="border-b border-l border-border bg-surface px-2 py-1.5 text-left text-[11px] font-semibold text-muted-foreground">
                  B週（副）
                </th>
                <th className="border-b border-l border-border bg-surface px-2 py-1.5 text-center text-[11px] font-semibold text-muted-foreground">
                  スロット数
                </th>
                <th
                  className="border-b border-l border-border bg-surface px-2 py-1.5 text-right text-[11px] font-semibold text-muted-foreground w-[64px]"
                  aria-label="削除"
                />
              </tr>
            </thead>
            <tbody>
              {alt_week_pairs.map((pair, idx) => {
                const isLast = idx === alt_week_pairs.length - 1;
                return (
                  <tr key={pair.id}>
                    <td
                      className={`px-2 py-1.5 text-muted-foreground ${!isLast ? "border-b border-border" : ""}`}
                    >
                      {classKeyLabel(pair.class_key)}
                    </td>
                    <td
                      className={`border-l border-border px-2 py-1.5 ${!isLast ? "border-b border-border" : ""}`}
                    >
                      <span className="text-muted-foreground">A:</span>{" "}
                      <span className="font-semibold text-foreground">
                        {pair.subject_a}
                      </span>
                    </td>
                    <td
                      className={`border-l border-border px-2 py-1.5 ${!isLast ? "border-b border-border" : ""}`}
                    >
                      <span className="text-muted-foreground">B:</span>{" "}
                      <span className="font-semibold text-foreground">
                        {pair.subject_b}
                      </span>
                    </td>
                    <td
                      className={`border-l border-border px-1 py-1 text-center ${!isLast ? "border-b border-border" : ""}`}
                    >
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={pair.count}
                        onChange={(e) =>
                          updateAltWeekPair(pair.id, {
                            count: Number(e.target.value),
                          })
                        }
                        className="h-7 w-12 rounded-sm border border-input bg-background text-center text-[12px] tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </td>
                    <td
                      className={`border-l border-border px-2 py-1 text-right ${!isLast ? "border-b border-border" : ""}`}
                    >
                      <Button
                        variant="ghost"
                        size="xs"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => removeAltWeekPair(pair.id)}
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
