import { useState } from "react";
import { useTimetableStore } from "../../store/useTimetableStore";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PairingsTab = () => {
  const {
    structure,
    subject_pairings,
    addSubjectPairing,
    removeSubjectPairing,
  } = useTimetableStore();

  const [pairGrade, setPairGrade] = useState(
    String(structure.grades[0]?.grade ?? "1"),
  );
  const [pairClassA, setPairClassA] = useState("");
  const [pairSubjectA, setPairSubjectA] = useState("");
  const [pairClassB, setPairClassB] = useState("");
  const [pairSubjectB, setPairSubjectB] = useState("");

  const pairGradeObj = structure.grades.find(
    (g) => String(g.grade) === pairGrade,
  );
  const pairAllClasses = pairGradeObj
    ? [...(pairGradeObj.classes || []), ...(pairGradeObj.special_classes || [])]
    : [];

  const subjectList = Array.from(
    new Set(
      Object.values(structure.required_hours).flatMap((gradeObj) =>
        Object.keys(gradeObj),
      ),
    ),
  );

  const handleAddPairing = () => {
    if (!pairClassA || !pairSubjectA || !pairClassB || !pairSubjectB) return;
    if (pairClassA === pairClassB) return;
    addSubjectPairing({
      grade: parseInt(pairGrade, 10),
      classA: pairClassA,
      subjectA: pairSubjectA,
      classB: pairClassB,
      subjectB: pairSubjectB,
    });
    setPairClassA("");
    setPairSubjectA("");
    setPairClassB("");
    setPairSubjectB("");
  };

  const isValid = !!(
    pairClassA &&
    pairSubjectA &&
    pairClassB &&
    pairSubjectB &&
    pairClassA !== pairClassB
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[13px] font-semibold text-foreground">
          抱き合わせ教科の設定
        </h3>
        <p className="pt-1 text-[11px] text-muted-foreground">
          同じ学年の2クラスで「AクラスにX教科を配置したとき、BクラスにY教科を自動配置」するルールを設定します（双方向に適用）。
        </p>
      </div>

      {/* Add Form */}
      <div className="border border-border bg-background px-4 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">学年</Label>
            <Select
              value={pairGrade}
              onValueChange={(v) => {
                setPairGrade(v);
                setPairClassA("");
                setPairClassB("");
              }}
            >
              <SelectTrigger className="h-9 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {structure.grades.map((g) => (
                  <SelectItem key={g.grade} value={String(g.grade)}>
                    {g.grade}年
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">
              クラスA
            </Label>
            <Select value={pairClassA} onValueChange={setPairClassA}>
              <SelectTrigger className="h-9 w-28">
                <SelectValue placeholder="選択" />
              </SelectTrigger>
              <SelectContent>
                {pairAllClasses.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">教科A</Label>
            <Select value={pairSubjectA} onValueChange={setPairSubjectA}>
              <SelectTrigger className="h-9 w-28">
                <SelectValue placeholder="選択" />
              </SelectTrigger>
              <SelectContent>
                {subjectList.map((s) => (
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
              クラスB
            </Label>
            <Select value={pairClassB} onValueChange={setPairClassB}>
              <SelectTrigger className="h-9 w-28">
                <SelectValue placeholder="選択" />
              </SelectTrigger>
              <SelectContent>
                {pairAllClasses
                  .filter((c) => c !== pairClassA)
                  .map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">教科B</Label>
            <Select value={pairSubjectB} onValueChange={setPairSubjectB}>
              <SelectTrigger className="h-9 w-28">
                <SelectValue placeholder="選択" />
              </SelectTrigger>
              <SelectContent>
                {subjectList.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleAddPairing} disabled={!isValid} size="sm">
            登録
          </Button>
        </div>
      </div>

      {/* List */}
      {subject_pairings.length === 0 ? (
        <div className="border border-border bg-background px-3 py-3 text-[12px] text-muted-foreground">
          抱き合わせルールが登録されていません
        </div>
      ) : (
        <div className="border border-border-strong bg-background divide-y divide-border">
          {subject_pairings.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-2 px-3 py-2 text-[12px]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-sm border border-border px-1 text-[10px] text-muted-foreground">
                  {p.grade}年
                </span>
                <span className="text-foreground">
                  <span className="text-muted-foreground">{p.classA}:</span>{" "}
                  <span className="font-semibold">{p.subjectA}</span>
                </span>
                <span className="text-muted-foreground">⇄</span>
                <span className="text-foreground">
                  <span className="text-muted-foreground">{p.classB}:</span>{" "}
                  <span className="font-semibold">{p.subjectB}</span>
                </span>
              </div>
              <Button
                variant="ghost"
                size="xs"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => removeSubjectPairing(p.id)}
              >
                削除
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PairingsTab;
