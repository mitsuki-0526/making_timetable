import { useState } from "react";
import { useTimetableStore } from "../../store/useTimetableStore";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const ALL_GRADE_VALUE = "__all__";

export default function SubjectSequenceTab() {
  const {
    structure,
    subject_sequences,
    addSubjectSequence,
    removeSubjectSequence,
  } = useTimetableStore();

  const allSubjects = [
    ...new Set(
      Object.values(structure.required_hours || {}).flatMap((h) =>
        Object.keys(h),
      ),
    ),
  ].sort();

  const [grade, setGrade] = useState(
    String(structure.grades?.[0]?.grade ?? "1"),
  );
  const [className, setClassName] = useState(ALL_GRADE_VALUE);
  const [subjectA, setSubjectA] = useState("");
  const [subjectB, setSubjectB] = useState("");

  const gradeObj = structure.grades?.find((g) => String(g.grade) === grade);
  const classOpts = gradeObj
    ? [...(gradeObj.classes || []), ...(gradeObj.special_classes || [])]
    : [];

  const handleAdd = () => {
    if (!subjectA || !subjectB) return;
    if (subjectA === subjectB) return;
    addSubjectSequence({
      grade: Number(grade),
      class_name: className === ALL_GRADE_VALUE ? null : className,
      subject_a: subjectA,
      subject_b: subjectB,
    });
    setSubjectA("");
    setSubjectB("");
  };

  const canAdd = !!subjectA && !!subjectB && subjectA !== subjectB;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[13px] font-semibold text-foreground">
          連続配置ペアの設定
        </h3>
        <p className="pt-1 text-[11px] text-muted-foreground">
          指定した教科Aの直後（同日の次の時限）に教科Bを配置します。自動生成時に適用されます。
        </p>
      </div>

      {/* Add Form */}
      <div className="border border-border bg-background px-4 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">学年</Label>
            <Select
              value={grade}
              onValueChange={(v) => {
                setGrade(v);
                setClassName(ALL_GRADE_VALUE);
              }}
            >
              <SelectTrigger className="h-9 w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(structure.grades || []).map((g) => (
                  <SelectItem key={g.grade} value={String(g.grade)}>
                    {g.grade}年
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">
              クラス
            </Label>
            <Select value={className} onValueChange={setClassName}>
              <SelectTrigger className="h-9 w-32">
                <SelectValue placeholder="学年全体" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_GRADE_VALUE}>学年全体</SelectItem>
                {classOpts.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">
              教科A（先）
            </Label>
            <Select value={subjectA} onValueChange={setSubjectA}>
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

          <span className="pb-2 text-muted-foreground">→</span>

          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">
              教科B（直後）
            </Label>
            <Select value={subjectB} onValueChange={setSubjectB}>
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
      {(subject_sequences || []).length === 0 ? (
        <div className="border border-border bg-background px-3 py-3 text-[12px] text-muted-foreground">
          連続配置ペアが登録されていません
        </div>
      ) : (
        <div className="overflow-auto border border-border-strong bg-background">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr>
                <th className="border-b border-border bg-surface px-2 py-1.5 text-left text-[11px] font-semibold text-muted-foreground w-[80px]">
                  学年
                </th>
                <th className="border-b border-l border-border bg-surface px-2 py-1.5 text-left text-[11px] font-semibold text-muted-foreground w-[120px]">
                  クラス
                </th>
                <th className="border-b border-l border-border bg-surface px-2 py-1.5 text-left text-[11px] font-semibold text-muted-foreground">
                  教科A → 教科B
                </th>
                <th
                  className="border-b border-l border-border bg-surface px-2 py-1.5 text-right text-[11px] font-semibold text-muted-foreground w-[64px]"
                  aria-label="削除"
                />
              </tr>
            </thead>
            <tbody>
              {subject_sequences.map((seq, idx) => {
                const isLast = idx === subject_sequences.length - 1;
                return (
                  <tr key={seq.id}>
                    <td
                      className={`px-2 py-1.5 ${!isLast ? "border-b border-border" : ""}`}
                    >
                      {seq.grade}年
                    </td>
                    <td
                      className={`border-l border-border px-2 py-1.5 text-muted-foreground ${!isLast ? "border-b border-border" : ""}`}
                    >
                      {seq.class_name || "学年全体"}
                    </td>
                    <td
                      className={`border-l border-border px-2 py-1.5 ${!isLast ? "border-b border-border" : ""}`}
                    >
                      <span className="font-semibold text-foreground">
                        {seq.subject_a}
                      </span>
                      <span className="mx-1.5 text-muted-foreground">→</span>
                      <span className="font-semibold text-foreground">
                        {seq.subject_b}
                      </span>
                      <span className="ml-2 text-[10px] text-muted-foreground">
                        （連続2コマ）
                      </span>
                    </td>
                    <td
                      className={`border-l border-border px-2 py-1 text-right ${!isLast ? "border-b border-border" : ""}`}
                    >
                      <Button
                        variant="ghost"
                        size="xs"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => removeSubjectSequence(seq.id)}
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
