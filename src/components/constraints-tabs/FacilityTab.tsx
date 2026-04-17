import { useState } from "react";
import { useTimetableStore } from "../../store/useTimetableStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE_VALUE = "__none__";

export default function FacilityTab() {
  const {
    structure,
    facilities,
    subject_facility,
    addFacility,
    removeFacility,
    updateSubjectFacility,
  } = useTimetableStore();
  const [newFacName, setNewFacName] = useState("");

  const allSubjects = [
    ...new Set(
      Object.values(structure.required_hours || {}).flatMap((h) =>
        Object.keys(h),
      ),
    ),
  ].sort();

  const handleAdd = () => {
    if (!newFacName.trim()) return;
    addFacility(newFacName.trim());
    setNewFacName("");
  };

  return (
    <div className="space-y-6">
      {/* Section 1: 施設の管理 */}
      <section className="space-y-3">
        <div>
          <h3 className="text-[13px] font-semibold text-foreground">
            1. 施設の管理
          </h3>
          <p className="pt-1 text-[11px] text-muted-foreground">
            体育館・理科室など、同時に1クラスしか使えない施設を登録します。
          </p>
        </div>

        <div className="flex gap-2">
          <Input
            value={newFacName}
            onChange={(e) => setNewFacName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="施設名を入力（例: 体育館）"
            maxLength={20}
            className="h-9 max-w-xs"
          />
          <Button onClick={handleAdd} disabled={!newFacName.trim()} size="sm">
            追加
          </Button>
        </div>

        {(facilities || []).length === 0 ? (
          <div className="border border-border bg-background px-3 py-3 text-[12px] text-muted-foreground">
            施設が登録されていません
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {facilities.map((fac) => (
              <span
                key={fac.id}
                className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-2 py-0.5 text-[12px] text-foreground"
              >
                {fac.name}
                <button
                  type="button"
                  onClick={() => removeFacility(fac.id)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`${fac.name}を削除`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Section 2: 教科と施設の紐付け */}
      {(facilities || []).length > 0 && (
        <section className="space-y-3">
          <h3 className="text-[13px] font-semibold text-foreground">
            2. 教科と施設の紐付け
          </h3>
          <div className="overflow-auto border border-border-strong bg-background">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr>
                  <th className="border-b border-border bg-surface px-2 py-1.5 text-left text-[11px] font-semibold text-muted-foreground w-[140px]">
                    教科
                  </th>
                  <th className="border-b border-l border-border bg-surface px-2 py-1.5 text-left text-[11px] font-semibold text-muted-foreground">
                    使用施設
                  </th>
                </tr>
              </thead>
              <tbody>
                {allSubjects.map((subj, idx) => {
                  const isLast = idx === allSubjects.length - 1;
                  const current = subject_facility?.[subj] || NONE_VALUE;
                  return (
                    <tr key={subj}>
                      <td
                        className={`px-2 py-1.5 font-semibold text-foreground ${!isLast ? "border-b border-border" : ""}`}
                      >
                        {subj}
                      </td>
                      <td
                        className={`border-l border-border px-2 py-1 ${!isLast ? "border-b border-border" : ""}`}
                      >
                        <Select
                          value={current}
                          onValueChange={(v) =>
                            updateSubjectFacility(
                              subj,
                              v === NONE_VALUE ? null : v,
                            )
                          }
                        >
                          <SelectTrigger className="h-8 w-48 text-[12px]">
                            <SelectValue placeholder="施設を使用しない" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE_VALUE}>
                              施設を使用しない
                            </SelectItem>
                            {facilities.map((fac) => (
                              <SelectItem key={fac.id} value={fac.id}>
                                {fac.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
