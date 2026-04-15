import { useState } from "react";
import type { Teacher, DayOfWeek, Period } from "@/types";
import { useTimetableStore } from "../../store/useTimetableStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { 
  Users, 
  UserPlus, 
  Plus,
  Trash2, 
  CalendarOff, 
  GraduationCap, 
  BookOpen, 
  Settings2,
  Check,
  X,
  UserCog,
  Save,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DAYS, PERIODS } from "@/constants";
import TeacherGroupsTab from "./TeacherGroupsTab";

const TeachersTab = () => {
  const { structure, teachers, addTeacher, removeTeacher, updateTeacher } =
    useTimetableStore();

  const [teacherName, setTeacherName] = useState("");
  const [teacherSubjsArr, setTeacherSubjsArr] = useState<string[]>([]);
  const [teacherGradesArr, setTeacherGradesArr] = useState<number[]>([]);
  
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [editTeacherName, setEditTeacherName] = useState("");
  const [editTeacherSubjsArr, setEditTeacherSubjsArr] = useState<string[]>([]);
  const [editTeacherGradesArr, setEditTeacherGradesArr] = useState<number[]>([]);

  const subjectList = Array.from(
    new Set(
      Object.values(structure.required_hours).flatMap((gradeObj) =>
        Object.keys(gradeObj),
      ),
    ),
  );

  const toggleTeacherSubj = (subj: string) =>
    setTeacherSubjsArr((prev) =>
      prev.includes(subj) ? prev.filter((s) => s !== subj) : [...prev, subj],
    );

  const toggleTeacherGrade = (grade: number) =>
    setTeacherGradesArr((prev) =>
      prev.includes(grade) ? prev.filter((g) => g !== grade) : [...prev, grade],
    );

  const toggleEditSubj = (subj: string) =>
    setEditTeacherSubjsArr((prev) =>
      prev.includes(subj) ? prev.filter((s) => s !== subj) : [...prev, subj],
    );

  const toggleEditGrade = (grade: number) =>
    setEditTeacherGradesArr((prev) =>
      prev.includes(grade) ? prev.filter((g) => g !== grade) : [...prev, grade],
    );

  const startEditTeacher = (t: Teacher) => {
    setEditingTeacherId(t.id);
    setEditTeacherName(t.name);
    setEditTeacherSubjsArr([...t.subjects]);
    setEditTeacherGradesArr([...t.target_grades]);
  };

  const cancelEditTeacher = () => {
    setEditingTeacherId(null);
    setEditTeacherName("");
    setEditTeacherSubjsArr([]);
    setEditTeacherGradesArr([]);
  };

  const saveEditTeacher = () => {
    if (!editTeacherName.trim()) return;
    updateTeacher(editingTeacherId!, {
      name: editTeacherName.trim(),
      subjects: editTeacherSubjsArr,
      target_grades: editTeacherGradesArr.length
        ? editTeacherGradesArr
        : structure.grades.map((g) => g.grade),
    });
    cancelEditTeacher();
  };

  const handleAddTeacher = () => {
    if (teacherName.trim()) {
      addTeacher({
        name: teacherName.trim(),
        subjects: teacherSubjsArr,
        target_grades: teacherGradesArr.length
          ? teacherGradesArr
          : structure.grades.map((g) => g.grade),
        unavailable_times: [],
      });
      setTeacherName("");
      setTeacherSubjsArr([]);
      setTeacherGradesArr([]);
    }
  };

  const toggleUnavailable = (
    teacherId: string,
    day: DayOfWeek,
    period: Period,
  ) => {
    const teacher = teachers.find((t) => t.id === teacherId);
    if (!teacher) return;
    const exists = teacher.unavailable_times.some(
      (u) => u.day_of_week === day && u.period === period,
    );
    const newTimes = exists
      ? teacher.unavailable_times.filter(
          (u) => !(u.day_of_week === day && u.period === period),
        )
      : [
          ...teacher.unavailable_times,
          { day_of_week: day, period: period },
        ];
    updateTeacher(teacherId, { unavailable_times: newTimes });
  };

  const isUnavailable = (teacher: Teacher, day: DayOfWeek, period: Period) =>
    teacher.unavailable_times.some(
      (u) => u.day_of_week === day && u.period === period,
    );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-l-4 border-primary pl-3 py-1">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-bold">教員リストの管理</h3>
        </div>

        <Card className="border-primary/20 bg-primary/5 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-primary/10">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-primary">
              <UserPlus className="h-4 w-4" />
              新しい教員を登録
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-1 space-y-2">
                <Label htmlFor="teacherName" className="text-[10px] font-bold text-muted-foreground uppercase">教員名</Label>
                <Input
                  id="teacherName"
                  placeholder="例: 山田"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="md:col-span-1 space-y-2">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">担当教科</Label>
                <div className="flex flex-wrap gap-1.5">
                  {subjectList.map((s) => (
                    <Badge
                      key={s}
                      variant={teacherSubjsArr.includes(s) ? "primary" : "outline"}
                      className="cursor-pointer transition-all h-7"
                      onClick={() => toggleTeacherSubj(s)}
                    >
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="md:col-span-1 space-y-2">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">対象学年</Label>
                <div className="flex flex-wrap gap-1.5">
                  {structure.grades.map((g) => (
                    <Badge
                      key={g.grade}
                      variant={teacherGradesArr.includes(g.grade) ? "indigo" : "outline"}
                      className="cursor-pointer transition-all h-7 min-w-[32px] justify-center"
                      onClick={() => toggleTeacherGrade(g.grade)}
                    >
                      {g.grade}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="md:col-span-1 flex items-end">
                <Button
                  className="w-full gap-2 h-9 font-bold"
                  onClick={handleAddTeacher}
                  disabled={!teacherName.trim()}
                >
                  <Plus className="h-4 w-4" />
                  教員を追加
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-3">
          {teachers.length === 0 ? (
            <div className="py-12 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Users className="h-10 w-10 opacity-20" />
              <p className="text-sm italic">教員が登録されていません</p>
            </div>
          ) : (
            <Accordion type="single" collapsible className="space-y-2">
              {teachers.map((t) => {
                const isEditing = editingTeacherId === t.id;
                return (
                  <AccordionItem key={t.id} value={t.id} className="border rounded-lg px-2 bg-background hover:bg-muted/10 transition-colors shadow-sm overflow-hidden">
                    <div className="flex items-center w-full">
                      {isEditing ? (
                        <div className="flex-1 flex flex-wrap items-center gap-3 p-3">
                          <Input
                            className="w-32 h-8 text-sm"
                            value={editTeacherName}
                            onChange={(e) => setEditTeacherName(e.target.value)}
                          />
                          <div className="flex-1 flex flex-wrap gap-1">
                            {subjectList.map((s) => (
                              <Badge
                                key={s}
                                variant={editTeacherSubjsArr.includes(s) ? "primary" : "outline"}
                                className="cursor-pointer h-6 px-1.5 text-[10px]"
                                onClick={() => toggleEditSubj(s)}
                              >
                                {s}
                              </Badge>
                            ))}
                          </div>
                          <Separator orientation="vertical" className="h-6" />
                          <div className="flex gap-1">
                            {structure.grades.map((g) => (
                              <Badge
                                key={g.grade}
                                variant={editTeacherGradesArr.includes(g.grade) ? "indigo" : "outline"}
                                className="cursor-pointer h-6 w-6 justify-center p-0"
                                onClick={() => toggleEditGrade(g.grade)}
                              >
                                {g.grade}
                              </Badge>
                            ))}
                          </div>
                          <div className="flex gap-1 ml-auto">
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:bg-green-100" onClick={saveEditTeacher}>
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={cancelEditTeacher}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-between p-1 pl-2">
                          <AccordionTrigger className="flex-1 hover:no-underline py-2">
                            <div className="flex items-center gap-6">
                              <span className="font-bold flex items-center gap-2">
                                <UserCog className="h-4 w-4 text-primary" />
                                {t.name}
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {t.subjects.map(s => (
                                  <Badge key={s} variant="secondary" className="h-5 px-1.5 text-[10px] opacity-70 border-primary/20">{s}</Badge>
                                ))}
                                {t.target_grades.length > 0 && (
                                  <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-muted-foreground border-indigo-200 bg-indigo-50/10">
                                    {t.target_grades.join(", ")}学年
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </AccordionTrigger>
                          <div className="flex items-center gap-1 pr-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => startEditTeacher(t)}>
                              <Settings2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => removeTeacher(t.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                    <AccordionContent className="pt-2 pb-4 px-3 border-t bg-muted/5">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <CalendarOff className="h-4 w-4 text-destructive" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">勤務不可時間の設定</h4>
                        </div>
                        
                        <div className="rounded-lg border bg-background overflow-hidden shadow-sm max-w-2xl">
                          <table className="w-full text-[10px] border-collapse">
                            <thead>
                              <tr className="bg-muted/50 border-b">
                                <th className="w-10 py-1.5 border-r" />
                                {DAYS.map(day => (
                                  <th key={day} className="py-1.5 font-bold border-r last:border-r-0">{day}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {PERIODS.map(period => (
                                <tr key={period} className="border-b last:border-b-0">
                                  <td className="text-center font-bold bg-muted/20 border-r">{period}</td>
                                  {DAYS.map(day => {
                                    const active = isUnavailable(t, day as DayOfWeek, period as Period);
                                    return (
                                      <td 
                                        key={day} 
                                        className={cn(
                                          "p-0 border-r last:border-r-0 transition-colors cursor-pointer hover:bg-muted/30",
                                          active ? "bg-destructive/10" : ""
                                        )}
                                        onClick={() => toggleUnavailable(t.id, day as DayOfWeek, period as Period)}
                                      >
                                        <div className="flex items-center justify-center py-2 h-full">
                                          {active && <X className="h-3 w-3 text-destructive" />}
                                          {!active && <div className="h-3 w-3 rounded-full border border-muted-foreground/10 opacity-0 group-hover:opacity-100" />}
                                        </div>
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <p className="text-[10px] text-muted-foreground">※ クリックしたコマは配置の際に不可として扱われます。</p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </div>
      </section>

      <Separator className="my-10" />
      
      <TeacherGroupsTab />
    </div>
  );
};

export default TeachersTab;
