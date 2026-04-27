import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getTtAssignmentGrades,
  getTtAssignmentSubjects,
  getTtAssignmentTargetClassMap,
} from "@/lib/ttAssignments";
import { cn } from "@/lib/utils";
import type { TtAssignment } from "@/types";
import { useTimetableStore } from "../../store/useTimetableStore";

type TtTargetClassMap = Record<number, string[]>;

const TtAssignmentsTab = () => {
  const {
    structure,
    teachers,
    tt_assignments,
    addTtAssignment,
    updateTtAssignment,
    removeTtAssignment,
  } = useTimetableStore();

  const subjectList = useMemo(
    () =>
      Array.from(
        new Set(
          Object.values(structure.required_hours).flatMap((gradeObj) =>
            Object.keys(gradeObj),
          ),
        ),
      ),
    [structure.required_hours],
  );

  const [newName, setNewName] = useState("");
  const [newGrades, setNewGrades] = useState<number[]>([]);
  const [newSubjects, setNewSubjects] = useState<string[]>([]);
  const [newTargetClasses, setNewTargetClasses] = useState<TtTargetClassMap>(
    {},
  );
  const [newTeacherIds, setNewTeacherIds] = useState<string[]>([]);
  const [newEnabled, setNewEnabled] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editGrades, setEditGrades] = useState<number[]>([]);
  const [editSubjects, setEditSubjects] = useState<string[]>([]);
  const [editTargetClasses, setEditTargetClasses] = useState<TtTargetClassMap>(
    {},
  );
  const [editTeacherIds, setEditTeacherIds] = useState<string[]>([]);
  const [editEnabled, setEditEnabled] = useState(true);

  const getClassesForGrade = (grade: number) => {
    const gradeInfo = structure.grades.find(
      (candidate) => candidate.grade === grade,
    );
    if (!gradeInfo) return [];
    return [...(gradeInfo.classes ?? []), ...(gradeInfo.special_classes ?? [])];
  };

  const getTargetClassCount = (targetClasses: TtTargetClassMap) =>
    Object.values(targetClasses).reduce(
      (total, classNames) => total + classNames.length,
      0,
    );

  const formatTargetClassSummary = (targetClasses: TtTargetClassMap) =>
    Object.entries(targetClasses)
      .sort(([left], [right]) => Number(left) - Number(right))
      .map(([grade, classNames]) => `${grade}年:${classNames.join("・")}`)
      .join(" / ");

  const toggleItem = (
    value: string,
    setSelected: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    setSelected((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value],
    );
  };

  const toggleGrade = (
    value: number,
    setSelected: React.Dispatch<React.SetStateAction<number[]>>,
    setTargetClasses: React.Dispatch<React.SetStateAction<TtTargetClassMap>>,
  ) => {
    setSelected((prev) => {
      const next = prev.includes(value)
        ? prev.filter((grade) => grade !== value)
        : [...prev, value].sort((left, right) => left - right);
      setTargetClasses((current) =>
        Object.fromEntries(
          Object.entries(current).filter(([grade]) =>
            next.includes(Number(grade)),
          ),
        ),
      );
      return next;
    });
  };

  const toggleTargetClass = (
    grade: number,
    className: string,
    setTargetClasses: React.Dispatch<React.SetStateAction<TtTargetClassMap>>,
  ) => {
    setTargetClasses((prev) => {
      const currentClasses = prev[grade] ?? [];
      const nextClasses = currentClasses.includes(className)
        ? currentClasses.filter((value) => value !== className)
        : [...currentClasses, className];
      const next = { ...prev };
      if (nextClasses.length === 0) {
        delete next[grade];
      } else {
        next[grade] = nextClasses;
      }
      return next;
    });
  };

  const resetNewForm = () => {
    setNewName("");
    setNewGrades([]);
    setNewSubjects([]);
    setNewTargetClasses({});
    setNewTeacherIds([]);
    setNewEnabled(true);
  };

  const handleAdd = () => {
    if (
      !newName.trim() ||
      newGrades.length === 0 ||
      newSubjects.length === 0 ||
      getTargetClassCount(newTargetClasses) === 0 ||
      newTeacherIds.length === 0
    ) {
      return;
    }

    addTtAssignment({
      name: newName.trim(),
      grades: newGrades,
      subjects: newSubjects,
      target_classes: newTargetClasses,
      teacher_ids: newTeacherIds,
      enabled: newEnabled,
    });
    resetNewForm();
  };

  const startEdit = (assignment: TtAssignment) => {
    setEditingId(assignment.id);
    setEditName(assignment.name);
    setEditGrades(getTtAssignmentGrades(assignment));
    setEditSubjects(getTtAssignmentSubjects(assignment));
    setEditTargetClasses(getTtAssignmentTargetClassMap(assignment));
    setEditTeacherIds([...assignment.teacher_ids]);
    setEditEnabled(assignment.enabled);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditGrades([]);
    setEditSubjects([]);
    setEditTargetClasses({});
    setEditTeacherIds([]);
    setEditEnabled(true);
  };

  const handleSaveEdit = () => {
    if (
      !editingId ||
      !editName.trim() ||
      editGrades.length === 0 ||
      editSubjects.length === 0 ||
      getTargetClassCount(editTargetClasses) === 0 ||
      editTeacherIds.length === 0
    ) {
      return;
    }

    updateTtAssignment(editingId, {
      name: editName.trim(),
      grade: undefined,
      grades: editGrades,
      subject: undefined,
      subjects: editSubjects,
      target_classes: editTargetClasses,
      teacher_ids: editTeacherIds,
      enabled: editEnabled,
    });
    cancelEdit();
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[13px] font-semibold text-foreground">TT設定</h3>
        <p className="pt-1 text-[11px] text-muted-foreground">
          学年・教科・対象クラス・参加教員をまとめて登録する、TT専用の設定です。
        </p>
      </div>

      <div className="border border-border bg-background px-4 py-3 space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div className="space-y-1 md:col-span-2">
            <Label className="text-[11px] text-muted-foreground">設定名</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="例: 1・2年TT共通"
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">学年数</Label>
            <div className="flex h-9 items-center rounded-sm border border-border bg-surface px-2 text-[12px] text-muted-foreground">
              {newGrades.length > 0
                ? `${newGrades.length}学年選択中`
                : "未選択"}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">教科数</Label>
            <div className="flex h-9 items-center rounded-sm border border-border bg-surface px-2 text-[12px] text-muted-foreground">
              {newSubjects.length > 0
                ? `${newSubjects.length}教科選択中`
                : "未選択"}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">
              対象クラス数
            </Label>
            <div className="flex h-9 items-center rounded-sm border border-border bg-surface px-2 text-[12px] text-muted-foreground">
              {getTargetClassCount(newTargetClasses) > 0
                ? `${getTargetClassCount(newTargetClasses)}クラス選択中`
                : "未選択"}
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">
            学年（複数選択可）
          </Label>
          <div className="flex flex-wrap gap-1">
            {structure.grades.map((grade) => (
              <ToggleChip
                key={grade.grade}
                label={`${grade.grade}年`}
                active={newGrades.includes(grade.grade)}
                onClick={() =>
                  toggleGrade(grade.grade, setNewGrades, setNewTargetClasses)
                }
              />
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">
            教科（複数選択可）
          </Label>
          <div className="flex flex-wrap gap-1">
            {subjectList.map((subject) => (
              <ToggleChip
                key={subject}
                label={subject}
                active={newSubjects.includes(subject)}
                onClick={() => toggleItem(subject, setNewSubjects)}
              />
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">
            対象クラス（学年ごとに選択）
          </Label>
          <div className="space-y-2">
            {newGrades.length === 0 ? (
              <span className="text-[11px] text-muted-foreground">
                学年を選択してください
              </span>
            ) : (
              newGrades.map((grade) => (
                <div
                  key={grade}
                  className="rounded-sm border border-border bg-surface px-3 py-2"
                >
                  <div className="mb-2 text-[12px] font-semibold text-foreground">
                    {grade}年
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {getClassesForGrade(grade).map((className) => (
                      <ToggleChip
                        key={`${grade}-${className}`}
                        label={className}
                        active={Boolean(
                          newTargetClasses[grade]?.includes(className),
                        )}
                        onClick={() =>
                          toggleTargetClass(
                            grade,
                            className,
                            setNewTargetClasses,
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">
            参加教員（複数選択可）
          </Label>
          <div className="flex flex-wrap gap-1">
            {teachers.map((teacher) => (
              <ToggleChip
                key={teacher.id}
                label={teacher.name}
                active={newTeacherIds.includes(teacher.id)}
                onClick={() => toggleItem(teacher.id, setNewTeacherIds)}
              />
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-[12px] text-foreground">
          <input
            type="checkbox"
            checked={newEnabled}
            onChange={(e) => setNewEnabled(e.target.checked)}
          />
          有効にする
        </label>

        <div>
          <Button
            onClick={handleAdd}
            size="sm"
            disabled={
              !newName.trim() ||
              newGrades.length === 0 ||
              newSubjects.length === 0 ||
              getTargetClassCount(newTargetClasses) === 0 ||
              newTeacherIds.length === 0
            }
          >
            TT設定を作成
          </Button>
        </div>
      </div>

      {tt_assignments.length === 0 ? (
        <div className="border border-border bg-background px-3 py-3 text-[12px] text-muted-foreground">
          TT設定はまだ登録されていません
        </div>
      ) : (
        <div className="border border-border-strong bg-background divide-y divide-border">
          {tt_assignments.map((assignment) => {
            const isEditing = editingId === assignment.id;
            const grades = getTtAssignmentGrades(assignment);
            const subjects = getTtAssignmentSubjects(assignment);
            const teacherNames = assignment.teacher_ids
              .map(
                (teacherId) =>
                  teachers.find((teacher) => teacher.id === teacherId)?.name ??
                  teacherId,
              )
              .join("・");

            if (isEditing) {
              return (
                <div key={assignment.id} className="px-4 py-3 space-y-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-[11px] text-muted-foreground">
                        設定名
                      </Label>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">
                        学年数
                      </Label>
                      <div className="flex h-9 items-center rounded-sm border border-border bg-surface px-2 text-[12px] text-muted-foreground">
                        {editGrades.length > 0
                          ? `${editGrades.length}学年選択中`
                          : "未選択"}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">
                        教科数
                      </Label>
                      <div className="flex h-9 items-center rounded-sm border border-border bg-surface px-2 text-[12px] text-muted-foreground">
                        {editSubjects.length > 0
                          ? `${editSubjects.length}教科選択中`
                          : "未選択"}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">
                        対象クラス数
                      </Label>
                      <div className="flex h-9 items-center rounded-sm border border-border bg-surface px-2 text-[12px] text-muted-foreground">
                        {getTargetClassCount(editTargetClasses) > 0
                          ? `${getTargetClassCount(editTargetClasses)}クラス選択中`
                          : "未選択"}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">
                      学年（複数選択可）
                    </Label>
                    <div className="flex flex-wrap gap-1">
                      {structure.grades.map((grade) => (
                        <ToggleChip
                          key={grade.grade}
                          label={`${grade.grade}年`}
                          active={editGrades.includes(grade.grade)}
                          onClick={() =>
                            toggleGrade(
                              grade.grade,
                              setEditGrades,
                              setEditTargetClasses,
                            )
                          }
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">
                      教科（複数選択可）
                    </Label>
                    <div className="flex flex-wrap gap-1">
                      {subjectList.map((subject) => (
                        <ToggleChip
                          key={subject}
                          label={subject}
                          active={editSubjects.includes(subject)}
                          onClick={() => toggleItem(subject, setEditSubjects)}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">
                      対象クラス（学年ごとに選択）
                    </Label>
                    <div className="space-y-2">
                      {editGrades.length === 0 ? (
                        <span className="text-[11px] text-muted-foreground">
                          学年を選択してください
                        </span>
                      ) : (
                        editGrades.map((grade) => (
                          <div
                            key={grade}
                            className="rounded-sm border border-border bg-surface px-3 py-2"
                          >
                            <div className="mb-2 text-[12px] font-semibold text-foreground">
                              {grade}年
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {getClassesForGrade(grade).map((className) => (
                                <ToggleChip
                                  key={`${grade}-${className}`}
                                  label={className}
                                  active={Boolean(
                                    editTargetClasses[grade]?.includes(
                                      className,
                                    ),
                                  )}
                                  onClick={() =>
                                    toggleTargetClass(
                                      grade,
                                      className,
                                      setEditTargetClasses,
                                    )
                                  }
                                />
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">
                      参加教員（複数選択可）
                    </Label>
                    <div className="flex flex-wrap gap-1">
                      {teachers.map((teacher) => (
                        <ToggleChip
                          key={teacher.id}
                          label={teacher.name}
                          active={editTeacherIds.includes(teacher.id)}
                          onClick={() =>
                            toggleItem(teacher.id, setEditTeacherIds)
                          }
                        />
                      ))}
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-[12px] text-foreground">
                    <input
                      type="checkbox"
                      checked={editEnabled}
                      onChange={(e) => setEditEnabled(e.target.checked)}
                    />
                    有効にする
                  </label>

                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveEdit}>
                      保存
                    </Button>
                    <Button size="sm" variant="outline" onClick={cancelEdit}>
                      キャンセル
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={assignment.id}
                className="flex items-center justify-between gap-2 px-3 py-2"
              >
                <div className="flex flex-col leading-tight">
                  <span className="text-[12px] font-semibold text-foreground">
                    {assignment.name}
                    {!assignment.enabled && (
                      <span className="ml-2 text-[11px] text-muted-foreground">
                        無効
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {grades.map((grade) => `${grade}年`).join("・")} /{" "}
                    {subjects.join("・")} /{" "}
                    {formatTargetClassSummary(
                      getTtAssignmentTargetClassMap(assignment),
                    )}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {teacherNames}（{assignment.teacher_ids.length}名）
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="xs"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => startEdit(assignment)}
                  >
                    編集
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => removeTtAssignment(assignment.id)}
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

export default TtAssignmentsTab;
