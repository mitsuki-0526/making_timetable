import { useState } from "react";
import { useTimetableStore } from "../../store/useTimetableStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Plus, X, Link, Info } from "lucide-react";

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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center gap-2 border-l-4 border-primary pl-3 py-1">
        <Building2 className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-bold">施設の管理</h3>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 text-xs text-blue-700 dark:text-blue-400">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          体育館・理科室など<strong>同時に1クラスしか使えない施設</strong>
          を登録し、教科と紐付けます。
        </p>
      </div>

      {/* Add Facility */}
      <Card className="border-primary/20 bg-primary/5 shadow-sm">
        <CardHeader className="pb-3 border-b border-primary/10">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-primary">
            <Plus className="h-4 w-4" />
            施設を追加
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <Input
              value={newFacName}
              onChange={(e) => setNewFacName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="施設名を入力（例: 体育館）"
              maxLength={20}
              className="h-9 max-w-xs"
            />
            <Button onClick={handleAdd} disabled={!newFacName.trim()} className="gap-2 h-9">
              <Plus className="h-4 w-4" />
              追加
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Facility Tags */}
      {(facilities || []).length === 0 ? (
        <div className="py-10 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-muted-foreground gap-2">
          <Building2 className="h-10 w-10 opacity-20" />
          <p className="text-sm italic">施設が登録されていません</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {facilities.map((fac) => (
            <div
              key={fac.id}
              className="flex items-center gap-1 pl-3 pr-1 py-1.5 rounded-full text-sm font-semibold bg-primary/10 text-primary border border-primary/20 group"
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>{fac.name}</span>
              <button
                type="button"
                onClick={() => removeFacility(fac.id)}
                className="h-5 w-5 rounded-full flex items-center justify-center hover:bg-destructive hover:text-white transition-colors ml-1 opacity-60 group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Subject-Facility Mapping */}
      {(facilities || []).length > 0 && (
        <Card className="shadow-sm overflow-hidden">
          <CardHeader className="pb-2 pt-3 px-4 border-b bg-muted/30">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Link className="h-4 w-4 text-primary" />
              教科と施設の紐付け
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="p-2.5 text-left font-bold text-muted-foreground">教科</th>
                  <th className="p-2.5 text-left font-bold text-muted-foreground">使用施設</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {allSubjects.map((subj) => (
                  <tr key={subj} className="hover:bg-muted/10 transition-colors">
                    <td className="p-2.5">
                      <Badge variant="secondary" className="font-bold text-xs">{subj}</Badge>
                    </td>
                    <td className="p-2">
                      <Select
                        value={subject_facility?.[subj] || ""}
                        onValueChange={(v) =>
                          updateSubjectFacility(subj, v || null)
                        }
                      >
                        <SelectTrigger className="h-8 w-48 text-xs">
                          <SelectValue placeholder="施設を使用しない" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">施設を使用しない</SelectItem>
                          {facilities.map((fac) => (
                            <SelectItem key={fac.id} value={fac.id}>
                              {fac.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
