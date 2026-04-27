// CSV/Excel parsing and export utilities
import ExcelJS from "exceljs";
import type {
  DayOfWeek,
  GradeStructure,
  Period,
  SchoolStructure,
  Teacher,
  UnavailableTime,
} from "@/types";

type ClassLike = string | { name?: string };

type ExportableGrade = {
  grade: number;
  classes?: ClassLike[];
  special_classes?: ClassLike[];
};

type ExportableStructure = Omit<SchoolStructure, "grades"> & {
  grades: ExportableGrade[];
};

type MutableGradeStructure = GradeStructure & {
  special_classes: string[];
};

const VALID_DAYS: DayOfWeek[] = ["月", "火", "水", "木", "金"];
const VALID_PERIODS: Period[] = [1, 2, 3, 4, 5, 6];

function isDayOfWeek(value: string): value is DayOfWeek {
  return VALID_DAYS.includes(value as DayOfWeek);
}

function isPeriod(value: number): value is Period {
  return VALID_PERIODS.includes(value as Period);
}

function parseUnavailableTimes(raw: string): UnavailableTime[] {
  return raw
    .split(";")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .map((token) => ({
      day_of_week: token.slice(0, 1),
      period: parseInt(token.slice(1), 10),
    }))
    .filter(
      (
        time,
      ): time is {
        day_of_week: DayOfWeek;
        period: Period;
      } => isDayOfWeek(time.day_of_week) && isPeriod(time.period),
    );
}

function resolveClassName(classLike: ClassLike): string {
  return typeof classLike === "string"
    ? classLike
    : (classLike.name ?? String(classLike));
}

export interface ValidationError {
  row: number;
  column: string;
  message: string;
}

// Simple CSV parser that handles quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function parseCSVText(text: string): string[][] {
  const lines = text.trim().split("\n");
  return lines.map((line) => parseCSVLine(line));
}

// Escape CSV values with quotes if needed
function escapeCSVValue(value: string | number | boolean): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ===== STRUCTURE CSV =====

export function exportStructureToCSV(
  structure: ExportableStructure,
  subjectList: string[],
): string {
  const headers = ["grade", "class_name", "is_special_class", ...subjectList];
  const rows: string[] = [headers.map(escapeCSVValue).join(",")];

  for (const grade of structure.grades || []) {
    // classes は string[] (通常クラス名)
    for (const cls of grade.classes || []) {
      const className = resolveClassName(cls);
      const reqKey = `${grade.grade}_通常`;
      const required = structure.required_hours?.[reqKey] || {};

      const values = [grade.grade, className, "FALSE"];
      for (const subject of subjectList) {
        values.push(required[subject]?.toString() || "0");
      }

      rows.push(values.map(escapeCSVValue).join(","));
    }

    // special_classes は string[] (特支クラス名)
    for (const cls of grade.special_classes || []) {
      const className = resolveClassName(cls);
      const reqKey = `${grade.grade}_特支`;
      const required = structure.required_hours?.[reqKey] || {};

      const values = [grade.grade, className, "TRUE"];
      for (const subject of subjectList) {
        values.push(required[subject]?.toString() || "0");
      }

      rows.push(values.map(escapeCSVValue).join(","));
    }
  }

  return rows.join("\n");
}

