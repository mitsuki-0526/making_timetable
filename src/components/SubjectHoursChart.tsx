import { useState } from "react";
import {
  BarChart3,
  School,
  Star,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useTimetableStore } from "../store/useTimetableStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SubjectHoursChartProps {
  onClose: () => void;
}

export default function SubjectHoursChart({ onClose }: SubjectHoursChartProps) {
  const { structure, timetable } = useTimetableStore();
  const grades = structure.grades || [];

  const [selectedGrade] = useState<number | null>(
    grades.length > 0 ? grades[0].grade : null,
  );

  if (grades.length === 0 || selectedGrade === null) {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-4xl w-[90vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              コマ数グラフ
            </DialogTitle>
          </DialogHeader>
          <div className="py-12 text-center text-muted-foreground">
            クラスが登録されていません。
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const gradeObj = grades.find((g) => g.grade === selectedGrade);
  if (!gradeObj) return null;

  const allClasses = [
    ...(gradeObj.classes || []).map((c) => ({
      class_name: c,
      isSpecial: false,
    })),
    ...(gradeObj.special_classes || []).map((c) => ({
      class_name: c,
      isSpecial: true,
    })),
  ];

  const classKeyNormal = `${selectedGrade}_通常`;
  const classKeySpecial = `${selectedGrade}_特支`;
  const subjectSet = new Set([
    ...Object.keys(structure.required_hours[classKeyNormal] || {}),
    ...Object.keys(structure.required_hours[classKeySpecial] || {}),
  ]);
  const subjects = [...subjectSet].sort();

  const countActual = (grade: number, class_name: string, subject: string) =>
    timetable.filter(
      (e) =>
        e.grade === grade &&
        e.class_name === class_name &&
        (e.subject === subject || e.alt_subject === subject),
    ).length;

  const getRequired = (class_name: string, subject: string) => {
    const isSpecial = class_name.includes("特支");
    const key = isSpecial ? classKeySpecial : classKeyNormal;
    return structure.required_hours[key]?.[subject] || 0;
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 border-b shrink-0 bg-muted/30">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <BarChart3 className="h-5 w-5 text-primary" />
            コマ数グラフ
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {allClasses.length === 0 && (
            <p className="text-center text-muted-foreground py-12">
              この学年にクラスが登録されていません。
            </p>
          )}

          {allClasses.map(({ class_name, isSpecial }) => (
            <Card
              key={class_name}
              className="overflow-hidden border-l-4"
              style={{ borderLeftColor: isSpecial ? "#f59e0b" : "#3b82f6" }}
            >
              <CardHeader className="bg-muted/10 py-3 px-4 border-b">
                <CardTitle className="text-base flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isSpecial ? (
                      <Star className="h-4 w-4 text-amber-500" />
                    ) : (
                      <School className="h-4 w-4 text-blue-500" />
                    )}
                    <span>
                      {selectedGrade}年 {class_name}
                    </span>
                    {isSpecial && (
                      <Badge variant="outline" className="ml-2 font-normal">
                        特別支援
                      </Badge>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs uppercase text-muted-foreground border-b">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold">
                          教科
                        </th>
                        <th className="px-4 py-2 text-left font-semibold">
                          進捗
                        </th>
                        <th className="px-4 py-2 text-right font-semibold">
                          実績 / 目標
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {subjects.map((subject) => {
                        const required = getRequired(class_name, subject);
                        if (required === 0) return null;
                        const actual = countActual(
                          selectedGrade,
                          class_name,
                          subject,
                        );
                        const ratio = Math.min(actual / required, 1);
                        const over = actual > required;
                        const done = actual >= required;

                        return (
                          <tr
                            key={subject}
                            className="hover:bg-muted/5 transition-colors"
                          >
                            <td className="px-4 py-3 font-medium whitespace-nowrap">
                              {subject}
                            </td>
                            <td className="px-4 py-3 min-w-[120px]">
                              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-500 ${
                                    over
                                      ? "bg-red-500"
                                      : done
                                        ? "bg-green-500"
                                        : "bg-primary"
                                  }`}
                                  style={{ width: `${ratio * 100}%` }}
                                />
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <span
                                  className={`font-mono font-bold ${
                                    over
                                      ? "text-red-500"
                                      : done
                                        ? "text-green-500"
                                        : "text-foreground"
                                  }`}
                                >
                                  {actual} / {required}
                                </span>
                                {over && (
                                  <Badge
                                    variant="destructive"
                                    className="h-5 px-1.5 text-[10px]"
                                  >
                                    <AlertCircle className="mr-1 h-3 w-3" />{" "}
                                    超過
                                  </Badge>
                                )}
                                {done && !over && (
                                  <Badge
                                    variant="secondary"
                                    className="h-5 px-1.5 text-[10px] bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
                                  >
                                    <CheckCircle2 className="mr-1 h-3 w-3" />{" "}
                                    完了
                                  </Badge>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
