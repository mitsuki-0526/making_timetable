import type { TeacherConstraintSettings } from "@/types";
import { useTimetableStore } from "../../store/useTimetableStore";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserCheck, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export default function TeacherConstraintsTab() {
  const {
    teachers,
    structure,
    teacher_constraints,
    updateTeacherConstraintSettings,
  } = useTimetableStore();

  const get = (tid: string, key: keyof TeacherConstraintSettings) =>
    teacher_constraints[tid]?.[key] ?? "";
  const getBool = (tid: string, key: keyof TeacherConstraintSettings) =>
    !!teacher_constraints[tid]?.[key];

  const update = (
    tid: string,
    key: keyof TeacherConstraintSettings,
    value: string,
  ) => {
    const num = value === "" ? null : parseInt(value, 10);
    updateTeacherConstraintSettings(tid, {
      [key]: Number.isNaN(num) ? null : num,
    });
  };

  const updateStr = (
    tid: string,
    key: keyof TeacherConstraintSettings,
    value: string,
  ) => {
    updateTeacherConstraintSettings(tid, { [key]: value || null });
  };

  const updateBool = (tid: string, key: keyof TeacherConstraintSettings) => {
    updateTeacherConstraintSettings(tid, {
      [key]: !getBool(tid, key),
    } as Partial<TeacherConstraintSettings>);
  };

  const gradeOptions = (structure.grades || []).map((g) => g.grade);
  const getClassOptions = (tid: string) => {
    const hr_grade = teacher_constraints[tid]?.homeroom_grade;
    if (!hr_grade) return [];
    const g = (structure.grades || []).find(
      (gr) => gr.grade === Number(hr_grade),
    );
    if (!g) return [];
    return [...(g.classes || []), ...(g.special_classes || [])];
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center gap-2 border-l-4 border-primary pl-3 py-1">
        <UserCheck className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-bold">教員ごとの制約設定</h3>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 text-xs text-blue-700 dark:text-blue-400">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>教員ごとの授業コマ数制限・担任クラス・空きコマ集約を設定します。</p>
      </div>

      <Card className="shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted/80 border-b">
                <th className="p-2.5 text-left font-bold text-muted-foreground min-w-[80px]">教員名</th>
                <th className="p-2.5 text-left font-bold text-muted-foreground min-w-[100px]">担当教科</th>
                <th className="p-2.5 text-center font-bold text-muted-foreground min-w-[60px]">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px]">1日最大</span>
                  </div>
                </th>
                <th className="p-2.5 text-center font-bold text-muted-foreground min-w-[60px]">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px]">連続最大</span>
                  </div>
                </th>
                <th className="p-2.5 text-center font-bold text-muted-foreground min-w-[60px]">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px]">週最大</span>
                  </div>
                </th>
                <th className="p-2.5 text-center font-bold text-muted-foreground min-w-[72px]">担任学年</th>
                <th className="p-2.5 text-center font-bold text-muted-foreground min-w-[80px]">担任クラス</th>
                <th className="p-2.5 text-center font-bold text-muted-foreground min-w-[72px]">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px]">空きコマ</span>
                    <span className="text-[10px]">集約</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {teachers.map((t) => (
                <tr key={t.id} className="group hover:bg-muted/10 transition-colors">
                  <td className="p-2.5">
                    <span className="font-bold">{t.name}</span>
                  </td>
                  <td className="p-2.5">
                    <div className="flex flex-wrap gap-0.5">
                      {(t.subjects || []).map((s) => (
                        <Badge key={s} variant="secondary" className="h-4 px-1 text-[9px]">{s}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="p-1 text-center">
                    <input
                      type="number"
                      min="1"
                      max="6"
                      value={String(get(t.id, "max_daily"))}
                      onChange={(e) => update(t.id, "max_daily", e.target.value)}
                      className="w-12 h-7 text-center text-xs border rounded-md bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </td>
                  <td className="p-1 text-center">
                    <input
                      type="number"
                      min="1"
                      max="6"
                      value={String(get(t.id, "max_consecutive"))}
                      onChange={(e) =>
                        update(t.id, "max_consecutive", e.target.value)
                      }
                      className="w-12 h-7 text-center text-xs border rounded-md bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </td>
                  <td className="p-1 text-center">
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={String(get(t.id, "max_weekly"))}
                      onChange={(e) => update(t.id, "max_weekly", e.target.value)}
                      className="w-12 h-7 text-center text-xs border rounded-md bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </td>
                  <td className="p-1 text-center">
                    <Select
                      value={String(teacher_constraints[t.id]?.homeroom_grade ?? "")}
                      onValueChange={(v) =>
                        updateTeacherConstraintSettings(t.id, {
                          homeroom_grade: v ? Number(v) : null,
                          homeroom_class: null,
                        })
                      }
                    >
                      <SelectTrigger className="h-7 w-20 text-xs">
                        <SelectValue placeholder="なし" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">なし</SelectItem>
                        {gradeOptions.map((g) => (
                          <SelectItem key={g} value={String(g)}>
                            {g}年
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-1 text-center">
                    <Select
                      value={teacher_constraints[t.id]?.homeroom_class ?? ""}
                      onValueChange={(v) => updateStr(t.id, "homeroom_class", v)}
                      disabled={!teacher_constraints[t.id]?.homeroom_grade}
                    >
                      <SelectTrigger className="h-7 w-24 text-xs">
                        <SelectValue placeholder="なし" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">なし</SelectItem>
                        {getClassOptions(t.id).map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-1 text-center">
                    <Checkbox
                      checked={getBool(t.id, "consolidate_free")}
                      onCheckedChange={() => updateBool(t.id, "consolidate_free")}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
