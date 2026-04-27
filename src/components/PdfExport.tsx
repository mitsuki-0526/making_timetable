import { FileText, Grid3X3, Users } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DAYS, PERIODS } from "@/constants";
import {
  entryIncludesTeacher,
  getEntryTeacherIds,
  getEntryTeacherLabel,
} from "@/lib/teamTeaching";
import type { DayOfWeek, Period, TimetableEntry } from "@/types";
import { useTimetableStore } from "../store/useTimetableStore";

interface PdfExportChildrenProps {
  open: () => void;
}

interface PdfExportProps {
  children: (props: PdfExportChildrenProps) => React.ReactNode;
}

interface RowConfig {
  grade: number;
  class_name: string;
  label: string;
}

const PdfExport = ({ children }: PdfExportProps) => {
  const [showModal, setShowModal] = useState(false);
  const [includeTimetable, setIncludeTimetable] = useState(true);
  const [includeTeacherLoad, setIncludeTeacherLoad] = useState(true);

  const handleExport = () => {
    const state = useTimetableStore.getState();
    const { structure, timetable, teachers } = state;

    // クラス一覧の構築
    const rowConfig: RowConfig[] = structure.grades.flatMap((g) => {
      const rows: RowConfig[] = [];
      for (const c of g.classes) {
        rows.push({
          grade: g.grade,
          class_name: c,
          label: `${g.grade}-${c}`,
        });
      }
      return rows;
    });

    // エントリ取得ヘルパー
    const getEntry = (
      grade: number,
      class_name: string,
      day: DayOfWeek,
      period: Period,
    ) =>
      timetable.find(
        (e) =>
          e.grade === grade &&
          e.class_name === class_name &&
          e.day_of_week === day &&
          e.period === period,
      );

    // 先生名取得ヘルパー
    const getTeacherName = (entry: TimetableEntry) => {
      if (!entry) return "";
      return getEntryTeacherLabel(entry, teachers, "primary") ?? "";
    };

    // TeacherScheduleGrid と同じロジックで先生×スロットのエントリを取得
    const getTeacherEntries = (
      teacherId: string,
      day: DayOfWeek,
      period: Period,
    ) => {
      const matched = timetable.filter((entry) => {
        if (entry.day_of_week !== day || entry.period !== period) return false;
        return entryIncludesTeacher(entry, teacherId);
      });
      if (matched.length === 0) return null;
      const first = matched[0];
      const primaryIds = getEntryTeacherIds(first, "primary");
      const altIds = getEntryTeacherIds(first, "alt");
      const role = primaryIds.includes(teacherId)
        ? "primary"
        : altIds.includes(teacherId)
          ? "alt"
          : "primary";
      let allEntries = matched;
      if (first.cell_group_id) {
        allEntries = timetable.filter(
          (e) =>
            e.day_of_week === day &&
            e.period === period &&
            e.cell_group_id === first.cell_group_id,
        );
      }
      return {
        first,
        role,
        allEntries,
        isGrouped: !!(first.cell_group_id && allEntries.length > 1),
      };
    };

    // 色がついているマスの個数 = getTeacherEntries が null でないスロット数
    const countPeriods = (teacherId: string) => {
      let count = 0;
      for (const day of DAYS as DayOfWeek[]) {
        for (const period of PERIODS as Period[]) {
          if (getTeacherEntries(teacherId, day, period) !== null) count++;
        }
      }
      return count;
    };

    const classLabel = (entry: TimetableEntry) => {
      if (!entry) return "";
      return `${entry.grade}-${entry.class_name}`;
    };

    const subjectLabel = (entry: TimetableEntry | null, role: string) => {
      if (!entry) return "";
      return role === "alt" ? entry.alt_subject || "" : entry.subject || "";
    };

    // ---- HTML生成 ----
    let html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>時間割PDF出力</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Hiragino Sans', 'Meiryo', 'Yu Gothic', sans-serif; font-size: 9px; color: #111; background: white; }
    h2 { font-size: 14px; font-weight: bold; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 2px solid #334155; color: #1e293b; }
    .section { margin-bottom: 16px; }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; }
    th, td { border: 1px solid #94a3b8; padding: 2px 2px; text-align: center; vertical-align: middle; word-break: break-all; line-height: 1.3; }
    thead th { background: #e2e8f0; font-weight: bold; font-size: 8px; }
    .class-cell { background: #f1f5f9; font-weight: bold; font-size: 8.5px; white-space: pre-line; width: 44px; }
    .day-sep { border-left: 2px solid #475569 !important; }
    .entry-subject { font-weight: bold; font-size: 9px; display: block; }
    .entry-teacher { font-size: 7.5px; color: #475569; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .empty-cell { color: #cbd5e1; }
    .entry-alt-subject { font-size: 7px; color: #7c3aed; display: block; }
    .ab-badge { display: inline-block; font-size: 6.5px; border-radius: 2px; padding: 0 2px; font-weight: bold; line-height: 1.4; }
    .ab-a { background: #dbeafe; color: #1d4ed8; }
    .ab-b { background: #ede9fe; color: #5b21b6; }
    .tg-table { font-size: 7.5px; }
    .tg-table th, .tg-table td { font-size: 7.5px; padding: 2px 1px; }
    .tg-name { text-align: left; padding-left: 4px; white-space: pre-line; min-width: 64px; background: #f1f5f9; font-weight: bold; border-right: 2px solid #94a3b8 !important; }
    .tg-total { text-align: center; font-weight: bold; min-width: 28px; background: #e0f2fe; color: #1d4ed8; border-right: 2px solid #94a3b8 !important; }
    .tg-day-sep { border-left: 2px solid #94a3b8 !important; }
    .tg-period-sep { border-right: 2px solid #94a3b8 !important; }
    .tg-empty { color: #cbd5e1; text-align: center; }
    .tg-cell { text-align: center; font-weight: 600; white-space: pre-line; line-height: 1.2; }
    .tg-primary { background: #eff6ff; color: #1e40af; }
    .tg-alt { background: #f5f3ff; color: #5b21b6; }
    .tg-group { background: #d1fae5; color: #065f46; }
    .tg-grouped { background: #fef9c3; color: #92400e; }
    .tg-classname { font-size: 7px; display: block; font-weight: bold; }
    .tg-subj { font-size: 6.5px; display: block; font-weight: normal; opacity: 0.85; }
    .tg-badge { display: inline-block; font-size: 6px; background: #fde68a; color: #92400e; border-radius: 2px; padding: 0 2px; font-weight: 700; }
    @page { size: A4 landscape; margin: 8mm; }
    .page-break { page-break-before: always; }
    @media screen {
      body { padding: 20px; background: #f0f0f0; }
      .print-wrap { background: white; padding: 16px; max-width: 1100px; margin: 0 auto; box-shadow: 0 2px 12px rgba(0,0,0,0.15); }
      .no-print { display: flex; gap: 12px; margin-bottom: 16px; }
      .print-btn { padding: 10px 24px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: bold; cursor: pointer; }
      .close-btn { padding: 10px 24px; background: #94a3b8; color: white; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; }
    }
    @media print { .no-print { display: none !important; } body { background: white; padding: 0; } .print-wrap { padding: 0; box-shadow: none; } }
  </style>
</head>
<body>
<div class="print-wrap">
  <div class="no-print">
    <button class="print-btn" onclick="window.print()">印刷 / PDFとして保存</button>
    <button class="close-btn" onclick="window.close()">閉じる</button>
  </div>`;

    if (includeTimetable) {
      html += `
  <div class="section">
    <h2>時間割表</h2>
    <table>
      <thead>
        <tr>
          <th rowspan="2" class="class-cell">クラス</th>`;
      for (const day of DAYS) {
        html += `<th colspan="${PERIODS.length}" class="day-sep">${day}曜日</th>`;
      }
      html += `</tr><tr>`;
      for (const _day of DAYS) {
        for (const p of PERIODS) {
          html += `<th style="width:${Math.floor(730 / (DAYS.length * PERIODS.length))}px">${p}</th>`;
        }
      }
      html += `</tr></thead><tbody>`;

      for (const row of rowConfig) {
        html += `<tr><td class="class-cell">${row.label}</td>`;
        for (const day of DAYS as DayOfWeek[]) {
          for (const period of PERIODS as Period[]) {
            const entry = getEntry(row.grade, row.class_name, day, period);
            const subj = entry?.subject || "";
            const altSubj = entry?.alt_subject || "";
            const tName = entry ? getTeacherName(entry) : "";
            const sepClass = period === 1 ? ' class="day-sep"' : "";
            if (subj || altSubj) {
              let inner = "";
              if (subj && altSubj) {
                inner = `<span class="entry-subject"><span class="ab-badge ab-a">A</span>${subj}</span><span class="entry-alt-subject"><span class="ab-badge ab-b">B</span>${altSubj}</span>`;
              } else {
                inner = `<span class="entry-subject">${subj || altSubj}</span>`;
              }
              inner += `<span class="entry-teacher">${tName}</span>`;
              html += `<td${sepClass}>${inner}</td>`;
            } else {
              html += `<td${sepClass} class="empty-cell">－</td>`;
            }
          }
        }
        html += `</tr>`;
      }
      html += `</tbody></table></div>`;
    }

    if (includeTeacherLoad) {
      const pageBreak = includeTimetable ? " page-break" : "";
      html += `
  <div class="section${pageBreak}">
    <h2>先生ごとのコマ数</h2>
    <table class="tg-table">
      <thead>
        <tr>
          <th rowspan="2" class="tg-name">先生</th>
          <th rowspan="2" class="tg-total" style="border-right:2px solid #94a3b8">週計</th>`;
      for (const day of DAYS) {
        html += `<th colspan="${PERIODS.length}" class="tg-day-sep">${day}曜日</th>`;
      }
      html += `</tr><tr>`;
      for (const _day of DAYS) {
        for (const p of PERIODS) {
          html += `<th style="min-width:38px">${p}</th>`;
        }
      }
      html += `</tr></thead><tbody>`;

      for (const teacher of teachers) {
        const total = countPeriods(teacher.id);
        const totalClass = total > 0 ? "tg-total" : "tg-total tg-total-zero";
        const totalText = total > 0 ? `${total}コマ` : "－";
        html += `<tr>
          <td class="tg-name">${teacher.name.split("(")[0].trim()}<br><span style="font-size:6.5px;font-weight:normal;color:#64748b">${teacher.subjects.join("・")}</span></td>
          <td class="${totalClass}">${totalText}</td>`;

        for (const day of DAYS as DayOfWeek[]) {
          for (const period of PERIODS as Period[]) {
            const result = getTeacherEntries(teacher.id, day, period);
            const dayClass = period === 1 ? " tg-day-sep" : "";
            const periodClass = period === 6 ? " tg-period-sep" : "";

            if (!result) {
              html += `<td class="tg-empty${dayClass}${periodClass}">－</td>`;
              continue;
            }

            const { first, role, allEntries, isGrouped } = result;
            let cellClass = "tg-cell";
            if (isGrouped) cellClass += " tg-grouped";
            else if (role === "group") cellClass += " tg-group";
            else if (role === "alt") cellClass += " tg-alt";
            else cellClass += " tg-primary";

            if (isGrouped) {
              const labels = allEntries
                .map(
                  (e) =>
                    `<span class="tg-classname">${classLabel(e).replace(/\n/g, "<br>")}</span>`,
                )
                .join("");
              const subj = subjectLabel(first, role);
              html += `<td class="${cellClass}${dayClass}${periodClass}">${labels}<span class="tg-subj">${subj}</span><span class="tg-badge">🔗合同</span></td>`;
            } else {
              const lbl = classLabel(first).replace(/\n/g, "<br>");
              const subj = subjectLabel(first, role);
              let abBadge = "";
              if (first.alt_subject) {
                abBadge =
                  role === "alt"
                    ? '<span class="ab-badge ab-b" style="font-size:6px">B週</span>'
                    : '<span class="ab-badge ab-a" style="font-size:6px">A週</span>';
              }
              html += `<td class="${cellClass}${dayClass}${periodClass}"><span class="tg-classname">${lbl}</span><span class="tg-subj">${subj}</span>${abBadge}</td>`;
            }
          }
        }
        html += `</tr>`;
      }
      html += `</tbody></table></div>`;
    }

    html += `</div></body></html>`;

    const isTauriRuntime =
      typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

    if (isTauriRuntime) {
      // Tauri環境: 同一ウィンドウでiframeを使って印刷
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "none";
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.write(html);
        doc.close();
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      }
      setTimeout(() => document.body.removeChild(iframe), 1000);
    } else {
      const printWin = window.open("", "_blank", "width=1200,height=800");
      if (printWin) {
        printWin.document.write(html);
        printWin.document.close();
      }
    }
    setShowModal(false);
  };

  return (
    <>
      {children({ open: () => setShowModal(true) })}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              PDF出力の設定
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Label
              htmlFor="pdf-export-timetable"
              className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3 transition-colors hover:bg-muted/60 cursor-pointer"
            >
              <Checkbox
                id="pdf-export-timetable"
                checked={includeTimetable}
                onCheckedChange={(checked) => setIncludeTimetable(!!checked)}
              />
              <div className="flex items-center gap-2">
                <Grid3X3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">時間割グリッド</span>
              </div>
            </Label>
            <Label
              htmlFor="pdf-export-teacher-load"
              className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3 transition-colors hover:bg-muted/60 cursor-pointer"
            >
              <Checkbox
                id="pdf-export-teacher-load"
                checked={includeTeacherLoad}
                onCheckedChange={(checked) => setIncludeTeacherLoad(!!checked)}
              />
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">先生コマ数一覧</span>
              </div>
            </Label>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              キャンセル
            </Button>
            <Button
              onClick={handleExport}
              disabled={!includeTimetable && !includeTeacherLoad}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              出力する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PdfExport;
