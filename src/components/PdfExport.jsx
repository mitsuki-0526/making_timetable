import { useState } from "react";
import { useTimetableStore } from "../store/useTimetableStore";
import styles from "./PdfExport.module.css";

const DAYS = ["月", "火", "水", "木", "金"];
const PERIODS = [1, 2, 3, 4, 5, 6];

const PdfExport = ({ children = () => null }) => {
  const [showModal, setShowModal] = useState(false);
  const [includeTimetable, setIncludeTimetable] = useState(true);
  const [includeTeacherLoad, setIncludeTeacherLoad] = useState(true);

  const handleExport = () => {
    const state = useTimetableStore.getState();
    const { structure, timetable, teachers, teacher_groups } = state;

    // クラス一覧の構築
    const rowConfig = structure.grades.flatMap((g) => {
      const rows = [];
      g.classes.forEach((c) => {
        rows.push({
          grade: g.grade,
          class_name: c,
          isSpecial: false,
          label: `${g.grade}-${c}`,
        });
      });
      if (g.special_classes) {
        g.special_classes.forEach((c) => {
          rows.push({
            grade: g.grade,
            class_name: c,
            isSpecial: true,
            label: `${g.grade}年 ${c}`,
          });
        });
      }
      return rows;
    });

    // エントリ取得ヘルパー
    const getEntry = (grade, class_name, day, period) =>
      timetable.find(
        (e) =>
          e.grade === grade &&
          e.class_name === class_name &&
          e.day_of_week === day &&
          e.period === period,
      );

    // 先生名取得ヘルパー
    const getTeacherName = (entry) => {
      if (!entry) return "";
      if (entry.teacher_group_id) {
        const grp = (teacher_groups || []).find(
          (g) => g.id === entry.teacher_group_id,
        );
        return grp ? grp.name : "";
      }
      const t = teachers.find((t) => t.id === entry.teacher_id);
      return t ? t.name : "";
    };

    // TeacherScheduleGrid と同じロジックで先生×スロットのエントリを取得
    const getTeacherEntries = (teacherId, day, period) => {
      const matched = timetable.filter((entry) => {
        if (entry.day_of_week !== day || entry.period !== period) return false;
        if (
          entry.teacher_id === teacherId ||
          entry.alt_teacher_id === teacherId
        )
          return true;
        if (entry.teacher_group_id) {
          const grp = (teacher_groups || []).find(
            (g) => g.id === entry.teacher_group_id,
          );
          if (grp?.teacher_ids?.includes(teacherId)) return true;
        }
        return false;
      });
      if (matched.length === 0) return null;
      const first = matched[0];
      const role =
        first.teacher_id === teacherId
          ? "primary"
          : first.alt_teacher_id === teacherId
            ? "alt"
            : "group";
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
    const countPeriods = (teacherId) => {
      let count = 0;
      DAYS.forEach((day) => {
        PERIODS.forEach((period) => {
          if (getTeacherEntries(teacherId, day, period) !== null) count++;
        });
      });
      return count;
    };

    const classLabel = (entry) => {
      if (!entry) return "";
      return entry.class_name.includes("特支")
        ? `${entry.grade}年\n${entry.class_name}`
        : `${entry.grade}-${entry.class_name}`;
    };

    const subjectLabel = (entry, role) => {
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
    body {
      font-family: 'Hiragino Sans', 'Meiryo', 'Yu Gothic', sans-serif;
      font-size: 9px;
      color: #111;
      background: white;
    }
    h2 {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 2px solid #334155;
      color: #1e293b;
    }
    .section { margin-bottom: 16px; }
    table {
      border-collapse: collapse;
      width: 100%;
      table-layout: fixed;
    }
    th, td {
      border: 1px solid #94a3b8;
      padding: 2px 2px;
      text-align: center;
      vertical-align: middle;
      word-break: break-all;
      line-height: 1.3;
    }
    thead th {
      background: #e2e8f0;
      font-weight: bold;
      font-size: 8px;
    }
    .class-cell {
      background: #f1f5f9;
      font-weight: bold;
      font-size: 8.5px;
      white-space: pre-line;
      width: 44px;
    }
    .special-class-cell {
      background: #fef9c3;
    }
    .day-sep {
      border-left: 2px solid #475569 !important;
    }
    .entry-subject {
      font-weight: bold;
      font-size: 9px;
      display: block;
    }
    .entry-teacher {
      font-size: 7.5px;
      color: #475569;
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .empty-cell { color: #cbd5e1; }
    .entry-alt-subject {
      font-size: 7px;
      color: #7c3aed;
      display: block;
    }
    .ab-badge {
      display: inline-block;
      font-size: 6.5px;
      border-radius: 2px;
      padding: 0 2px;
      font-weight: bold;
      line-height: 1.4;
    }
    .ab-a { background: #dbeafe; color: #1d4ed8; }
    .ab-b { background: #ede9fe; color: #5b21b6; }

    /* 先生コマ数グリッドテーブル（TeacherScheduleGrid と同形式） */
    .tg-table { font-size: 7.5px; }
    .tg-table th, .tg-table td { font-size: 7.5px; padding: 2px 1px; }
    .tg-name {
      text-align: left;
      padding-left: 4px;
      white-space: pre-line;
      min-width: 64px;
      background: #f1f5f9;
      font-weight: bold;
      border-right: 2px solid #94a3b8 !important;
    }
    .tg-total {
      text-align: center;
      font-weight: bold;
      min-width: 28px;
      background: #e0f2fe;
      color: #1d4ed8;
      border-right: 2px solid #94a3b8 !important;
    }
    .tg-total-zero { background: #f8fafc; color: #94a3b8; }
    .tg-day-sep { border-left: 2px solid #94a3b8 !important; }
    .tg-period-sep { border-right: 2px solid #94a3b8 !important; }
    .tg-empty { color: #cbd5e1; text-align: center; }
    .tg-cell { text-align: center; font-weight: 600; white-space: pre-line; line-height: 1.2; }
    .tg-primary { background: #eff6ff; color: #1e40af; }
    .tg-alt { background: #f5f3ff; color: #5b21b6; }
    .tg-group { background: #d1fae5; color: #065f46; }
    .tg-grouped { background: #fef9c3; color: #92400e; }
    .tg-special { background: #fef9c3; color: #92400e; }
    .tg-classname { font-size: 7px; display: block; font-weight: bold; }
    .tg-subj { font-size: 6.5px; display: block; font-weight: normal; opacity: 0.85; }
    .tg-badge {
      display: inline-block; font-size: 6px;
      background: #fde68a; color: #92400e;
      border-radius: 2px; padding: 0 2px; font-weight: 700;
    }

    @page { size: A4 landscape; margin: 8mm 8mm 8mm 8mm; }
    .page-break { page-break-before: always; margin-top: 0; }

    @media screen {
      body { padding: 20px; background: #f0f0f0; }
      .print-wrap {
        background: white;
        padding: 16px;
        max-width: 1100px;
        margin: 0 auto;
        box-shadow: 0 2px 12px rgba(0,0,0,0.15);
      }
      .no-print { display: flex; gap: 12px; margin-bottom: 16px; }
      .print-btn {
        padding: 10px 24px;
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: bold;
        cursor: pointer;
      }
      .close-btn {
        padding: 10px 24px;
        background: #94a3b8;
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        cursor: pointer;
      }
    }
    @media print {
      .no-print { display: none !important; }
      body { background: white; padding: 0; }
      .print-wrap { padding: 0; box-shadow: none; }
    }
  </style>
</head>
<body>
<div class="print-wrap">
  <div class="no-print">
    <button class="print-btn" onclick="window.print()">🖨️ 印刷 / PDFとして保存</button>
    <button class="close-btn" onclick="window.close()">✕ 閉じる</button>
  </div>`;

    // ===================== 時間割グリッド =====================
    if (includeTimetable) {
      html += `
  <div class="section">
    <h2>📅 時間割表</h2>
    <table>
      <thead>
        <tr>
          <th rowspan="2" class="class-cell" style="width:44px">クラス</th>`;
      DAYS.forEach((day) => {
        html += `<th colspan="${PERIODS.length}" class="day-sep" style="font-size:9px">${day}曜日</th>`;
      });
      html += `</tr><tr>`;
      DAYS.forEach((_day) => {
        PERIODS.forEach((p, pi) => {
          html += `<th${pi === 0 ? ' class="day-sep"' : ""} style="width:${Math.floor(730 / (DAYS.length * PERIODS.length))}px">${p}</th>`;
        });
      });
      html += `</tr></thead><tbody>`;

      rowConfig.forEach((row) => {
        const cellClass = row.isSpecial
          ? "class-cell special-class-cell"
          : "class-cell";
        html += `<tr><td class="${cellClass}">${row.label}</td>`;
        DAYS.forEach((day, _di) => {
          PERIODS.forEach((period, pi) => {
            const entry = getEntry(row.grade, row.class_name, day, period);
            const isFirst = pi === 0;
            const subj = entry?.subject || "";
            const altSubj = entry?.alt_subject || "";
            const tName = entry ? getTeacherName(entry) : "";
            const sepClass = isFirst ? ' class="day-sep"' : "";
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
          });
        });
        html += `</tr>`;
      });

      html += `</tbody></table></div>`;
    }

    // ===================== 先生コマ数（TeacherScheduleGrid と同形式） =====================
    if (includeTeacherLoad) {
      const pageBreak = includeTimetable ? " page-break" : "";
      html += `
  <div class="section${pageBreak}">
    <h2>👩‍🏫 先生ごとのコマ数</h2>
    <table class="tg-table">
      <thead>
        <tr>
          <th rowspan="2" class="tg-name" style="background:#f1f5f9">先生</th>
          <th rowspan="2" style="background:#f1f5f9;border-right:2px solid #94a3b8;text-align:center;min-width:28px">週計</th>`;
      DAYS.forEach((day) => {
        html += `<th colspan="${PERIODS.length}" class="tg-day-sep" style="background:#e2e8f0;text-align:center">${day}曜日</th>`;
      });
      html += `</tr><tr>`;
      DAYS.forEach((_day) => {
        PERIODS.forEach((period, pi) => {
          const isLast = pi === PERIODS.length - 1;
          html += `<th${pi === 0 ? ' class="tg-day-sep"' : ""}${isLast ? ' class="tg-period-sep"' : ""} style="text-align:center;min-width:38px">${period}</th>`;
        });
      });
      html += `</tr>
      </thead>
      <tbody>`;

      teachers.forEach((teacher) => {
        const total = countPeriods(teacher.id);
        const totalClass = total > 0 ? "tg-total" : "tg-total tg-total-zero";
        const totalText = total > 0 ? `${total}コマ` : "－";
        html += `<tr>
          <td class="tg-name">${teacher.name.split("(")[0].trim()}<br><span style="font-size:6.5px;font-weight:normal;color:#64748b">${teacher.subjects.join("・")}</span></td>
          <td class="${totalClass}">${totalText}</td>`;

        DAYS.forEach((day) => {
          PERIODS.forEach((period, pi) => {
            const isLast = pi === PERIODS.length - 1;
            const result = getTeacherEntries(teacher.id, day, period);
            const dayClass = pi === 0 ? " tg-day-sep" : "";
            const periodClass = isLast ? " tg-period-sep" : "";

            if (!result) {
              html += `<td class="tg-empty${dayClass}${periodClass}">－</td>`;
              return;
            }

            const { first, role, allEntries, isGrouped } = result;
            let cellClass = "tg-cell";
            if (isGrouped) cellClass += " tg-grouped";
            else if (role === "group") cellClass += " tg-group";
            else if (role === "alt") cellClass += " tg-alt";
            else if (first.class_name?.includes("特支"))
              cellClass += " tg-special";
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
          });
        });

        html += `</tr>`;
      });

      html += `</tbody></table></div>`;
    }

    html += `</div></body></html>`;

    // 新しいウィンドウで開いて印刷
    const printWin = window.open("", "_blank", "width=1200,height=800");
    printWin.document.write(html);
    printWin.document.close();
    setShowModal(false);
  };

  return (
    <>
      {children({ open: () => setShowModal(true) })}

      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>📄 PDF出力の設定</h3>
            <p className={styles.sectionNote}>
              出力するページを選択してください
            </p>

            <div className={styles.optionList}>
              {[
                {
                  key: "timetable",
                  label: "📅 時間割グリッド",
                  desc: "全クラスの時間割（A4横）",
                  value: includeTimetable,
                  set: setIncludeTimetable,
                },
                {
                  key: "load",
                  label: "👩‍🏫 先生コマ数一覧",
                  desc: "コマ数サマリー＋詳細スケジュール",
                  value: includeTeacherLoad,
                  set: setIncludeTeacherLoad,
                },
              ].map((item) => (
                <label
                  key={item.key}
                  className={styles.optionCard}
                  style={{
                    border: `2px solid ${item.value ? "#3b82f6" : "#e2e8f0"}`,
                    backgroundColor: item.value ? "#eff6ff" : "#fafafa",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={item.value}
                    onChange={(e) => item.set(e.target.checked)}
                    className={styles.checkbox}
                  />
                  <div>
                    <div className={styles.optionTitle}>{item.label}</div>
                    <div className={styles.optionDescription}>{item.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            <p className={styles.hintText}>
              ※ 印刷ダイアログで「PDFとして保存」を選択することでPDF保存できます
            </p>

            <div className={styles.actionRow}>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className={styles.buttonSecondary}
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={!includeTimetable && !includeTeacherLoad}
                className={styles.buttonPrimary}
                style={{
                  background:
                    !includeTimetable && !includeTeacherLoad
                      ? "#cbd5e1"
                      : "#ef4444",
                  cursor:
                    !includeTimetable && !includeTeacherLoad
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                📄 出力する
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PdfExport;
