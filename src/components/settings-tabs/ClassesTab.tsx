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
import { useTimetableStore } from "../../store/useTimetableStore";

const ClassesTab = () => {
  const { structure, addClass, removeClass } = useTimetableStore();
  const [newClassGrade, setNewClassGrade] = useState(
    String(structure.grades[0]?.grade ?? "1"),
  );
  const [newClassName, setNewClassName] = useState("");

  const handleAddClass = () => {
    if (newClassName.trim()) {
      addClass(parseInt(newClassGrade, 10), newClassName.trim());
      setNewClassName("");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[13px] font-semibold text-foreground">
          クラス編成の管理
        </h3>
        <p className="pt-1 text-[11px] text-muted-foreground">
          新しいクラスを追加します。既存のクラスを削除すると、そのクラスの配置済みコマも削除されます。
        </p>
      </div>

      {/* Add Class Form */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">学年</Label>
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
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">クラス名</Label>
          <Input
            placeholder="例: 3組"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddClass()}
            className="h-9 w-40"
          />
        </div>
        <Button
          onClick={handleAddClass}
          disabled={!newClassName.trim()}
          size="sm"
        >
          クラスを追加
        </Button>
      </div>

      {/* Grade Table */}
      <div className="overflow-auto border border-border-strong bg-background">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr>
              <th className="border-b border-border bg-surface px-2 py-1.5 text-left text-[11px] font-semibold text-muted-foreground w-[80px]">
                学年
              </th>
              <th className="border-b border-l border-border bg-surface px-2 py-1.5 text-left text-[11px] font-semibold text-muted-foreground">
                クラス
              </th>
            </tr>
          </thead>
          <tbody>
            {structure.grades.map((g, idx) => {
              const isLast = idx === structure.grades.length - 1;
              const hasClasses = (g.classes || []).length > 0;
              return (
                <tr key={g.grade}>
                  <td
                    className={`px-2 py-1.5 text-[12px] font-semibold text-foreground ${!isLast ? "border-b border-border" : ""}`}
                  >
                    {g.grade}年
                  </td>
                  <td
                    className={`border-l border-border px-2 py-1.5 ${!isLast ? "border-b border-border" : ""}`}
                  >
                    <div className="flex flex-wrap gap-1">
                      {!hasClasses && (
                        <span className="text-[11px] text-muted-foreground">
                          なし
                        </span>
                      )}
                      {g.classes.map((c) => (
                        <ClassChip
                          key={`${g.grade}-${c}`}
                          label={c}
                          onRemove={() => removeClass(g.grade, c)}
                        />
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ClassChip = ({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) => (
  <span
    className="inline-flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 text-[11px] text-foreground"
  >
    {label}
    <button
      type="button"
      onClick={onRemove}
      className="ml-0.5 text-muted-foreground hover:text-destructive"
      aria-label={`${label}を削除`}
    >
      ×
    </button>
  </span>
);

export default ClassesTab;
