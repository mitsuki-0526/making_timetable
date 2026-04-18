import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DAYS, PERIODS } from "@/constants";
import { cn } from "@/lib/utils";
import type { DayOfWeek, Period, Teacher } from "@/types";
import { useTimetableStore } from "../../store/useTimetableStore";

const TeachersTab = () => {
  const { structure, teachers, addTeacher, removeTeacher, updateTeacher } =
    useTimetableStore();

  const [teacherName, setTeacherName] = useState("");
  const [teacherSubjsArr, setTeacherSubjsArr] = useState<string[]>([]);
  const [teacherGradesArr, setTeacherGradesArr] = useState<number[]>([]);

  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [editTeacherName, setEditTeacherName] = useState("");
  const [editTeacherSubjsArr, setEditTeacherSubjsArr] = useState<string[]>([]);
  const [editTeacherGradesArr, setEditTeacherGradesArr] = useState<number[]>(
    [],
  );

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
    if (!editingTeacherId || !editTeacherName.trim()) return;
    updateTeacher(editingTeacherId, {
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
      : [...teacher.unavailable_times, { day_of_week: day, period: period }];
    updateTeacher(teacherId, { unavailable_times: newTimes });
  };

  const isUnavailable = (teacher: Teacher, day: DayOfWeek, period: Period) =>
    teacher.unavailable_times.some(
      (u) => u.day_of_week === day && u.period === period,
    );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[13px] font-semibold text-foreground">
          教員リストの管理
        </h3>
        <p className="pt-1 text-[11px] text-muted-foreground">
          新しい教員を登録し、担当教科・対象学年・勤務不可時間を設定します。
        </p>
      </div>

      {/* Add Teacher Form */}
      <div className="border border-border bg-background px-4 py-3">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="space-y-1">
            <Label
              htmlFor="teacherName"
              className="text-[11px] text-muted-foreground"
            >
              教員名
            </Label>
            <Input
              id="teacherName"
              placeholder="例: 山田"
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">
              担当教科
            </Label>
            <div className="flex flex-wrap gap-1">
              {subjectList.map((s) => (
                <ToggleChip
                  key={s}
                  label={s}
                  active={teacherSubjsArr.includes(s)}
                  onClick={() => toggleTeacherSubj(s)}
                />
              ))}
              {subjectList.length === 0 && (
                <span className="text-[11px] text-muted-foreground">
                  教科を登録してください
                </span>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">
              対象学年
            </Label>
            <div className="flex flex-wrap gap-1">
              {structure.grades.map((g) => (
                <ToggleChip
                  key={g.grade}
                  label={String(g.grade)}
                  active={teacherGradesArr.includes(g.grade)}
                  onClick={() => toggleTeacherGrade(g.grade)}
                  narrow
                />
              ))}
            </div>
          </div>
          <div className="flex items-end">
            <Button
              className="h-9 w-full"
              onClick={handleAddTeacher}
              disabled={!teacherName.trim()}
              size="sm"
            >
              教員を追加
            </Button>
          </div>
        </div>
      </div>

      {/* Teacher List */}
      {teachers.length === 0 ? (
        <div className="border border-border bg-background px-3 py-3 text-[12px] text-muted-foreground">
          教員が登録されていません
        </div>
      ) : (
        <Accordion
          type="single"
          collapsible
          className="border border-border-strong bg-background divide-y divide-border"
        >
          {teachers.map((t) => {
            const isEditing = editingTeacherId === t.id;
            return (
              <AccordionItem key={t.id} value={t.id} className="border-0 px-0">
                <div className="flex items-center">
                  {isEditing ? (
                    <div className="flex w-full flex-wrap items-center gap-2 px-3 py-2">
                      <Input
                        className="h-8 w-32 text-[12px]"
                        value={editTeacherName}
                        onChange={(e) => setEditTeacherName(e.target.value)}
                      />
                      <div className="flex flex-1 flex-wrap gap-1">
                        {subjectList.map((s) => (
                          <ToggleChip
                            key={s}
                            label={s}
                            active={editTeacherSubjsArr.includes(s)}
                            onClick={() => toggleEditSubj(s)}
                          />
                        ))}
                      </div>
                      <div className="flex gap-1">
                        {structure.grades.map((g) => (
                          <ToggleChip
                            key={g.grade}
                            label={String(g.grade)}
                            active={editTeacherGradesArr.includes(g.grade)}
                            onClick={() => toggleEditGrade(g.grade)}
                            narrow
                          />
                        ))}
                      </div>
                      <div className="ml-auto flex gap-1">
                        <Button size="xs" onClick={saveEditTeacher}>
                          保存
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={cancelEditTeacher}
                        >
                          キャンセル
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex w-full items-center justify-between px-3 py-1">
                      <AccordionTrigger className="flex-1 py-2 hover:no-underline">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-[12px] font-semibold text-foreground">
                            {t.name}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {t.subjects.length > 0
                              ? t.subjects.join("・")
                              : "教科未設定"}
                          </span>
                          {t.target_grades.length > 0 && (
                            <span className="rounded-sm border border-border px-1 py-0.5 text-[10px] text-muted-foreground">
                              {t.target_grades.join("・")}年
                            </span>
                          )}
                        </div>
                      </AccordionTrigger>
                      <div className="flex items-center gap-1 pl-2">
                        <Button
                          variant="ghost"
                          size="xs"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => startEditTeacher(t)}
                        >
                          編集
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => removeTeacher(t.id)}
                        >
                          削除
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                <AccordionContent className="border-t border-border bg-surface/40 px-3 pt-2 pb-3">
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <h4 className="text-[12px] font-semibold text-foreground">
                        勤務不可時間
                      </h4>
                      <span className="text-[10px] text-muted-foreground">
                        クリックして切替
                      </span>
                    </div>
                    <div className="max-w-2xl overflow-hidden border border-border bg-background">
                      <table className="w-full border-collapse text-[11px]">
                        <thead>
                          <tr>
                            <th className="w-10 border-b border-r border-border bg-surface py-1 text-[10px] font-semibold text-muted-foreground" />
                            {DAYS.map((day) => (
                              <th
                                key={day}
                                className="border-b border-r border-border bg-surface py-1 text-center text-[11px] font-semibold text-muted-foreground last:border-r-0"
                              >
                                {day}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {PERIODS.map((period, pIdx) => {
                            const isLast = pIdx === PERIODS.length - 1;
                            return (
                              <tr key={period}>
                                <td
                                  className={`border-r border-border bg-surface text-center font-semibold text-muted-foreground tabular-nums ${!isLast ? "border-b" : ""}`}
                                >
                                  {period}
                                </td>
                                {DAYS.map((day) => {
                                  const active = isUnavailable(
                                    t,
                                    day as DayOfWeek,
                                    period as Period,
                                  );
                                  return (
                                    <td
                                      key={day}
                                      className={cn(
                                        "border-r border-border p-0 text-center last:border-r-0",
                                        !isLast && "border-b",
                                      )}
                                    >
                                      <button
                                        type="button"
                                        aria-pressed={active}
                                        className={cn(
                                          "flex h-6 w-full items-center justify-center cursor-pointer transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                                          active && "bg-destructive/10",
                                        )}
                                        onClick={() =>
                                          toggleUnavailable(
                                            t.id,
                                            day as DayOfWeek,
                                            period as Period,
                                          )
                                        }
                                      >
                                        {active && (
                                          <span className="text-[11px] font-semibold text-destructive">
                                            ×
                                          </span>
                                        )}
                                      </button>
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
};

const ToggleChip = ({
  label,
  active,
  onClick,
  narrow,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  narrow?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "h-7 rounded-sm border text-[11px] transition-colors",
      narrow ? "w-7 justify-center" : "px-2",
      active
        ? "border-foreground bg-foreground text-background"
        : "border-border bg-background text-foreground hover:border-border-strong",
    )}
  >
    {label}
  </button>
);

export default TeachersTab;