export function parseStructureCSV(
  csvText: string,
  subjectList: string[],
): SchoolStructure {
  const lines = parseCSVText(csvText);
  if (lines.length === 0) throw new Error("Empty CSV");

  const headers = lines[0];
  const gradeIdx = headers.indexOf("grade");
  const classNameIdx = headers.indexOf("class_name");
  const specialIdx = headers.indexOf("is_special_class");

  if (gradeIdx === -1 || classNameIdx === -1 || specialIdx === -1) {
    throw new Error("Missing required columns in structure CSV");
  }

  const gradesMap = new Map<number, MutableGradeStructure>();
  const requiredHours: Record<string, Record<string, number>> = {};

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    if (row.length === 0 || !row[gradeIdx]) continue;

    const gradeNum = parseInt(row[gradeIdx], 10);
    const className = row[classNameIdx];
    const isSpecial = row[specialIdx]?.toUpperCase() === "TRUE";

    if (!gradesMap.has(gradeNum)) {
      gradesMap.set(gradeNum, {
        grade: gradeNum,
        classes: [],
        special_classes: [],
      });
    }

    const gradeEntry = gradesMap.get(gradeNum);
    if (!gradeEntry) continue;
    if (isSpecial) {
      gradeEntry.special_classes.push(className);
    } else {
      gradeEntry.classes.push(className);
    }

    const reqKey = `${gradeNum}_${isSpecial ? "特支" : "通常"}`;
    if (!requiredHours[reqKey]) {
      requiredHours[reqKey] = {};
    }

    for (const subject of subjectList) {
      const colIdx = headers.indexOf(subject);
      if (colIdx !== -1 && row[colIdx]) {
        requiredHours[reqKey][subject] = parseInt(row[colIdx], 10);
      }
    }
  }

  return {
    grades: Array.from(gradesMap.values()).sort((a, b) => a.grade - b.grade),
    required_hours: requiredHours,
  };
}

export function validateStructureCSV(
  csvText: string,
  subjectList: string[],
): ValidationError[] {
  const errors: ValidationError[] = [];
  const lines = parseCSVText(csvText);

  if (lines.length === 0) {
    errors.push({
      row: 0,
      column: "all",
      message: "Empty CSV file",
    });
    return errors;
  }

  const headers = lines[0];
  const requiredCols = [
    "grade",
    "class_name",
    "is_special_class",
    ...subjectList,
  ];

  for (const col of requiredCols) {
    if (!headers.includes(col)) {
      errors.push({
        row: 0,
        column: col,
        message: `Missing required column: ${col}`,
      });
    }
  }

  if (errors.length > 0) return errors;

  const gradeIdx = headers.indexOf("grade");
  const specialIdx = headers.indexOf("is_special_class");

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    if (row.length === 0 || !row[gradeIdx]) continue;

    const gradeVal = row[gradeIdx];
    if (Number.isNaN(parseInt(gradeVal, 10))) {
      errors.push({
        row: i + 1,
        column: "grade",
        message: `Invalid grade value: ${gradeVal}`,
      });
    }

    const special = row[specialIdx]?.toUpperCase();
    if (special !== "TRUE" && special !== "FALSE") {
      errors.push({
        row: i + 1,
        column: "is_special_class",
        message: `Must be TRUE or FALSE, got: ${row[specialIdx]}`,
      });
    }
  }

  return errors;
}

// ===== TEACHERS CSV =====

export function exportTeachersToCSV(teachers: Teacher[]): string {
  const headers = [
    "id",
    "name",
    "subjects",
    "target_grades",
    "unavailable_days",
  ];
  const rows: string[] = [headers.map(escapeCSVValue).join(",")];

  for (const teacher of teachers || []) {
    const subjects = (teacher.subjects || []).join(",");
    const grades = (teacher.target_grades || []).join(";");
    const unavailable = (teacher.unavailable_times || [])
      .map((time) => `${time.day_of_week}${time.period}`)
      .join(";");

    const values = [
      teacher.id || "",
      teacher.name || "",
      subjects,
      grades,
      unavailable,
    ];

    rows.push(values.map(escapeCSVValue).join(","));
  }

  return rows.join("\n");
}

export function parseTeachersCSV(csvText: string): Teacher[] {
  const lines = parseCSVText(csvText);
  if (lines.length === 0) throw new Error("Empty CSV");

  const headers = lines[0];
  const idIdx = headers.indexOf("id");
  const nameIdx = headers.indexOf("name");
  const subjectsIdx = headers.indexOf("subjects");
  const gradesIdx = headers.indexOf("target_grades");
  const unavailableIdx = headers.indexOf("unavailable_days");

  if (
    idIdx === -1 ||
    nameIdx === -1 ||
    subjectsIdx === -1 ||
    gradesIdx === -1
  ) {
    throw new Error("Missing required columns in teachers CSV");
  }

  const teachers: Teacher[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    if (row.length === 0 || !row[idIdx]) continue;

    const subjects = row[subjectsIdx]
      ? row[subjectsIdx].split(",").map((s) => s.trim())
      : [];
    const grades = row[gradesIdx]
      ? row[gradesIdx].split(";").map((g) => parseInt(g.trim(), 10))
      : [];
    // "月3" → { day_of_week: "月", period: 3 }
    const unavailable = row[unavailableIdx]
      ? parseUnavailableTimes(row[unavailableIdx])
      : [];

    teachers.push({
      id: row[idIdx],
      name: row[nameIdx],
      subjects,
      target_grades: grades,
      unavailable_times: unavailable,
    });
  }

  return teachers;
}

