import { useRef, useState } from "react";
import { DAYS, PERIODS } from "@/constants";
import { entryIncludesTeacher } from "@/lib/teamTeaching";
import type { TimetableState } from "@/types";
import { useTimetableStore } from "../store/useTimetableStore";

declare global {
  // window.showOpenFilePicker のための簡易定義
  interface Window {
    showOpenFilePicker: (options?: {
      types?: { description: string; accept: Record<string, string[]> }[];
      multiple?: boolean;
    }) => Promise<FileSystemFileHandle[]>;
    showSaveFilePicker: (options?: {
      suggestedName?: string;
      types?: { description: string; accept: Record<string, string[]> }[];
    }) => Promise<FileSystemFileHandle>;
  }
}

type SaveFilePickerHandle = FileSystemFileHandle & { name?: string };

// File System Access API が使えるか判定
const supportsFileSystemAccess =
  typeof window !== "undefined" &&
  ("showOpenFilePicker" in window || "showSaveFilePicker" in window);

interface FileActionsChildrenProps {
  handleOverwriteSave: () => Promise<void>;
  handleSaveAs: () => Promise<void>;
  handleLoad: () => Promise<void>;
  handleExcelExport: () => Promise<void>;
  fileHandle: FileSystemFileHandle | string | null;
  fileName: string;
}

interface FileActionsProps {
  children: (props: FileActionsChildrenProps) => React.ReactNode;
}

