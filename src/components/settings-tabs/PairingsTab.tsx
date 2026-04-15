import { useState } from "react";
import { useTimetableStore } from "../../store/useTimetableStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Link2,
  Plus,
  Trash2,
  Info,
  ArrowLeftRight,
  BookOpen,
  Layers,
} from "lucide-react";

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

  const isValid = !!(pairClassA && pairSubjectA && pairClassB && pairSubjectB && pairClassA !== pairClassB);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center gap-2 border-l-4 border-primary pl-3 py-1">
        <Link2 className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-bold">抱き合わせ教科の設定</h3>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 text-xs text-blue-700 dark:text-blue-400">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>同じ学年の2クラスで「AクラスにX教科を配置したとき、BクラスにY教科を自動配置」するルールを設定します。双方向に適用されます。</p>
      </div>

      {/* Form */}
      <Card className="border-primary/20 bg-primary/5 shadow-sm">
        <CardHeader className="pb-3 border-b border-primary/10">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-primary">
            <Plus className="h-4 w-4" />
            抱き合わせルールを追加
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-4">
            {/* Grade */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">学年</Label>
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

            {/* Class A */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">クラスA</Label>
              <Select value={pairClassA} onValueChange={setPairClassA}>
                <SelectTrigger className="h-9 w-28">
                  <SelectValue placeholder="選択" />
                </SelectTrigger>
                <SelectContent>
                  {pairAllClasses.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject A */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">教科A</Label>
              <Select value={pairSubjectA} onValueChange={setPairSubjectA}>
                <SelectTrigger className="h-9 w-28">
                  <SelectValue placeholder="選択" />
                </SelectTrigger>
                <SelectContent>
                  {subjectList.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center pb-0.5">
              <ArrowLeftRight className="h-5 w-5 text-primary mt-6" />
            </div>

            {/* Class B */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">クラスB</Label>
              <Select value={pairClassB} onValueChange={setPairClassB}>
                <SelectTrigger className="h-9 w-28">
                  <SelectValue placeholder="選択" />
                </SelectTrigger>
                <SelectContent>
                  {pairAllClasses
                    .filter((c) => c !== pairClassA)
                    .map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject B */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">教科B</Label>
              <Select value={pairSubjectB} onValueChange={setPairSubjectB}>
                <SelectTrigger className="h-9 w-28">
                  <SelectValue placeholder="選択" />
                </SelectTrigger>
                <SelectContent>
                  {subjectList.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleAddPairing}
              disabled={!isValid}
              className="gap-2 h-9"
            >
              <Plus className="h-4 w-4" />
              登録
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Existing Pairings */}
      {subject_pairings.length === 0 ? (
        <div className="py-10 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-muted-foreground gap-2">
          <Link2 className="h-10 w-10 opacity-20" />
          <p className="text-sm italic">抱き合わせルールが登録されていません</p>
        </div>
      ) : (
        <div className="space-y-2">
          {subject_pairings.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-muted/10 transition-colors shadow-sm group"
            >
              <div className="flex items-center gap-3 flex-wrap text-sm">
                <Badge variant="outline" className="text-[10px] border-primary/30 bg-primary/5">
                  {p.grade}年
                </Badge>
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary" className="font-bold text-xs">{p.classA}</Badge>
                  <BookOpen className="h-3 w-3 text-muted-foreground" />
                  <span className="font-semibold text-foreground">{p.subjectA}</span>
                </div>
                <ArrowLeftRight className="h-4 w-4 text-primary" />
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary" className="font-bold text-xs">{p.classB}</Badge>
                  <BookOpen className="h-3 w-3 text-muted-foreground" />
                  <span className="font-semibold text-foreground">{p.subjectB}</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeSubjectPairing(p.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PairingsTab;