export function validateTeachersCSV(csvText: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const lines = parseCSVText(csvText);

  if (lines.length === 0) {
    errors.push({
      row: 0,
      column: "all",
      message: "Empty CSV file",
    });
    return errors;
  }

  const headers = lines[0];
  const requiredCols = ["id", "name", "subjects", "target_grades"];

  for (const col of requiredCols) {
    if (!headers.includes(col)) {
      errors.push({
        row: 0,
        column: col,
        message: `Missing required column: ${col}`,
      });
    }
  }

  if (errors.length > 0) return errors;

  const idIdx = headers.indexOf("id");
  const gradesIdx = headers.indexOf("target_grades");

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    if (row.length === 0 || !row[idIdx]) continue;

    if (row[gradesIdx]) {
      const grades = row[gradesIdx].split(";").map((g) => g.trim());
      for (const grade of grades) {
        if (Number.isNaN(parseInt(grade, 10))) {
          errors.push({
            row: i + 1,
            column: "target_grades",
            message: `Invalid grade value: ${grade}`,
          });
        }
      }
    }
  }

  return errors;
}

// ===== EXCEL EXPORT (multi-sheet with dropdown validation) =====

export async function exportToExcel(
  structure: ExportableStructure,
  teachers: Teacher[],
  subjectList: string[],
): Promise<Blob> {
  const wb = new ExcelJS.Workbook();

  // 非表示ヘルパーシート（プルダウン選択肢の参照元）
  const dvSheet = wb.addWorksheet("__dv", { state: "veryHidden" });
  dvSheet.getCell("A1").value = "〇";
  dvSheet.getCell("A2").value = "✕";

  // === Sheet1: クラス編成（行指向: 1行1教科） ===
  const ws1 = wb.addWorksheet("クラス編成");
  ws1.addRow(["grade", "class_name", "is_special_class", "subject", "hours"]);
  ws1.getRow(1).font = { bold: true };

  const addStructureRows = (
    grade: ExportableGrade,
    className: string,
    isSpecial: boolean,
  ) => {
    const reqKey = `${grade.grade}_${isSpecial ? "特支" : "通常"}`;
    const required = structure.required_hours?.[reqKey] || {};
    for (const subject of subjectList) {
      ws1.addRow([
        grade.grade,
        className,
        isSpecial ? "〇" : "✕",
        subject,
        required[subject] ?? 0,
      ]);
    }
  };

  for (const grade of structure.grades || []) {
    for (const cls of grade.classes || []) {
      const name = resolveClassName(cls);
      addStructureRows(grade, name, false);
    }
    for (const cls of grade.special_classes || []) {
      const name = resolveClassName(cls);
      addStructureRows(grade, name, true);
    }
  }

  // is_special_class 列(C)に〇/✕ プルダウン（非表示シートのセル範囲参照）
  const s1Rows = ws1.rowCount;
  for (let i = 2; i <= s1Rows; i++) {
    ws1.getCell(`C${i}`).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: ["__dv!$A$1:$A$2"],
      showErrorMessage: true,
      errorTitle: "入力エラー",
      error: "〇 または ✕ を選択してください",
    };
  }

  // 列幅調整
  ws1.columns = [
    { key: "grade", width: 8 },
    { key: "class_name", width: 12 },
    { key: "is_special_class", width: 16 },
    { key: "subject", width: 14 },
    { key: "hours", width: 8 },
  ];

  // === Sheet2: 教員リスト ===
  const ws2 = wb.addWorksheet("教員リスト");
  ws2.addRow(["id", "name", "subjects", "target_grades", "unavailable_days"]);
  ws2.getRow(1).font = { bold: true };

  for (const teacher of teachers || []) {
    const subjects = (teacher.subjects || []).join(",");
    const grades = (teacher.target_grades || []).join(";");
    const unavailable = (teacher.unavailable_times || [])
      .map((time) => `${time.day_of_week}${time.period}`)
      .join(";");
    ws2.addRow([
      teacher.id || "",
      teacher.name || "",
      subjects,
      grades,
      unavailable,
    ]);
  }

  ws2.columns = [
    { key: "id", width: 10 },
    { key: "name", width: 16 },
    { key: "subjects", width: 24 },
    { key: "target_grades", width: 16 },
    { key: "unavailable_days", width: 24 },
  ];

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

