import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useTimetableStore } from "../../store/useTimetableStore";

interface Participant {
  grade: number;
  class_name: string;
}

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

  const toggleGradeAll = (gradeObj: (typeof structure.grades)[number]) => {
    const allClasses = [
      ...(gradeObj.classes || []),
      ...(gradeObj.special_classes || []),
    ];
    const allSelected = allClasses.every((cname) =>
      cgxParticipants.some(
        (p) => p.grade === gradeObj.grade && p.class_name === cname,
      ),
    );
    if (allSelected) {
      setCgxParticipants((prev) =>
        prev.filter((p) => p.grade !== gradeObj.grade),
      );
    } else {
      setCgxParticipants((prev) => [
        ...prev.filter((p) => p.grade !== gradeObj.grade),
        ...allClasses.map((cname) => ({
          grade: gradeObj.grade,
          class_name: cname,
        })),
      ]);
    }
  };

  const toggleAllSchool = () => {
    const allParticipants = structure.grades.flatMap((g) =>
      [...(g.classes || []), ...(g.special_classes || [])].map((cname) => ({
        grade: g.grade,
        class_name: cname,
      })),
    );
    const selectedCount = allParticipants.filter((p) =>
      cgxParticipants.some(
        (c) => c.grade === p.grade && c.class_name === p.class_name,
      ),
    ).length;
    if (selectedCount === allParticipants.length) {
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
    <div className="space-y-8">
      {/* Section 1: 合同クラス */}
      <section className="space-y-3">
        <div>
          <h3 className="text-[13px] font-semibold text-foreground">
            1. 合同クラスの設定
          </h3>
          <p className="pt-1 text-[11px] text-muted-foreground">
            同じ学年の複数クラスを合同クラスとして登録します。合同クラス内で「分割教科」に登録した教科のみ別教員を割り当て可能で、それ以外は同一教員の重複扱いを抑制します。
          </p>
        </div>

        {/* Add Form */}
        <div className="border border-border bg-background px-4 py-3 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label
                htmlFor="cgGrade"
                className="text-[11px] text-muted-foreground"
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
                <SelectTrigger id="cgGrade" className="h-9 w-24">
                  <SelectValue placeholder="選択" />
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
            <div className="flex-1 space-y-1">
              <Label className="text-[11px] text-muted-foreground">
                合同にするクラス（2つ以上選択）
              </Label>
              <div className="flex flex-wrap gap-1">
                {cgAllClasses.length === 0 && (
                  <span className="text-[11px] text-muted-foreground">
                    クラスを登録してください
                  </span>
                )}
                {cgAllClasses.map((c) => (
                  <ToggleChip
                    key={c}
                    label={c}
                    active={cgClasses.includes(c)}
                    onClick={() => toggleCgClass(c)}
                  />
                ))}
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleAddClassGroup}
              disabled={cgClasses.length < 2}
            >
              合同クラスを登録
            </Button>
          </div>
        </div>

        {/* List */}
        {class_groups.length === 0 ? (
          <div className="border border-border bg-background px-3 py-3 text-[12px] text-muted-foreground">
            合同クラスが登録されていません
          </div>
        ) : (
          <div className="border border-border-strong bg-background divide-y divide-border">
            {class_groups.map((grp) => (
              <div key={grp.id} className="px-4 py-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[12px] font-semibold text-foreground">
                      {grp.grade}年：{grp.classes.join(" ・ ")}
                    </span>
                    <span className="rounded-sm border border-border px-1 text-[10px] text-muted-foreground">
                      合同
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => removeClassGroup(grp.id)}
                  >
                    削除
                  </Button>
                </div>

                <div className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      分割教科
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      先生を個別に配置する教科
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {grp.split_subjects.length === 0 ? (
                      <span className="text-[11px] text-muted-foreground">
                        なし（全教科合同）
                      </span>
                    ) : (
                      grp.split_subjects.map((s) => (
                        <span
                          key={s}
                          className="inline-flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 text-[11px] text-foreground"
                        >
                          {s}
                          <button
                            type="button"
                            onClick={() => removeSplitSubject(grp.id, s)}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label={`${s}を削除`}
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                  <div className="pt-1">
                    <Select
                      value={cgSplitSubj}
                      onValueChange={(val) => {
                        if (val) {
                          addSplitSubject(grp.id, val);
                          setCgSplitSubj("");
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 max-w-xs text-[12px]">
                        <SelectValue placeholder="分割教科を追加…" />
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
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section 2: 全体合同授業 */}
      <section className="space-y-3">
        <div>
          <h3 className="text-[13px] font-semibold text-foreground">
            2. 全体合同授業
          </h3>
          <p className="pt-1 text-[11px] text-muted-foreground">
            学年全体・全校授業など、複数学年にまたがる合同授業を登録します。
          </p>
        </div>

        <div className="border border-border bg-background px-4 py-3 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto]">
            <div className="space-y-1">
              <Label
                htmlFor="cgxName"
                className="text-[11px] text-muted-foreground"
              >
                授業名（任意）
              </Label>
              <Input
                id="cgxName"
                className="h-9 max-w-sm"
                value={cgxName}
                onChange={(e) => setCgxName(e.target.value)}
                placeholder="例: 合同体育、学年集会"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">
                週あたりコマ数
              </Label>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setCgxCount((c) => Math.max(1, c - 1))}
                  aria-label="減"
                >
                  −
                </Button>
                <span className="flex h-8 w-10 items-center justify-center rounded-sm border border-border bg-background text-[12px] font-semibold tabular-nums">
                  {cgxCount}
                </span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setCgxCount((c) => Math.min(10, c + 1))}
                  aria-label="増"
                >
                  +
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <Label className="text-[11px] text-muted-foreground">
                教科の選択
              </Label>
              {cgxSubject && (
                <span className="text-[11px] text-muted-foreground">
                  選択中: {cgxSubject}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1 border border-border bg-surface px-2 py-2">
              {subjectList.length === 0 && (
                <p className="py-2 text-[11px] text-muted-foreground">
                  教科を登録してください
                </p>
              )}
              {subjectList.map((s) => (
                <ToggleChip
                  key={s}
                  label={s}
                  active={cgxSubject === s}
                  onClick={() => setCgxSubject(cgxSubject === s ? "" : s)}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <Label className="text-[11px] text-muted-foreground">
                参加クラスの選択
              </Label>
              <div className="flex items-center gap-2">
                {cgxParticipants.length > 0 && (
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {cgxParticipants.length}クラス選択中
                  </span>
                )}
                <Button variant="outline" size="xs" onClick={toggleAllSchool}>
                  全校選択
                </Button>
              </div>
            </div>

            <div className="divide-y divide-border border border-border bg-background">
              {structure.grades.map((g) => {
                const allClasses = [
                  ...(g.classes || []),
                  ...(g.special_classes || []),
                ];
                const allSel =
                  allClasses.length > 0 &&
                  allClasses.every((cname) =>
                    cgxParticipants.some(
                      (p) => p.grade === g.grade && p.class_name === cname,
                    ),
                  );
                return (
                  <div
                    key={g.grade}
                    className="flex flex-wrap items-center gap-2 px-3 py-2"
                  >
                    <Button
                      variant={allSel ? "default" : "outline"}
                      size="xs"
                      onClick={() => toggleGradeAll(g)}
                    >
                      {g.grade}年全体
                    </Button>
                    <span className="h-4 w-px bg-border" />
                    <div className="flex flex-wrap gap-1">
                      {allClasses.map((cname) => {
                        const sel = cgxParticipants.some(
                          (p) => p.grade === g.grade && p.class_name === cname,
                        );
                        return (
                          <ToggleChip
                            key={cname}
                            label={cname}
                            active={sel}
                            onClick={() => toggleCgxParticipant(g.grade, cname)}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <Button
              size="sm"
              onClick={handleAddCrossGradeGroup}
              disabled={cgxParticipants.length < 2 || !cgxSubject}
            >
              合同授業として登録
            </Button>
          </div>
        </div>

        {/* List */}
        {cross_grade_groups.length === 0 ? (
          <div className="border border-border bg-background px-3 py-3 text-[12px] text-muted-foreground">
            合同授業が登録されていません
          </div>
        ) : (
          <div className="border border-border-strong bg-background divide-y divide-border">
            {cross_grade_groups.map((grp) => (
              <div
                key={grp.id}
                className="flex items-start justify-between gap-3 px-4 py-3"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-[12px] font-semibold text-foreground">
                      {grp.name}
                    </span>
                    <span className="rounded-sm border border-border px-1 text-[10px] text-muted-foreground">
                      {grp.subject}
                    </span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {grp.count}コマ/週
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {grp.participants.map((p) => {
                      return (
                        <span
                          key={`${p.grade}-${p.class_name}`}
                          className={cn(
                            "rounded-sm border border-border px-1 py-0.5 text-[10px] text-muted-foreground",
                          )}
                        >
                          {p.grade}-{p.class_name}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="xs"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => removeCrossGradeGroup(grp.id)}
                >
                  削除
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

const ToggleChip = ({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "h-7 rounded-sm border px-2 text-[11px] transition-colors",
      active
        ? "border-foreground bg-foreground text-background"
        : "border-border bg-background text-foreground hover:border-border-strong",
    )}
  >
    {label}
  </button>
);

export default ClassGroupsTab;
