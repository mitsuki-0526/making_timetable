import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTimetableStore } from "../../store/useTimetableStore";

const SubjectsTab = () => {
  const {
    structure,
    subject_constraints,
    addSubject,
    removeSubject,
    updateRequiredHours,
    updateSubjectConstraint,
  } = useTimetableStore();

  const [newSubj, setNewSubj] = useState("");

  const hwKeys = structure.grades.map((g) => `${g.grade}_通常`);

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

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h3 className="text-[13px] font-semibold text-foreground">
          教科の追加と規定時数・連続日数上限
        </h3>

        {/* Add Subject */}
        <div className="flex items-center gap-2">
          <Input
            placeholder="例: 国語、数学、理科…"
            value={newSubj}
            onChange={(e) => setNewSubj(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddSubject()}
            className="h-9 max-w-xs"
          />
          <Button
            onClick={handleAddSubject}
            disabled={!newSubj.trim()}
            size="sm"
          >
            追加
          </Button>
        </div>

        {/* Hours Table */}
        {subjectList.length === 0 ? (
          <div className="border border-border bg-background px-3 py-3 text-[12px] text-muted-foreground">
            教科が登録されていません
          </div>
        ) : (
          <div className="overflow-auto border border-border-strong bg-background">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr>
                  <th className="border-b border-border bg-surface px-2 py-1.5 text-left text-[11px] font-semibold text-muted-foreground w-[80px]">
                    教科
                  </th>
                  {hwKeys.map((k) => (
                    <th
                      key={k}
                      className="border-b border-l border-border bg-surface px-2 py-1.5 text-center text-[11px] font-semibold text-muted-foreground min-w-[64px]"
                    >
                      {k.replace("_通常", "年")}
                    </th>
                  ))}
                  <th className="border-b border-l border-border bg-surface px-2 py-1.5 text-center text-[11px] font-semibold text-muted-foreground min-w-[80px]">
                    連続上限
                  </th>
                  <th
                    className="border-b border-l border-border bg-surface px-2 py-1.5 text-center text-[11px] font-semibold text-muted-foreground w-[48px]"
                    aria-label="削除"
                  />
                </tr>
              </thead>
              <tbody>
                {subjectList.map((subj, idx) => {
                  const isLast = idx === subjectList.length - 1;
                  return (
                    <tr key={subj}>
                      <td
                        className={`px-2 py-1 text-[12px] font-semibold text-foreground ${!isLast ? "border-b border-border" : ""}`}
                      >
                        {subj}
                      </td>
                      {hwKeys.map((k) => (
                        <td
                          key={k}
                          className={`border-l border-border px-1.5 py-1 text-center ${!isLast ? "border-b border-border" : ""}`}
                        >
                          <input
                            type="number"
                            min="0"
                            className="h-7 w-12 rounded-sm border border-input bg-background text-center text-[12px] tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                            value={structure.required_hours[k]?.[subj] || 0}
                            onChange={(e) =>
                              handleHourChange(k, subj, e.target.value)
                            }
                          />
                        </td>
                      ))}
                      <td
                        className={`border-l border-border px-1.5 py-1 text-center ${!isLast ? "border-b border-border" : ""}`}
                      >
                        <input
                          type="number"
                          min="1"
                          max="5"
                          placeholder="－"
                          className="h-7 w-12 rounded-sm border border-input bg-background text-center text-[12px] tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                          value={
                            subject_constraints?.[subj]?.max_consecutive_days ??
                            ""
                          }
                          onChange={(e) =>
                            handleMaxConsecutiveChange(subj, e.target.value)
                          }
                        />
                      </td>
                      <td
                        className={`border-l border-border px-1 py-1 text-center ${!isLast ? "border-b border-border" : ""}`}
                      >
                        <Button
                          variant="ghost"
                          size="xs"
                          className="h-6 text-muted-foreground hover:text-destructive"
                          onClick={() => removeSubject(subj)}
                        >
                          削除
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default SubjectsTab;