// ===== EXCEL IMPORT =====

export async function importFromExcel(file: File): Promise<{
  structure: SchoolStructure | null;
  teachers: Teacher[] | null;
}> {
  const wb = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await wb.xlsx.load(buffer);

  let structure: SchoolStructure | null = null;
  let teachers: Teacher[] | null = null;

  // Sheet1: クラス編成
  const ws1 = wb.getWorksheet("クラス編成");
  if (ws1) {
    const gradesMap = new Map<number, MutableGradeStructure>();
    const requiredHours: Record<string, Record<string, number>> = {};

    ws1.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      const gradeNum = Number(row.getCell(1).value);
      const className = String(row.getCell(2).value ?? "");
      const specialVal = String(row.getCell(3).value ?? "").trim();
      const isSpecial = specialVal === "〇" || specialVal === "TRUE";
      const subject = String(row.getCell(4).value ?? "");
      const hours = Number(row.getCell(5).value ?? 0);

      if (!gradeNum || !className || !subject) return;

      if (!gradesMap.has(gradeNum)) {
        gradesMap.set(gradeNum, {
          grade: gradeNum,
          classes: [],
          special_classes: [],
        });
      }
      const g = gradesMap.get(gradeNum);
      if (!g) return;

      if (isSpecial) {
        if (!g.special_classes.includes(className))
          g.special_classes.push(className);
      } else {
        if (!g.classes.includes(className)) g.classes.push(className);
      }

      const reqKey = `${gradeNum}_${isSpecial ? "特支" : "通常"}`;
      if (!requiredHours[reqKey]) requiredHours[reqKey] = {};
      requiredHours[reqKey][subject] = hours;
    });

    structure = {
      grades: Array.from(gradesMap.values()).sort((a, b) => a.grade - b.grade),
      required_hours: requiredHours,
    };
  }

  // Sheet2: 教員リスト
  const ws2 = wb.getWorksheet("教員リスト");
  if (ws2) {
    const rows: Teacher[] = [];
    ws2.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      const id = String(row.getCell(1).value ?? "");
      if (!id) return;

      const subjects = String(row.getCell(3).value ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const grades = String(row.getCell(4).value ?? "")
        .split(";")
        .map((g) => parseInt(g.trim(), 10))
        .filter((n) => !Number.isNaN(n));
      const unavailable = parseUnavailableTimes(
        String(row.getCell(5).value ?? ""),
      );

      rows.push({
        id,
        name: String(row.getCell(2).value ?? ""),
        subjects,
        target_grades: grades,
        unavailable_times: unavailable,
      });
    });
    teachers = rows;
  }

  return { structure, teachers };
}

// Helper to download a file
export async function downloadFile(blob: Blob, filename: string) {
  const isTauri =
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  if (isTauri) {
    const [{ save }, { writeFile }] = await Promise.all([
      import("@tauri-apps/plugin-dialog"),
      import("@tauri-apps/plugin-fs"),
    ]);
    const savePath = await save({
      defaultPath: filename,
      filters: [{ name: "Excel", extensions: ["xlsx"] }],
    });
    if (savePath) {
      const buffer = await blob.arrayBuffer();
      await writeFile(savePath, new Uint8Array(buffer));
    }
  } else {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