const FileActions = ({ children }: FileActionsProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importState = useTimetableStore((state) => state.importState);

  // 読み込んだファイルの参照（上書き保存用）
  const [fileHandle, setFileHandle] = useState<
    FileSystemFileHandle | string | null
  >(null);
  const [fileName, setFileName] = useState("");

  const isTauriRuntime =
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  const ensureTauriSaveDir = async () => {
    const [{ documentDir, join }, { exists, mkdir }] = await Promise.all([
      import("@tauri-apps/api/path"),
      import("@tauri-apps/plugin-fs"),
    ]);
    const rootDir = await documentDir();
    const appDir = await join(rootDir, "時間割作成ツール", "save");
    const saveDirExists = await exists(appDir);
    if (!saveDirExists) {
      await mkdir(appDir, { recursive: true });
    }
    return appDir;
  };

  // 現在のストア状態をJSONに変換
  const buildJson = () => {
    const state = useTimetableStore.getState();
    const data: Partial<TimetableState> = {
      teachers: state.teachers,
      teacher_groups: state.teacher_groups,
      class_groups: state.class_groups,
      structure: state.structure,
      timetable: state.timetable,
      settings: state.settings,
      subject_constraints: state.subject_constraints,
      subject_pairings: state.subject_pairings,
      cell_groups: state.cell_groups,
      fixed_slots: state.fixed_slots,
      teacher_constraints: state.teacher_constraints,
      subject_placement: state.subject_placement,
      facilities: state.facilities,
      subject_facility: state.subject_facility,
      alt_week_pairs: state.alt_week_pairs,
      cross_grade_groups: state.cross_grade_groups,
      subject_sequences: state.subject_sequences,
    };
    return JSON.stringify(data, null, 2);
  };

  const handleSaveAs = async () => {
    const jsonString = buildJson();
    const defaultName = `時間割データ_${new Date()
      .toLocaleDateString("ja-JP")
      .replace(/\//g, "")}.json`;

    if (isTauriRuntime) {
      try {
        const [{ save }, { writeTextFile }, { basename, join }] =
          await Promise.all([
            import("@tauri-apps/plugin-dialog"),
            import("@tauri-apps/plugin-fs"),
            import("@tauri-apps/api/path"),
          ]);
        const saveDir = await ensureTauriSaveDir();
        const targetPath = await save({
          defaultPath: await join(saveDir, defaultName),
          filters: [{ name: "JSON", extensions: ["json"] }],
        });
        if (!targetPath) return;

        await writeTextFile(targetPath, jsonString);
        setFileHandle(targetPath);
        setFileName(await basename(targetPath));
        alert(`「${await basename(targetPath)}」として保存しました`);
        return;
      } catch (err: unknown) {
        alert(`保存に失敗しました: ${(err as Error).message ?? String(err)}`);
        return;
      }
    }

    // ネイティブFile System Access API が使える場合
    if (supportsFileSystemAccess && "showSaveFilePicker" in window) {
      try {
        const handle = (await window.showSaveFilePicker({
          suggestedName: defaultName,
          types: [
            { description: "JSON", accept: { "application/json": [".json"] } },
          ],
        })) as SaveFilePickerHandle;
        const writable = await handle.createWritable();
        await writable.write(
          new Blob([jsonString], { type: "application/json" }),
        );
        await writable.close();
        setFileHandle(handle);
        // 一部実装は handle.name がある
        setFileName(handle.name ?? defaultName);
        alert(`「${handle.name ?? defaultName}」として保存しました`);
        return;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        alert(`保存に失敗しました: ${(err as Error).message ?? String(err)}`);
        return;
      }
    }

    // フォールバック: ブラウザのダウンロード（ファイル名をユーザーに入力させる）
    const filename = window.prompt(
      "保存するファイル名を入力してください",
      defaultName,
    );
    if (!filename) return;
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".json") ? filename : `${filename}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOverwriteSave = async () => {
    if (!fileHandle) {
      await handleSaveAs();
      return;
    }

    if (typeof fileHandle === "string") {
      try {
        const { writeTextFile } = await import("@tauri-apps/plugin-fs");
        await writeTextFile(fileHandle, buildJson());
        alert(`「${fileName}」に上書き保存しました`);
      } catch (err: unknown) {
        alert(
          `上書き保存に失敗しました: ${(err as Error).message ?? String(err)}`,
        );
      }
      return;
    }

    try {
      const writable = await fileHandle.createWritable();
      await writable.write(buildJson());
      await writable.close();
      alert(`「${fileName}」に上書き保存しました`);
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        alert(`上書き保存に失敗しました: ${err.message}`);
      }
    }
  };

  const handleLoadWithAPI = async () => {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [
          { description: "JSON", accept: { "application/json": [".json"] } },
        ],
      });
      const file = await handle.getFile();
      const text = await file.text();
      const jsonData = JSON.parse(text);
      if (
        jsonData.teachers &&
        jsonData.structure &&
        jsonData.timetable &&
        jsonData.settings
      ) {
        importState(jsonData);
        setFileHandle(handle);
        setFileName(file.name);
        alert(`「${file.name}」を読み込みました`);
      } else {
        alert("エラー: ファイルの形式が正しくありません。");
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        alert(`読み込みに失敗しました: ${err.message}`);
      }
    }
  };

  const handleLoadWithTauri = async () => {
    try {
      const [{ open }, { readTextFile }, { basename }] = await Promise.all([
        import("@tauri-apps/plugin-dialog"),
        import("@tauri-apps/plugin-fs"),
        import("@tauri-apps/api/path"),
      ]);
      const saveDir = await ensureTauriSaveDir();
      const selectedPath = await open({
        defaultPath: saveDir,
        multiple: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!selectedPath || Array.isArray(selectedPath)) return;

      const text = await readTextFile(selectedPath);
      const jsonData = JSON.parse(text);
      if (
        jsonData.teachers &&
        jsonData.structure &&
        jsonData.timetable &&
        jsonData.settings
      ) {
        importState(jsonData);
        setFileHandle(selectedPath);
        const loadedName = await basename(selectedPath);
        setFileName(loadedName);
        alert(`「${loadedName}」を読み込みました`);
      } else {
        alert("エラー: ファイルの形式が正しくありません。");
      }
    } catch (err: unknown) {
      alert(`読み込みに失敗しました: ${(err as Error).message ?? String(err)}`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonData = JSON.parse(event.target?.result as string);
        if (
          jsonData.teachers &&
          jsonData.structure &&
          jsonData.timetable &&
          jsonData.settings
        ) {
          importState(jsonData);
          setFileHandle(null);
          setFileName(file.name);
          alert(
            `「${file.name}」を読み込みました（上書き保存は非対応ブラウザのため使えません）`,
          );
        } else {
          alert("エラー: ファイルの形式が正しくありません。");
        }
      } catch {
        alert("エラー: ファイルのパースに失敗しました。");
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const handleLoad = async () => {
    if (isTauriRuntime) {
      await handleLoadWithTauri();
      return;
    }

    if (supportsFileSystemAccess) {
      await handleLoadWithAPI();
      return;
    }
    fileInputRef.current?.click();
  };

  const handleExcelExport = async () => {
    const ExcelJS = (await import("exceljs")).default;
    const state = useTimetableStore.getState();
    const { timetable, structure, teachers, teacher_groups } = state;

    // 時間割ルックアップ
    const lookup: Record<string, (typeof timetable)[0]> = {};
    for (const entry of timetable) {
      const key = `${entry.grade}|${entry.class_name}|${entry.day_of_week}|${entry.period}`;
      lookup[key] = entry;
    }

    // 全クラス一覧
    const classes: { grade: number; class_name: string }[] = [];
    for (const grade of structure.grades) {
      for (const cls of grade.classes) {
        classes.push({ grade: grade.grade, class_name: cls });
      }
    }

    // シート1「時間割」
    const wsData1: (string | number)[][] = [];
    for (const { grade, class_name } of classes) {
      wsData1.push([`${grade}年 ${class_name}`, "", "", "", "", ""]);
      wsData1.push(["", "月", "火", "水", "木", "金"]);
      for (const period of PERIODS) {
        const row = [`${period}限`];
        for (const day of DAYS) {
          const key = `${grade}|${class_name}|${day}|${period}`;
          const entry = lookup[key];
          if (!entry) {
            row.push("");
          } else if (entry.alt_subject) {
            row.push(`A:${entry.subject} / B:${entry.alt_subject}`);
          } else {
            row.push(entry.subject || "");
          }
        }
        wsData1.push(row);
      }
      wsData1.push([]);
    }

    // クラス名から番号部分を抽出（"1組" → "1"、番号なしはそのまま）
    const extractClassNum = (class_name: string): string => {
      const m = class_name.match(/^(\d+)/);
      return m ? m[1] : class_name;
    };

    /**
     * 担当クラス一覧を表記フォーマットに変換
     *   同学年の複数クラス → "3-12"（学年-クラス番号を連結）
     *   異学年が混在      → 学年ごとに改行 "1-12\n2-1"
     */
    const formatSlotClasses = (
      entries: { grade: number; class_name: string }[],
    ): string => {
      // 重複除去
      const seen = new Map<string, { grade: number; class_name: string }>();
      for (const e of entries) {
        const key = `${e.grade}|${e.class_name}`;
        if (!seen.has(key)) seen.set(key, e);
      }

      // 学年ごとにグループ化
      const byGrade = new Map<number, string[]>();
      for (const { grade, class_name } of seen.values()) {
        const classesInGrade = byGrade.get(grade) ?? [];
        classesInGrade.push(class_name);
        byGrade.set(grade, classesInGrade);
      }

      return [...byGrade.entries()]
        .sort(([a], [b]) => a - b)
        .map(([grade, classNames]) => {
          // クラス番号で昇順ソートして連結
          const nums = classNames.map(extractClassNum).sort((a, b) => {
            const na = Number(a);
            const nb = Number(b);
            return !Number.isNaN(na) && !Number.isNaN(nb)
              ? na - nb
              : a.localeCompare(b);
          });
          return `${grade}-${nums.join("")}`;
        })
        .join("\r\n");
    };

    // シート2「先生担当クラス」
    const headers2 = ["先生名", "担当教科", "週合計コマ"];
    for (const day of DAYS) {
      for (const period of PERIODS) {
        headers2.push(`${day}${period}`);
      }
    }
    const wsData2: (string | number)[][] = [headers2];

    // 時限キー → エントリ一覧のルックアップを事前構築
    const slotMap: Record<string, typeof timetable> = {};
    for (const e of timetable) {
      const key = `${e.day_of_week}-${e.period}`;
      if (!slotMap[key]) slotMap[key] = [];
      slotMap[key].push(e);
    }

    for (const teacher of teachers) {
      // エントリがこの教員に直接関係するか判定
      const matchesTeacher = (e: (typeof timetable)[0]) =>
        entryIncludesTeacher(e, teacher.id, teacher_groups);

      let weekTotal = 0;
      const cells: string[] = [];

      for (const day of DAYS) {
        for (const period of PERIODS) {
          const slotEntries = slotMap[`${day}-${period}`] ?? [];

          // 直接マッチするエントリを抽出
          const matched = slotEntries.filter(matchesTeacher);

          // 直接マッチしたエントリの cell_group_id を収集
          const cellGroupIds = new Set(
            matched.map((e) => e.cell_group_id).filter(Boolean) as string[],
          );

          // 直接マッチ OR 同じ合同コマグループに属する全エントリを対象にする
          const relevant = slotEntries.filter(
            (e) =>
              matchesTeacher(e) ||
              (e.cell_group_id != null && cellGroupIds.has(e.cell_group_id)),
          );

          const cellValue = formatSlotClasses(relevant);
          cells.push(cellValue);
          if (cellValue) weekTotal++;
        }
      }

      wsData2.push([
        teacher.name.split("(")[0].trim(),
        teacher.subjects.join("・"),
        weekTotal > 0 ? weekTotal : "",
        ...cells,
      ]);
    }

    // シート2は行高さと折り返しを明示して、開いた直後から改行表示させる
    const numRows2 = wsData2.length;
    const numCols2 = wsData2[0]?.length ?? 0;
    const rowMaxLines: number[] = new Array(numRows2).fill(1);

    for (let r = 0; r < numRows2; r++) {
      for (let c = 0; c < numCols2; c++) {
        const raw = wsData2[r][c] ?? "";
        const isNum = typeof raw === "number";
        const strVal = String(raw);

        // 改行数を追跡して行の高さを計算
        if (!isNum && strVal.includes("\n")) {
          const lineCount = strVal.split("\n").length;
          rowMaxLines[r] = Math.max(rowMaxLines[r], lineCount);
        }
      }
    }

    const wb = new ExcelJS.Workbook();
    const ws1 = wb.addWorksheet("時間割");
    for (const row of wsData1) {
      ws1.addRow(row);
    }

    const ws2 = wb.addWorksheet("先生担当クラス");
    for (let r = 0; r < wsData2.length; r++) {
      const row = ws2.addRow(wsData2[r]);
      row.height = rowMaxLines[r] * 16 + 4;
      row.eachCell((cell) => {
        cell.alignment = { vertical: "top", wrapText: true };
      });
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const buffer = await wb.xlsx.writeBuffer();
    const fileName = `時間割_${dateStr}.xlsx`;

    if (isTauriRuntime) {
      const [{ save }, { writeFile }] = await Promise.all([
        import("@tauri-apps/plugin-dialog"),
        import("@tauri-apps/plugin-fs"),
      ]);
      const savePath = await save({
        defaultPath: fileName,
        filters: [{ name: "Excel", extensions: ["xlsx"] }],
      });
      if (savePath) {
        await writeFile(savePath, new Uint8Array(buffer as ArrayBuffer));
      }
    } else {
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <>
      {children({
        handleOverwriteSave,
        handleSaveAs,
        handleLoad,
        handleExcelExport,
        fileHandle,
        fileName,
      })}
      <input
        type="file"
        accept=".json"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
    </>
  );
};

export default FileActions;
