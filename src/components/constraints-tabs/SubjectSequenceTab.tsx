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
import { ArrowRight, Plus, Trash2, Info, ListOrdered } from "lucide-react";

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
  const [className, setClassName] = useState("");
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
      class_name: className || undefined,
      subject_a: subjectA,
      subject_b: subjectB,
    });
    setSubjectA("");
    setSubjectB("");
  };

  const canAdd = subjectA && subjectB && subjectA !== subjectB;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center gap-2 border-l-4 border-primary pl-3 py-1">
        <ListOrdered className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-bold">連続配置ペアの設定</h3>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 text-xs text-blue-700 dark:text-blue-400">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>指定した教科Aの直後（同日の次の時限）に教科Bを配置します。自動生成時に適用されます。</p>
      </div>

      {/* Add Form */}
      <Card className="border-primary/20 bg-primary/5 shadow-sm">
        <CardHeader className="pb-3 border-b border-primary/10">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-primary">
            <Plus className="h-4 w-4" />
            連続配置ペアを追加
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-3">
            {/* Grade */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">学年</Label>
              <Select
                value={grade}
                onValueChange={(v) => {
                  setGrade(v);
                  setClassName("");
                }}
              >
                <SelectTrigger className="h-9 w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(structure.grades || []).map((g) => (
                    <SelectItem key={g.grade} value={String(g.grade)}>{g.grade}年</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Class */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">クラス</Label>
              <Select
                value={className}
                onValueChange={setClassName}
              >
                <SelectTrigger className="h-9 w-32">
                  <SelectValue placeholder="学年全体" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">学年全体</SelectItem>
                  {classOpts.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject A */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">教科A（先に配置）</Label>
              <Select value={subjectA} onValueChange={setSubjectA}>
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

            <ArrowRight className="h-4 w-4 text-muted-foreground mt-4" />

            {/* Subject B */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">教科B（直後に配置）</Label>
              <Select value={subjectB} onValueChange={setSubjectB}>
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
      {(subject_sequences || []).length === 0 ? (
        <div className="py-10 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-muted-foreground gap-2">
          <ListOrdered className="h-10 w-10 opacity-20" />
          <p className="text-sm italic">連続配置ペアが登録されていません</p>
        </div>
      ) : (
        <Card className="shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/80 border-b">
                <th className="p-2.5 text-left font-bold text-muted-foreground">学年</th>
                <th className="p-2.5 text-left font-bold text-muted-foreground">クラス</th>
                <th className="p-2.5 text-left font-bold text-muted-foreground">教科A → 教科B</th>
                <th className="p-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {subject_sequences.map((seq) => (
                <tr key={seq.id} className="hover:bg-muted/10 transition-colors">
                  <td className="p-2.5">
                    <Badge variant="outline" className="font-normal text-xs">{seq.grade}年</Badge>
                  </td>
                  <td className="p-2.5 text-muted-foreground">
                    {seq.class_name || "学年全体"}
                  </td>
                  <td className="p-2.5">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 font-bold text-xs">
                        {seq.subject_a}
                      </Badge>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300 font-bold text-xs">
                        {seq.subject_b}
                      </Badge>
                      <span className="text-muted-foreground text-[10px] ml-1">（連続2コマ）</span>
                    </div>
                  </td>
                  <td className="p-2 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeSubjectSequence(seq.id)}
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
