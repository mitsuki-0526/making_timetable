import { useState } from "react";
import { useTimetableStore } from "../store/useTimetableStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
        <DialogContent className="max-w-4xl w-[90vw] p-0 gap-0 overflow-hidden">
          <DialogHeader className="p-5 border-b border-border-strong bg-background">
            <DialogTitle className="text-[15px] font-semibold">
              コマ数グラフ
            </DialogTitle>
          </DialogHeader>
          <div className="py-12 text-center text-[12px] text-muted-foreground">
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
        <DialogHeader className="p-5 border-b border-border-strong shrink-0 bg-background">
          <DialogTitle className="text-[15px] font-semibold">
            コマ数グラフ
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {allClasses.length === 0 && (
            <p className="text-center text-[12px] text-muted-foreground py-12">
              この学年にクラスが登録されていません。
            </p>
          )}

          {allClasses.map(({ class_name, isSpecial }) => (
            <div
              key={class_name}
              className="border border-border-strong bg-background"
            >
              <div className="flex items-center justify-between border-b border-border px-3 py-2 bg-surface">
                <div className="flex items-center gap-2 text-[13px] font-semibold">
                  <span>
                    {selectedGrade}年 {class_name}
                  </span>
                  {isSpecial && (
                    <span className="border border-border px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                      特別支援
                    </span>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead className="border-b border-border text-muted-foreground">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium">
                        教科
                      </th>
                      <th className="px-3 py-1.5 text-left font-medium">
                        進捗
                      </th>
                      <th className="px-3 py-1.5 text-right font-medium">
                        実績 / 目標
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
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

                      const barColor = over
                        ? "bg-destructive"
                        : done
                          ? "bg-success"
                          : "bg-primary";
                      const valueColor = over
                        ? "text-destructive"
                        : done
                          ? "text-success"
                          : "text-foreground";

                      return (
                        <tr key={subject}>
                          <td className="px-3 py-2 font-medium whitespace-nowrap">
                            {subject}
                          </td>
                          <td className="px-3 py-2 min-w-[140px]">
                            <div className="h-1.5 w-full bg-surface-muted overflow-hidden">
                              <div
                                className={`h-full ${barColor}`}
                                style={{ width: `${ratio * 100}%` }}
                              />
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span
                                className={`font-mono tabular-nums font-semibold ${valueColor}`}
                              >
                                {actual} / {required}
                              </span>
                              {over && (
                                <span className="border border-destructive/30 bg-destructive/10 text-destructive px-1.5 py-0.5 text-[10px]">
                                  超過
                                </span>
                              )}
                              {done && !over && (
                                <span className="border border-success/30 bg-success/10 text-success px-1.5 py-0.5 text-[10px]">
                                  完了
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
