import { useState } from "react";
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
import { Repeat, Plus, Trash2, AlertTriangle, ArrowLeftRight } from "lucide-react";

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
    const opts = [];
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

  const canAdd = form.class_key && form.subject_a && form.subject_b && form.subject_a !== form.subject_b && form.count >= 1;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center gap-2 border-l-4 border-primary pl-3 py-1">
        <Repeat className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-bold">隔週授業の設定</h3>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 text-xs text-amber-700 dark:text-amber-400">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          同じ時限に A週・B週で異なる教科を交互に行う「隔週授業」を設定します。
          {" "}<strong>required_hours の設定と合わせてください。</strong>
        </p>
      </div>

      {/* Add Form */}
      <Card className="border-primary/20 bg-primary/5 shadow-sm">
        <CardHeader className="pb-3 border-b border-primary/10">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-primary">
            <Plus className="h-4 w-4" />
            隔週ペアを追加
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">クラス区分</Label>
              <Select
                value={form.class_key}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, class_key: v, subject_a: "", subject_b: "" }))
                }
              >
                <SelectTrigger className="h-9 w-44">
                  <SelectValue placeholder="選択" />
                </SelectTrigger>
                <SelectContent>
                  {classKeyOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">A週の教科</Label>
              <Select
                value={form.subject_a}
                onValueChange={(v) => setForm((f) => ({ ...f, subject_a: v }))}
              >
                <SelectTrigger className="h-9 w-32">
                  <SelectValue placeholder="選択" />
                </SelectTrigger>
                <SelectContent>
                  {subjectsForKey(form.class_key).map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ArrowLeftRight className="h-4 w-4 text-muted-foreground mt-4" />

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">B週の教科</Label>
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
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">隔週スロット数</Label>
              <input
                type="number"
                min="1"
                max="10"
                value={form.count}
                onChange={(e) =>
                  setForm((f) => ({ ...f, count: Number(e.target.value) }))
                }
                className="h-9 w-16 text-center text-sm border rounded-md bg-background focus:ring-1 focus:ring-primary focus:outline-none px-2"
              />
            </div>

            <Button onClick={handleAdd} disabled={!canAdd} className="gap-2 h-9">
              <Plus className="h-4 w-4" />
              追加
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {(alt_week_pairs || []).length === 0 ? (
        <div className="py-10 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-muted-foreground gap-2">
          <Repeat className="h-10 w-10 opacity-20" />
          <p className="text-sm italic">隔週授業ペアはまだ登録されていません</p>
        </div>
      ) : (
        <Card className="shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/80 border-b">
                <th className="p-2.5 text-left font-bold text-muted-foreground">クラス区分</th>
                <th className="p-2.5 text-left font-bold text-muted-foreground">A週（主）</th>
                <th className="p-2.5 text-left font-bold text-muted-foreground">B週（副）</th>
                <th className="p-2.5 text-center font-bold text-muted-foreground">隔週スロット数</th>
                <th className="p-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {alt_week_pairs.map((pair) => (
                <tr key={pair.id} className="hover:bg-muted/10 transition-colors">
                  <td className="p-2.5">
                    <Badge variant="outline" className="font-normal text-xs">{classKeyLabel(pair.class_key)}</Badge>
                  </td>
                  <td className="p-2.5">
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 font-bold text-xs">
                      A: {pair.subject_a}
                    </Badge>
                  </td>
                  <td className="p-2.5">
                    <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 font-bold text-xs">
                      B: {pair.subject_b}
                    </Badge>
                  </td>
                  <td className="p-1 text-center">
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={pair.count}
                      onChange={(e) =>
                        updateAltWeekPair(pair.id, { count: Number(e.target.value) })
                      }
                      className="w-12 h-7 text-center text-xs border rounded-md bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </td>
                  <td className="p-2 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeAltWeekPair(pair.id)}
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
