import { useState } from "react";
import type { Participant } from "@/types";
import { useTimetableStore } from "../../store/useTimetableStore";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Users,
  UserPlus,
  Trash2,
  Plus,
  Check,
  X,
  Layers,
  GraduationCap,
  School,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ClassGroupsTab = () => {
  const {
    structure,
    class_groups,
    cross_grade_groups,
    addClassGroup,
    removeClassGroup,
    addSplitSubject,
    removeSplitSubject,
    addCrossGradeGroup,
    removeCrossGradeGroup,
  } = useTimetableStore();

  const [cgGrade, setCgGrade] = useState(
    String(structure.grades[0]?.grade ?? "1"),
  );
  const [cgClasses, setCgClasses] = useState<string[]>([]);
  const [cgSplitSubj, setCgSplitSubj] = useState("");
  const [cgxName, setCgxName] = useState("");
  const [cgxSubject, setCgxSubject] = useState("");
  const [cgxCount, setCgxCount] = useState(1);
  const [cgxParticipants, setCgxParticipants] = useState<Participant[]>([]);

  const cgGradeObj = structure.grades.find((g) => String(g.grade) === cgGrade);
  const cgAllClasses = cgGradeObj
    ? [...(cgGradeObj.classes || []), ...(cgGradeObj.special_classes || [])]
    : [];

  const subjectList = Array.from(
    new Set(
      Object.values(structure.required_hours).flatMap((gradeObj) =>
        Object.keys(gradeObj),
      ),
    ),
  );

  const toggleCgClass = (c: string) => {
    setCgClasses((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  };

  const handleAddClassGroup = () => {
    if (cgClasses.length < 2) return;
    addClassGroup({
      grade: parseInt(cgGrade, 10),
      classes: cgClasses,
      split_subjects: [],
    });
    setCgClasses([]);
  };

  const toggleCgxParticipant = (grade: number, class_name: string) => {
    setCgxParticipants((prev) => {
      const exists = prev.some(
        (p) => p.grade === grade && p.class_name === class_name,
      );
      if (exists)
        return prev.filter(
          (p) => !(p.grade === grade && p.class_name === class_name),
        );
      return [...prev, { grade, class_name }];
    });
  };

  const toggleGradeAll = (gradeObj: (typeof structure.grades)[0]) => {
    const allClasses = [
      ...(gradeObj.classes || []),
      ...(gradeObj.special_classes || []),
    ];
    const allSelected = allClasses.every((cn) =>
      cgxParticipants.some(
        (p) => p.grade === gradeObj.grade && p.class_name === cn,
      ),
    );
    if (allSelected) {
      setCgxParticipants((prev) =>
        prev.filter((p) => p.grade !== gradeObj.grade),
      );
    } else {
      setCgxParticipants((prev) => [
        ...prev.filter((p) => p.grade !== gradeObj.grade),
        ...allClasses.map((cn) => ({
          grade: gradeObj.grade,
          class_name: cn,
        })),
      ]);
    }
  };

  const toggleAllSchool = () => {
    const allParticipants = structure.grades.flatMap((g) =>
      [...(g.classes || []), ...(g.special_classes || [])].map((cn) => ({
        grade: g.grade,
        class_name: cn,
      })),
    );
    const totalCount = allParticipants.length;
    const selectedCount = allParticipants.filter((p) =>
      cgxParticipants.some(
        (c) => c.grade === p.grade && c.class_name === p.class_name,
      ),
    ).length;
    if (selectedCount === totalCount) {
      setCgxParticipants([]);
    } else {
      setCgxParticipants(allParticipants);
    }
  };

  const handleAddCrossGradeGroup = () => {
    if (cgxParticipants.length < 2 || !cgxSubject) return;
    addCrossGradeGroup({
      name: cgxName || "合同授業",
      participants: cgxParticipants,
      subject: cgxSubject,
      count: cgxCount,
    });
    setCgxName("");
    setCgxSubject("");
    setCgxCount(1);
    setCgxParticipants([]);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-l-4 border-primary pl-3 py-1">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-bold">合同クラスの設定</h3>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          同じ学年の複数クラスを合同クラスとして登録します。合同クラス内では、
          <Badge variant="outline" className="mx-1 font-bold">
            分割教科
          </Badge>
          に登録した教科のみ別々の先生を割り当て可能で、それ以外は同一教員を重複扱いせず配置できます。
        </p>

        <Card className="border-primary/20 bg-primary/5 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-primary/10">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-primary">
              <Plus className="h-4 w-4" />
              新しい合同クラスを登録
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-3 space-y-2">
                <Label
                  htmlFor="cgGrade"
                  className="text-xs font-bold text-muted-foreground uppercase"
                >
                  学年
                </Label>
                <Select
                  value={cgGrade}
                  onValueChange={(val) => {
                    setCgGrade(val);
                    setCgClasses([]);
                  }}
                >
                  <SelectTrigger id="cgGrade" className="h-9">
                    <SelectValue placeholder="年度を選択" />
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

              <div className="md:col-span-9 space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase">
                  合同にするクラス（2つ以上選択）
                </Label>
                <div className="flex flex-wrap gap-2">
                  {cgAllClasses.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCgClass(c)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm transition-all",
                        cgClasses.includes(c)
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-background hover:bg-muted border-input",
                      )}
                    >
                      {cgClasses.includes(c) ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <div className="h-3.5 w-3.5 rounded-sm border border-current opacity-30" />
                      )}
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                size="sm"
                onClick={handleAddClassGroup}
                disabled={cgClasses.length < 2}
                className="gap-2"
              >
                <UserPlus className="h-4 w-4" />
                合同クラスを登録
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 pt-2">
          {class_groups.length === 0 ? (
            <div className="col-span-full py-12 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Users className="h-10 w-10 opacity-20" />
              <p className="text-sm">合同クラスが登録されていません</p>
            </div>
          ) : (
            class_groups.map((grp) => (
              <Card
                key={grp.id}
                className="overflow-hidden border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow"
              >
                <CardHeader className="py-3 px-4 flex-row items-center justify-between space-y-0 bg-blue-500/5">
                  <div className="font-bold flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-blue-500" />
                    {grp.grade}年：{grp.classes.join(" ・ ")}
                    <Badge variant="blue_soft" className="ml-2">
                      合同
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => removeClassGroup(grp.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        分割教科
                      </Label>
                      <span className="text-[10px] text-muted-foreground">
                        ※先生を個別に配置
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                      {grp.split_subjects.length === 0 ? (
                        <span className="text-sm text-muted-foreground italic pl-1">
                          なし（全教科合同）
                        </span>
                      ) : (
                        grp.split_subjects.map((s) => (
                          <Badge
                            key={s}
                            variant="secondary"
                            className="pl-2 pr-1 py-0 h-7 font-medium flex items-center gap-1 border-blue-200 dark:border-blue-900"
                          >
                            {s}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 rounded-full hover:bg-destructive/20 hover:text-destructive"
                              onClick={() => removeSplitSubject(grp.id, s)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Select
                      value={cgSplitSubj}
                      onValueChange={(val) => {
                        if (val) {
                          addSplitSubject(grp.id, val);
                          setCgSplitSubj("");
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="分割教科を追加..." />
                      </SelectTrigger>
                      <SelectContent>
                        {subjectList
                          .filter((s) => !grp.split_subjects.includes(s))
                          .map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 border-l-4 border-indigo-500 pl-3 py-1">
            <Layers className="h-5 w-5 text-indigo-500" />
            <div>
              <h3 className="text-lg font-bold leading-none">全体合同授業</h3>
              <p className="text-[10px] text-muted-foreground mt-1">
                学年全体・全校授業など
              </p>
            </div>
          </div>
        </div>

        <Card className="border-indigo-500/20 shadow-sm">
          <CardContent className="p-5 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label
                  htmlFor="cgxName"
                  className="text-xs font-bold text-muted-foreground uppercase"
                >
                  授業名（任意）
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="cgxName"
                    className="h-9"
                    value={cgxName}
                    onChange={(e) => setCgxName(e.target.value)}
                    placeholder="例: 合同体育、学年集会"
                  />
                  <div className="bg-indigo-500/10 rounded-md px-3 flex items-center justify-center border border-indigo-500/20">
                    <Layers className="h-4 w-4 text-indigo-500" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase">
                  週あたりコマ数
                </Label>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setCgxCount((c) => Math.max(1, c - 1))}
                  >
                    <Plus className="h-3 w-3 rotate-45" />
                  </Button>
                  <div className="h-9 w-12 flex items-center justify-center font-bold border rounded-md">
                    {cgxCount}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setCgxCount((c) => Math.min(10, c + 1))}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-bold text-muted-foreground uppercase flex items-center justify-between">
                教科の選択
                {cgxSubject && (
                  <Badge variant="indigo" className="ml-2 h-5">
                    {cgxSubject}
                  </Badge>
                )}
              </Label>
              <ScrollArea className="h-[120px] w-full rounded-md border p-2 bg-muted/30">
                <div className="flex flex-wrap gap-1.5">
                  {subjectList.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setCgxSubject(cgxSubject === s ? "" : s)}
                      className={cn(
                        "h-8 px-3 rounded-md text-xs font-medium transition-all flex items-center gap-1.5",
                        cgxSubject === s
                          ? "bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-background"
                          : "bg-background border hover:bg-muted",
                      )}
                    >
                      {cgxSubject === s && <Check className="h-3 w-3" />}
                      {s}
                    </button>
                  ))}
                  {subjectList.length === 0 && (
                    <p className="text-xs text-muted-foreground italic w-full text-center py-4">
                      教科を登録してください
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-muted-foreground uppercase">
                  参加クラスの選択
                </Label>
                <div className="flex gap-2">
                  {cgxParticipants.length > 0 && (
                    <Badge variant="indigo" className="h-5">
                      {cgxParticipants.length}クラス選択中
                    </Badge>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px] px-2 uppercase font-bold tracking-wider hover:bg-indigo-500 hover:text-white transition-colors"
                    onClick={toggleAllSchool}
                  >
                    <School className="h-3 w-3 mr-1" />
                    全校選択
                  </Button>
                </div>
              </div>

              <div className="border rounded-md divide-y overflow-hidden shadow-inner bg-muted/10">
                {structure.grades.map((g) => {
                  const allClasses = [
                    ...(g.classes || []),
                    ...(g.special_classes || []),
                  ];
                  const allSel =
                    allClasses.length > 0 &&
                    allClasses.every((cn) =>
                      cgxParticipants.some(
                        (p) => p.grade === g.grade && p.class_name === cn,
                      ),
                    );
                  return (
                    <div
                      key={g.grade}
                      className="p-3 bg-background/50 hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <Button
                          variant={allSel ? "indigo" : "ghost"}
                          size="sm"
                          className="h-7 px-2 font-bold text-[11px]"
                          onClick={() => toggleGradeAll(g)}
                        >
                          <Users className="h-3.5 w-3.5 mr-1" />
                          {g.grade}年全体
                        </Button>
                        <div className="h-4 w-[1px] bg-border mx-1" />
                        <div className="flex flex-wrap gap-2">
                          {allClasses.map((cn) => {
                            const sel = cgxParticipants.some(
                              (p) => p.grade === g.grade && p.class_name === cn,
                            );
                            const isSpecial = cn.includes("特支");
                            return (
                              <button
                                key={cn}
                                type="button"
                                onClick={() =>
                                  toggleCgxParticipant(g.grade, cn)
                                }
                                className={cn(
                                  "h-7 px-2 rounded-md text-[11px] font-medium transition-all flex items-center gap-1 justify-center min-w-[50px]",
                                  sel
                                    ? isSpecial
                                      ? "bg-amber-500 text-white shadow-sm"
                                      : "bg-indigo-500 text-white shadow-sm"
                                    : "bg-background border hover:bg-muted",
                                )}
                              >
                                {sel && <Check className="h-2.5 w-2.5" />}
                                {cn}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-start pt-2">
              <Button
                size="lg"
                onClick={handleAddCrossGradeGroup}
                disabled={cgxParticipants.length < 2 || !cgxSubject}
                className="gap-2 bg-indigo-600 hover:bg-indigo-700 font-bold"
              >
                <Plus className="h-5 w-5" />
                合同授業として登録
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3 pt-2">
          {cross_grade_groups.length === 0 ? (
            <div className="py-12 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Layers className="h-10 w-10 opacity-20" />
              <p className="text-sm">合同授業が登録されていません</p>
            </div>
          ) : (
            cross_grade_groups.map((grp) => (
              <Card
                key={grp.id}
                className="overflow-hidden border-l-4 border-l-indigo-500 shadow-sm hover:ring-1 ring-indigo-500/30 transition-all"
              >
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row md:items-stretch">
                    <div className="flex-1 p-4 space-y-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-bold text-base">{grp.name}</span>
                        <Badge variant="indigo" className="h-6">
                          {grp.subject}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="h-6 font-bold border-indigo-200 text-indigo-700 bg-indigo-50/50"
                        >
                          {grp.count}コマ / 週
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {grp.participants.map((p) => (
                          <Badge
                            key={`${p.grade}-${p.class_name}`}
                            variant="secondary"
                            className={cn(
                              "text-[10px] h-5 px-1.5 font-medium",
                              p.class_name.includes("特支")
                                ? "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-900"
                                : "bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-900",
                            )}
                          >
                            {p.grade}-{p.class_name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="p-2 md:p-0 md:border-l flex md:flex-col justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-full w-full rounded-none text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors group p-4 min-w-[50px]"
                        onClick={() => removeCrossGradeGroup(grp.id)}
                      >
                        <Trash2 className="h-5 w-5 group-hover:scale-110 transition-transform" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

export default ClassGroupsTab;
