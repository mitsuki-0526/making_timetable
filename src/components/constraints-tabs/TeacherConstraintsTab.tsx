import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TeacherConstraintSettings } from "@/types";
import { useTimetableStore } from "../../store/useTimetableStore";

const NONE_VALUE = "__none__";

export default function TeacherConstraintsTab() {
  const {
    teachers,
    structure,
    teacher_constraints,
    updateTeacherConstraintSettings,
  } = useTimetableStore();

  const get = (tid: string, key: keyof TeacherConstraintSettings) =>
    teacher_constraints[tid]?.[key] ?? "";
  const update = (
    tid: string,
    key: keyof TeacherConstraintSettings,
    value: string,
  ) => {
    const num = value === "" ? undefined : parseInt(value, 10);
    updateTeacherConstraintSettings(tid, {
      [key]: Number.isNaN(num) ? undefined : num,
    });
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
    <div className="space-y-4">
      <div>
        <h3 className="text-[13px] font-semibold text-foreground">
          教員ごとの制約設定
        </h3>
        <p className="pt-1 text-[11px] text-muted-foreground">
          教員ごとの授業コマ数制限・担任クラスを設定します。
        </p>
      </div>

      <div className="overflow-auto border border-border-strong bg-background">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr>
              <th className="border-b border-border bg-surface px-2 py-1.5 text-left text-[11px] font-semibold text-muted-foreground min-w-[96px]">
                教員名
              </th>
              <th className="border-b border-l border-border bg-surface px-2 py-1.5 text-left text-[11px] font-semibold text-muted-foreground min-w-[120px]">
                担当教科
              </th>
              <th className="border-b border-l border-border bg-surface px-2 py-1.5 text-center text-[11px] font-semibold text-muted-foreground min-w-[64px]">
                1日最大
              </th>
              <th className="border-b border-l border-border bg-surface px-2 py-1.5 text-center text-[11px] font-semibold text-muted-foreground min-w-[64px]">
                連続最大
              </th>
              <th className="border-b border-l border-border bg-surface px-2 py-1.5 text-center text-[11px] font-semibold text-muted-foreground min-w-[64px]">
                週最大
              </th>
              <th className="border-b border-l border-border bg-surface px-2 py-1.5 text-center text-[11px] font-semibold text-muted-foreground min-w-[80px]">
                担任学年
              </th>
              <th className="border-b border-l border-border bg-surface px-2 py-1.5 text-center text-[11px] font-semibold text-muted-foreground min-w-[88px]">
                担任クラス
              </th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((t, idx) => {
              const isLast = idx === teachers.length - 1;
              const hrGrade = teacher_constraints[t.id]?.homeroom_grade;
              const hrClass = teacher_constraints[t.id]?.homeroom_class;
              return (
                <tr key={t.id}>
                  <td
                    className={`px-2 py-1.5 font-semibold text-foreground ${!isLast ? "border-b border-border" : ""}`}
                  >
                    {t.name}
                  </td>
                  <td
                    className={`border-l border-border px-2 py-1.5 text-muted-foreground ${!isLast ? "border-b border-border" : ""}`}
                  >
                    {(t.subjects || []).length === 0
                      ? "－"
                      : (t.subjects || []).join("・")}
                  </td>
                  <td
                    className={`border-l border-border px-1 py-1 text-center ${!isLast ? "border-b border-border" : ""}`}
                  >
                    <input
                      type="number"
                      min="1"
                      max="6"
                      value={String(get(t.id, "max_daily"))}
                      onChange={(e) =>
                        update(t.id, "max_daily", e.target.value)
                      }
                      className="h-7 w-12 rounded-sm border border-input bg-background text-center text-[12px] tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </td>
                  <td
                    className={`border-l border-border px-1 py-1 text-center ${!isLast ? "border-b border-border" : ""}`}
                  >
                    <input
                      type="number"
                      min="1"
                      max="6"
                      value={String(get(t.id, "max_consecutive"))}
                      onChange={(e) =>
                        update(t.id, "max_consecutive", e.target.value)
                      }
                      className="h-7 w-12 rounded-sm border border-input bg-background text-center text-[12px] tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </td>
                  <td
                    className={`border-l border-border px-1 py-1 text-center ${!isLast ? "border-b border-border" : ""}`}
                  >
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={String(get(t.id, "max_weekly"))}
                      onChange={(e) =>
                        update(t.id, "max_weekly", e.target.value)
                      }
                      className="h-7 w-12 rounded-sm border border-input bg-background text-center text-[12px] tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </td>
                  <td
                    className={`border-l border-border px-1 py-1 text-center ${!isLast ? "border-b border-border" : ""}`}
                  >
                    <Select
                      value={hrGrade ? String(hrGrade) : NONE_VALUE}
                      onValueChange={(v) =>
                        updateTeacherConstraintSettings(t.id, {
                          homeroom_grade:
                            v === NONE_VALUE ? undefined : Number(v),
                          homeroom_class: undefined,
                        })
                      }
                    >
                      <SelectTrigger className="h-7 w-20 text-[12px]">
                        <SelectValue placeholder="なし" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>なし</SelectItem>
                        {gradeOptions.map((g) => (
                          <SelectItem key={g} value={String(g)}>
                            {g}年
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td
                    className={`border-l border-border px-1 py-1 text-center ${!isLast ? "border-b border-border" : ""}`}
                  >
                    <Select
                      value={hrClass || NONE_VALUE}
                      onValueChange={(v) =>
                        updateTeacherConstraintSettings(t.id, {
                          homeroom_class: v === NONE_VALUE ? undefined : v,
                        })
                      }
                      disabled={!hrGrade}
                    >
                      <SelectTrigger className="h-7 w-24 text-[12px]">
                        <SelectValue placeholder="なし" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>なし</SelectItem>
                        {getClassOptions(t.id).map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              );
            })}
            {teachers.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-3 text-center text-[12px] text-muted-foreground"
                >
                  教員が登録されていません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
