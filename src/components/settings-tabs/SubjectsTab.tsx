import { useState } from "react";
import { useTimetableStore } from "../../store/useTimetableStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BookOpen,
  Plus,
  Trash2,
  ArrowRight,
  School,
  Info,
  Hash,
  CalendarRange,
  Wand2,
} from "lucide-react";

const SubjectsTab = () => {
  const {
    structure,
    settings,
    subject_constraints,
    addSubject,
    removeSubject,
    updateRequiredHours,
    updateSubjectConstraint,
    addMappingRule,
    removeMappingRule,
  } = useTimetableStore();

  const [newSubj, setNewSubj] = useState("");
  const [mapGrade, setMapGrade] = useState("1");
  const [mapFrom, setMapFrom] = useState("");
  const [mapTo, setMapTo] = useState("");

  const hwKeys: string[] = [];
  for (const g of structure.grades) {
    hwKeys.push(`${g.grade}_通常`);
    if (g.special_classes && g.special_classes.length > 0) {
      hwKeys.push(`${g.grade}_特支`);
    }
  }

  const subjectList = Array.from(
    new Set(
      Object.values(structure.required_hours).flatMap((gradeObj) =>
        Object.keys(gradeObj),
      ),
    ),
  );

  const handleAddSubject = () => {
    if (newSubj.trim()) {
      addSubject(newSubj.trim());
      setNewSubj("");
    }
  };

  const handleHourChange = (key: string, subj: string, val: string) => {
    updateRequiredHours(key, subj, val);
  };

  const handleMaxConsecutiveChange = (subj: string, val: string) => {
    const parsed = val === "" ? null : parseInt(val, 10);
    updateSubjectConstraint(subj, Number.isNaN(parsed) ? null : parsed);
  };

  const handleAddRule = () => {
    if (mapGrade && mapFrom.trim() && mapTo.trim()) {
      addMappingRule(parseInt(mapGrade, 10), mapFrom.trim(), mapTo.trim());
      setMapFrom("");
      setMapTo("");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Section 1: Subject Hours */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-l-4 border-primary pl-3 py-1">
          <BookOpen className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-bold">1. 教科の追加と規定時数・連続日数上限</h3>
        </div>

        {/* Add Subject */}
        <Card className="border-primary/20 bg-primary/5 shadow-sm">
          <CardHeader className="pb-3 border-b border-primary/10">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-primary">
              <Plus className="h-4 w-4" />
              新しい教科を追加
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Input
                placeholder="例: 国語、数学、理科..."
                value={newSubj}
                onChange={(e) => setNewSubj(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSubject()}
                className="max-w-xs h-9"
              />
              <Button
                onClick={handleAddSubject}
                disabled={!newSubj.trim()}
                className="gap-2 h-9"
              >
                <Plus className="h-4 w-4" />
                追加
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Hours Table */}
        {subjectList.length === 0 ? (
          <div className="py-12 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-muted-foreground gap-2">
            <BookOpen className="h-10 w-10 opacity-20" />
            <p className="text-sm italic">教科が登録されていません</p>
          </div>
        ) : (
          <Card className="shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/80 border-b">
                    <th className="p-2 text-left font-bold text-muted-foreground w-8" />
                    <th className="p-2 text-left font-bold text-muted-foreground min-w-[80px]">
                      <div className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        教科
                      </div>
                    </th>
                    {hwKeys.map((k) => (
                      <th key={k} className="p-2 text-center font-bold text-muted-foreground min-w-[52px]">
                        <div className="flex flex-col items-center gap-0.5">
                          <Hash className="h-3 w-3 opacity-60" />
                          <span className="text-[10px]">
                            {k.replace("_通常", "年").replace("_特支", "特支")}
                          </span>
                        </div>
                      </th>
                    ))}
                    <th className="p-2 text-center font-bold text-muted-foreground min-w-[72px]">
                      <div className="flex flex-col items-center gap-0.5" title="この日数以上連続して同じ教科が配置された場合に警告">
                        <CalendarRange className="h-3 w-3 opacity-60" />
                        <span className="text-[10px]">連続上限</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {subjectList.map((subj) => (
                    <tr key={subj} className="group hover:bg-muted/10 transition-colors">
                      <td className="p-1 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeSubject(subj)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                      <td className="p-2">
                        <Badge variant="secondary" className="font-bold text-xs">
                          {subj}
                        </Badge>
                      </td>
                      {hwKeys.map((k) => (
                        <td key={k} className="p-1 text-center">
                          <input
                            type="number"
                            min="0"
                            className="w-12 h-7 text-center text-xs border rounded-md bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                            value={structure.required_hours[k]?.[subj] || 0}
                            onChange={(e) =>
                              handleHourChange(k, subj, e.target.value)
                            }
                          />
                        </td>
                      ))}
                      <td className="p-1 text-center">
                        <input
                          type="number"
                          min="1"
                          max="5"
                          placeholder="−"
                          className="w-12 h-7 text-center text-xs border rounded-md bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                          value={
                            subject_constraints?.[subj]?.max_consecutive_days ?? ""
                          }
                          onChange={(e) =>
                            handleMaxConsecutiveChange(subj, e.target.value)
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>

      <Separator />

      {/* Section 2: Special Needs Mapping */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-l-4 border-amber-500 pl-3 py-1">
          <School className="h-5 w-5 text-amber-500" />
          <h3 className="text-lg font-bold">2. 特別支援学級の教科連動ルール</h3>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 text-xs text-amber-700 dark:text-amber-400">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <p>通常学級で左側の教科が設定された際、特別支援学級では右側の教科に自動で差し替えます。</p>
        </div>

        {/* Existing Rules */}
        <div className="space-y-2">
          {Object.entries(settings.mappingRules).flatMap(([g, rules]) =>
            Object.entries(rules).map(([fromS, toS]) => (
              <div
                key={`${g}-${fromS}`}
                className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-muted/10 transition-colors shadow-sm group"
              >
                <div className="flex items-center gap-3 text-sm">
                  <Badge variant="outline" className="text-[10px] border-amber-400/40 bg-amber-50/30 text-amber-700 dark:text-amber-400">
                    {g}年
                  </Badge>
                  <span className="font-bold text-foreground">{fromS}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <Badge variant="secondary" className="text-[10px] bg-amber-100/50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                    特支: {toS}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeMappingRule(parseInt(g, 10), fromS)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
          {Object.values(settings.mappingRules).every((r) => Object.keys(r).length === 0) && (
            <div className="py-8 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Wand2 className="h-8 w-8 opacity-20" />
              <p className="text-xs italic">連動ルールが登録されていません</p>
            </div>
          )}
        </div>

        {/* Add Rule Form */}
        <Card className="border-amber-200/50 bg-amber-50/20 dark:bg-amber-950/10 shadow-sm">
          <CardHeader className="pb-3 border-b border-amber-200/30">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Plus className="h-4 w-4" />
              連動ルールを追加
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">学年</Label>
                <Select value={mapGrade} onValueChange={setMapGrade}>
                  <SelectTrigger className="h-9 w-24">
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
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">通常学級の教科</Label>
                <Input
                  placeholder="例: 国語"
                  value={mapFrom}
                  onChange={(e) => setMapFrom(e.target.value)}
                  className="h-9 w-32"
                />
              </div>
              <div className="flex items-center pb-0.5">
                <ArrowRight className="h-4 w-4 text-muted-foreground mt-6" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">特支の教科</Label>
                <Input
                  placeholder="例: 自立"
                  value={mapTo}
                  onChange={(e) => setMapTo(e.target.value)}
                  className="h-9 w-32"
                />
              </div>
              <Button
                onClick={handleAddRule}
                disabled={!mapFrom.trim() || !mapTo.trim()}
                className="gap-2 h-9 bg-amber-600 hover:bg-amber-700 text-white"
              >
                <Plus className="h-4 w-4" />
                ルール登録
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default SubjectsTab;
