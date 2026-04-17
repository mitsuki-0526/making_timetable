import { useState } from "react";
import { useTimetableStore } from "../../store/useTimetableStore";
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

const SubjectsTab = () => {
  const {
    structure,
    settings,
    subject_constraints,
    addSubject,
    removeSubject,
    updateRequiredHours,
    updateSubjectConstraint,
    addMappingRule,
    removeMappingRule,
  } = useTimetableStore();

  const [newSubj, setNewSubj] = useState("");
  const [mapGrade, setMapGrade] = useState("1");
  const [mapFrom, setMapFrom] = useState("");
  const [mapTo, setMapTo] = useState("");

  const hwKeys: string[] = [];
  for (const g of structure.grades) {
    hwKeys.push(`${g.grade}_通常`);
    if (g.special_classes && g.special_classes.length > 0) {
      hwKeys.push(`${g.grade}_特支`);
    }
  }

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

  const handleAddRule = () => {
    if (mapGrade && mapFrom.trim() && mapTo.trim()) {
      addMappingRule(parseInt(mapGrade, 10), mapFrom.trim(), mapTo.trim());
      setMapFrom("");
      setMapTo("");
    }
  };

  return (
    <div className="space-y-8">
      {/* Section 1: 教科の追加と規定時数・連続日数上限 */}
      <section className="space-y-3">
        <h3 className="text-[13px] font-semibold text-foreground">
          1. 教科の追加と規定時数・連続日数上限
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
                      {k.replace("_通常", "年").replace("_特支", "特支")}
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

      {/* Section 2: 特別支援学級の教科連動ルール */}
      <section className="space-y-3">
        <h3 className="text-[13px] font-semibold text-foreground">
          2. 特別支援学級の教科連動ルール
        </h3>
        <p className="text-[11px] text-muted-foreground">
          通常学級に左側の教科を設定すると、同学年の特別支援学級には右側の教科を自動で差し替えます。
        </p>

        {/* Existing Rules */}
        <div className="border border-border-strong bg-background">
          {Object.values(settings.mappingRules).every(
            (r) => Object.keys(r).length === 0,
          ) ? (
            <div className="px-3 py-3 text-[12px] text-muted-foreground">
              連動ルールが登録されていません
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {Object.entries(settings.mappingRules).flatMap(([g, rules]) =>
                Object.entries(rules).map(([fromS, toS]) => (
                  <li
                    key={`${g}-${fromS}`}
                    className="flex items-center justify-between px-3 py-2 text-[12px]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded-sm border border-border px-1 text-[10px] text-muted-foreground">
                        {g}年
                      </span>
                      <span className="font-semibold text-foreground">
                        {fromS}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-muted-foreground">特支:</span>
                      <span className="font-semibold text-foreground">
                        {toS}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => removeMappingRule(parseInt(g, 10), fromS)}
                    >
                      削除
                    </Button>
                  </li>
                )),
              )}
            </ul>
          )}
        </div>

        {/* Add Rule Form */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">学年</Label>
            <Select value={mapGrade} onValueChange={setMapGrade}>
              <SelectTrigger className="h-9 w-24">
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
            <Label className="text-[11px] text-muted-foreground">
              通常学級の教科
            </Label>
            <Input
              placeholder="例: 国語"
              value={mapFrom}
              onChange={(e) => setMapFrom(e.target.value)}
              className="h-9 w-32"
            />
          </div>
          <span className="pb-2 text-muted-foreground">→</span>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">
              特支の教科
            </Label>
            <Input
              placeholder="例: 自立"
              value={mapTo}
              onChange={(e) => setMapTo(e.target.value)}
              className="h-9 w-32"
            />
          </div>
          <Button
            onClick={handleAddRule}
            disabled={!mapFrom.trim() || !mapTo.trim()}
            size="sm"
          >
            ルール登録
          </Button>
        </div>
      </section>
    </div>
  );
};

export default SubjectsTab;
