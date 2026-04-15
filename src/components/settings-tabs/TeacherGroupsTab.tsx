import { useState } from "react";
import type { TeacherGroup } from "@/types";
import { useTimetableStore } from "../../store/useTimetableStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Users,
  UserPlus,
  Trash2,
  Settings2,
  Save,
  X,
  ChevronUp,
  ChevronDown,
  Check,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TeacherGroupsTab = () => {
  const {
    structure,
    teachers,
    teacher_groups,
    addTeacherGroup,
    updateTeacherGroup,
    removeTeacherGroup,
    moveTeacherGroup,
  } = useTimetableStore();

  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupTeacherIds, setNewGroupTeacherIds] = useState<string[]>([]);
  const [newGroupSubjects, setNewGroupSubjects] = useState<string[]>([]);
  const [newGroupGrades, setNewGroupGrades] = useState<number[]>([]);

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState("");
  const [editGroupTeacherIds, setEditGroupTeacherIds] = useState<string[]>([]);
  const [editGroupSubjects, setEditGroupSubjects] = useState<string[]>([]);
  const [editGroupGrades, setEditGroupGrades] = useState<number[]>([]);

  const subjectList = Array.from(
    new Set(
      Object.values(structure.required_hours).flatMap((gradeObj) =>
        Object.keys(gradeObj),
      ),
    ),
  );

  const toggleGroupTeacher = (tid: string) =>
    setNewGroupTeacherIds((prev) =>
      prev.includes(tid) ? prev.filter((id) => id !== tid) : [...prev, tid],
    );

  const toggleGroupSubject = (s: string) =>
    setNewGroupSubjects((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );

  const toggleGroupGrade = (g: number) =>
    setNewGroupGrades((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
    );

  const handleAddGroup = () => {
    if (!newGroupName.trim() || newGroupTeacherIds.length === 0) return;
    addTeacherGroup({
      name: newGroupName.trim(),
      teacher_ids: newGroupTeacherIds,
      subjects: newGroupSubjects,
      target_grades: newGroupGrades,
    });
    setNewGroupName("");
    setNewGroupTeacherIds([]);
    setNewGroupSubjects([]);
    setNewGroupGrades([]);
  };

  const startEditGroup = (g: TeacherGroup) => {
    setEditingGroupId(g.id);
    setEditGroupName(g.name);
    setEditGroupTeacherIds([...g.teacher_ids]);
    setEditGroupSubjects([...(g.subjects || [])]);
    setEditGroupGrades([...(g.target_grades || [])]);
  };

  const cancelEditGroup = () => {
    setEditingGroupId(null);
    setEditGroupName("");
    setEditGroupTeacherIds([]);
    setEditGroupSubjects([]);
    setEditGroupGrades([]);
  };

  const saveEditGroup = () => {
    if (!editGroupName.trim() || editGroupTeacherIds.length === 0) return;
    updateTeacherGroup(editingGroupId!, {
      name: editGroupName.trim(),
      teacher_ids: editGroupTeacherIds,
      subjects: editGroupSubjects,
      target_grades: editGroupGrades,
    });
    cancelEditGroup();
  };

  const toggleEditGroupTeacher = (tid: string) =>
    setEditGroupTeacherIds((prev) =>
      prev.includes(tid) ? prev.filter((id) => id !== tid) : [...prev, tid],
    );

  const toggleEditGroupSubject = (s: string) =>
    setEditGroupSubjects((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );

  const toggleEditGroupGrade = (g: number) =>
    setEditGroupGrades((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
    );

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 border-l-4 border-purple-500 pl-3 py-1">
        <Layers className="h-5 w-5 text-purple-500" />
        <h3 className="text-lg font-bold">教員グループの管理</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        道徳・総合など複数の先生が担当する教科に使用するグループを作成します。
      </p>

      {/* Add Group Form */}
      <Card className="border-purple-200/50 bg-purple-50/20 dark:bg-purple-950/10 shadow-sm">
        <CardHeader className="pb-3 border-b border-purple-200/30">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-purple-700 dark:text-purple-400">
            <UserPlus className="h-4 w-4" />
            新しいグループを作成
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="newGroupName" className="text-[10px] font-bold uppercase text-muted-foreground">グループ名</Label>
            <Input
              id="newGroupName"
              placeholder="例: 1年道徳グループ"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="h-9 max-w-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase text-muted-foreground">メンバー（複数選択可）</Label>
            <div className="flex flex-wrap gap-1.5">
              {teachers.map((t) => {
                const selected = newGroupTeacherIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleGroupTeacher(t.id)}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all",
                      selected
                        ? "bg-purple-600 text-white border-purple-600"
                        : "bg-background border-border text-foreground hover:border-purple-400",
                    )}
                  >
                    {selected && <Check className="h-3 w-3" />}
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">担当教科</Label>
              <div className="flex flex-wrap gap-1.5">
                {subjectList.map((s) => {
                  const selected = newGroupSubjects.includes(s);
                  return (
                    <Badge
                      key={s}
                      variant={selected ? "secondary" : "outline"}
                      className={cn("cursor-pointer h-6 transition-all", selected && "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300")}
                      onClick={() => toggleGroupSubject(s)}
                    >
                      {s}
                    </Badge>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">対象学年</Label>
              <div className="flex flex-wrap gap-1.5">
                {structure.grades.map((g) => {
                  const selected = newGroupGrades.includes(g.grade);
                  return (
                    <Badge
                      key={g.grade}
                      variant={selected ? "secondary" : "outline"}
                      className={cn("cursor-pointer h-6 w-8 justify-center transition-all", selected && "bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-300")}
                      onClick={() => toggleGroupGrade(g.grade)}
                    >
                      {g.grade}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </div>

          <Button
            onClick={handleAddGroup}
            disabled={!newGroupName.trim() || newGroupTeacherIds.length === 0}
            className="gap-2 h-9 bg-purple-600 hover:bg-purple-700 text-white"
          >
            <UserPlus className="h-4 w-4" />
            グループを作成
          </Button>
        </CardContent>
      </Card>

      {/* Group List */}
      {teacher_groups.length === 0 ? (
        <div className="py-10 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-muted-foreground gap-2">
          <Layers className="h-10 w-10 opacity-20" />
          <p className="text-sm italic">グループが登録されていません</p>
        </div>
      ) : (
        <div className="space-y-2">
          {teacher_groups.map((g, idx) => {
            const isEditing = editingGroupId === g.id;
            const memberNames = g.teacher_ids
              .map((id) => teachers.find((t) => t.id === id)?.name || id)
              .join("・");
            return (
              <Card key={g.id} className="shadow-sm overflow-hidden">
                {isEditing ? (
                  <CardContent className="p-4 space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">グループ名</Label>
                      <Input
                        value={editGroupName}
                        onChange={(e) => setEditGroupName(e.target.value)}
                        className="h-9 max-w-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">メンバー</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {teachers.map((t) => {
                          const selected = editGroupTeacherIds.includes(t.id);
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => toggleEditGroupTeacher(t.id)}
                              className={cn(
                                "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all",
                                selected
                                  ? "bg-purple-600 text-white border-purple-600"
                                  : "bg-background border-border text-foreground hover:border-purple-400",
                              )}
                            >
                              {selected && <Check className="h-3 w-3" />}
                              {t.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">担当教科</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {subjectList.map((s) => {
                            const selected = editGroupSubjects.includes(s);
                            return (
                              <Badge
                                key={s}
                                variant={selected ? "secondary" : "outline"}
                                className={cn("cursor-pointer h-6 transition-all", selected && "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300")}
                                onClick={() => toggleEditGroupSubject(s)}
                              >
                                {s}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">対象学年</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {structure.grades.map((gradeObj) => {
                            const selected = editGroupGrades.includes(gradeObj.grade);
                            return (
                              <Badge
                                key={gradeObj.grade}
                                variant={selected ? "secondary" : "outline"}
                                className={cn("cursor-pointer h-6 w-8 justify-center transition-all", selected && "bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-300")}
                                onClick={() => toggleEditGroupGrade(gradeObj.grade)}
                              >
                                {gradeObj.grade}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="default" className="gap-2 bg-green-600 hover:bg-green-700 text-white" onClick={saveEditGroup}>
                        <Save className="h-3.5 w-3.5" />
                        保存
                      </Button>
                      <Button size="sm" variant="outline" className="gap-2" onClick={cancelEditGroup}>
                        <X className="h-3.5 w-3.5" />
                        キャンセル
                      </Button>
                    </div>
                  </CardContent>
                ) : (
                  <div className="flex items-center justify-between p-3 group">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          disabled={idx === 0}
                          onClick={() => moveTeacherGroup(g.id, "up")}
                        >
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          disabled={idx === teacher_groups.length - 1}
                          onClick={() => moveTeacherGroup(g.id, "down")}
                        >
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </div>
                      <div>
                        <div className="font-bold text-sm flex items-center gap-2">
                          <Layers className="h-4 w-4 text-purple-500" />
                          {g.name}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {memberNames}（{g.teacher_ids.length}名）
                          {g.subjects && g.subjects.length > 0 && (
                            <span className="ml-2">
                              {g.subjects.map((s) => (
                                <Badge key={s} variant="secondary" className="h-4 px-1 text-[9px] ml-0.5">{s}</Badge>
                              ))}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => startEditGroup(g)}>
                        <Settings2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeTeacherGroup(g.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default TeacherGroupsTab;
