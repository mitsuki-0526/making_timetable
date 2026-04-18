import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { TeacherGroup } from "@/types";
import { useTimetableStore } from "../../store/useTimetableStore";

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
    if (
      !editingGroupId ||
      !editGroupName.trim() ||
      editGroupTeacherIds.length === 0
    ) {
      return;
    }
    updateTeacherGroup(editingGroupId, {
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
    <div className="space-y-6">
      <div>
        <h3 className="text-[13px] font-semibold text-foreground">
          教員グループの管理
        </h3>
        <p className="pt-1 text-[11px] text-muted-foreground">
          道徳・総合など、複数の先生が担当する教科のためのグループを作成します。
        </p>
      </div>

      {/* Add Group Form */}
      <div className="border border-border bg-background px-4 py-3 space-y-3">
        <div className="space-y-1">
          <Label
            htmlFor="newGroupName"
            className="text-[11px] text-muted-foreground"
          >
            グループ名
          </Label>
          <Input
            id="newGroupName"
            placeholder="例: 1年道徳グループ"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            className="h-9 max-w-xs"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">
            メンバー（複数選択可）
          </Label>
          <div className="flex flex-wrap gap-1">
            {teachers.length === 0 && (
              <span className="text-[11px] text-muted-foreground">
                教員を登録してください
              </span>
            )}
            {teachers.map((t) => (
              <ToggleChip
                key={t.id}
                label={t.name}
                active={newGroupTeacherIds.includes(t.id)}
                onClick={() => toggleGroupTeacher(t.id)}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">
              担当教科
            </Label>
            <div className="flex flex-wrap gap-1">
              {subjectList.map((s) => (
                <ToggleChip
                  key={s}
                  label={s}
                  active={newGroupSubjects.includes(s)}
                  onClick={() => toggleGroupSubject(s)}
                />
              ))}
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
                  active={newGroupGrades.includes(g.grade)}
                  onClick={() => toggleGroupGrade(g.grade)}
                  narrow
                />
              ))}
            </div>
          </div>
        </div>

        <div>
          <Button
            onClick={handleAddGroup}
            disabled={!newGroupName.trim() || newGroupTeacherIds.length === 0}
            size="sm"
          >
            グループを作成
          </Button>
        </div>
      </div>

      {/* Group List */}
      {teacher_groups.length === 0 ? (
        <div className="border border-border bg-background px-3 py-3 text-[12px] text-muted-foreground">
          グループが登録されていません
        </div>
      ) : (
        <div className="border border-border-strong bg-background divide-y divide-border">
          {teacher_groups.map((g, idx) => {
            const isEditing = editingGroupId === g.id;
            const memberNames = g.teacher_ids
              .map((id) => teachers.find((t) => t.id === id)?.name || id)
              .join("・");
            if (isEditing) {
              return (
                <div key={g.id} className="px-4 py-3 space-y-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">
                      グループ名
                    </Label>
                    <Input
                      value={editGroupName}
                      onChange={(e) => setEditGroupName(e.target.value)}
                      className="h-9 max-w-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">
                      メンバー
                    </Label>
                    <div className="flex flex-wrap gap-1">
                      {teachers.map((t) => (
                        <ToggleChip
                          key={t.id}
                          label={t.name}
                          active={editGroupTeacherIds.includes(t.id)}
                          onClick={() => toggleEditGroupTeacher(t.id)}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">
                        担当教科
                      </Label>
                      <div className="flex flex-wrap gap-1">
                        {subjectList.map((s) => (
                          <ToggleChip
                            key={s}
                            label={s}
                            active={editGroupSubjects.includes(s)}
                            onClick={() => toggleEditGroupSubject(s)}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">
                        対象学年
                      </Label>
                      <div className="flex flex-wrap gap-1">
                        {structure.grades.map((gradeObj) => (
                          <ToggleChip
                            key={gradeObj.grade}
                            label={String(gradeObj.grade)}
                            active={editGroupGrades.includes(gradeObj.grade)}
                            onClick={() => toggleEditGroupGrade(gradeObj.grade)}
                            narrow
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEditGroup}>
                      保存
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={cancelEditGroup}
                    >
                      キャンセル
                    </Button>
                  </div>
                </div>
              );
            }
            return (
              <div
                key={g.id}
                className="flex items-center justify-between gap-2 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      disabled={idx === 0}
                      onClick={() => moveTeacherGroup(g.id, "up")}
                      className="text-muted-foreground"
                      aria-label="上へ"
                    >
                      ↑
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      disabled={idx === teacher_groups.length - 1}
                      onClick={() => moveTeacherGroup(g.id, "down")}
                      className="text-muted-foreground"
                      aria-label="下へ"
                    >
                      ↓
                    </Button>
                  </div>
                  <div className="flex flex-col leading-tight">
                    <span className="text-[12px] font-semibold text-foreground">
                      {g.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {memberNames}（{g.teacher_ids.length}名）
                      {g.subjects && g.subjects.length > 0 && (
                        <span className="ml-1">
                          ／ 担当: {g.subjects.join("・")}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="xs"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => startEditGroup(g)}
                  >
                    編集
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => removeTeacherGroup(g.id)}
                  >
                    削除
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
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

export default TeacherGroupsTab;
