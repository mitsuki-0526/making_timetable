import { useState } from "react";
import { useTimetableStore } from "../../store/useTimetableStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LayoutGrid,
  Plus,
  X,
  School,
  GraduationCap,
  Info,
} from "lucide-react";

const ClassesTab = () => {
  const { structure, addClass, removeClass } = useTimetableStore();
  const [newClassGrade, setNewClassGrade] = useState(
    String(structure.grades[0]?.grade ?? "1"),
  );
  const [newClassName, setNewClassName] = useState("");
  const [isNewClassSpecial, setIsNewClassSpecial] = useState(false);

  const handleAddClass = () => {
    if (newClassName.trim()) {
      addClass(
        parseInt(newClassGrade, 10),
        newClassName.trim(),
        isNewClassSpecial,
      );
      setNewClassName("");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center gap-2 border-l-4 border-primary pl-3 py-1">
        <LayoutGrid className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-bold">クラス編成の管理</h3>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200/50 text-xs text-orange-700 dark:text-orange-400">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>新しいクラスを追加します。既存のクラスを消すと、時間割上のそのクラスのコマも消去されます。</p>
      </div>

      {/* Add Class Form */}
      <Card className="border-primary/20 bg-primary/5 shadow-sm">
        <CardHeader className="pb-3 border-b border-primary/10">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-primary">
            <Plus className="h-4 w-4" />
            新しいクラスを追加
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">学年</Label>
              <Select value={newClassGrade} onValueChange={setNewClassGrade}>
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
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">クラス名</Label>
              <Input
                placeholder="例: 3組, 特支2"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddClass()}
                className="h-9 w-40"
              />
            </div>
            <div className="flex items-center gap-2 pb-0.5">
              <Checkbox
                id="isSpecial"
                checked={isNewClassSpecial}
                onCheckedChange={(v) => setIsNewClassSpecial(!!v)}
              />
              <Label htmlFor="isSpecial" className="text-sm cursor-pointer">
                特支枠として追加
              </Label>
            </div>
            <Button
              onClick={handleAddClass}
              disabled={!newClassName.trim()}
              className="gap-2 h-9"
            >
              <Plus className="h-4 w-4" />
              クラス追加
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Grade Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {structure.grades.map((g) => (
          <Card key={g.grade} className="shadow-sm overflow-hidden">
            <CardHeader className="pb-2 pt-3 px-4 border-b bg-muted/30">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-primary" />
                {g.grade}年生
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 px-4 pb-4">
              <div className="flex flex-wrap gap-2">
                {g.classes.map((c) => (
                  <div
                    key={`${g.grade}-${c}`}
                    className="flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 group"
                  >
                    <span>{c}</span>
                    <button
                      type="button"
                      className="h-4 w-4 rounded-full flex items-center justify-center hover:bg-destructive hover:text-white transition-colors opacity-50 group-hover:opacity-100"
                      onClick={() => removeClass(g.grade, c, false)}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
                {g.special_classes?.map((c) => (
                  <div
                    key={`${g.grade}-${c}-special`}
                    className="flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full text-xs font-semibold bg-amber-100/80 text-amber-800 border border-amber-300/50 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-600/30 group"
                  >
                    <School className="h-3 w-3" />
                    <span>{c}</span>
                    <Badge variant="outline" className="text-[8px] px-1 h-4 border-amber-400/40 text-amber-600 dark:text-amber-400 ml-0.5">特支</Badge>
                    <button
                      type="button"
                      className="h-4 w-4 rounded-full flex items-center justify-center hover:bg-destructive hover:text-white transition-colors opacity-50 group-hover:opacity-100"
                      onClick={() => removeClass(g.grade, c, true)}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
                {g.classes.length === 0 && (!g.special_classes || g.special_classes.length === 0) && (
                  <p className="text-xs text-muted-foreground italic">クラスなし</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ClassesTab;

