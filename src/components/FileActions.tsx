import { useRef, useState } from "react";
import { DAYS, PERIODS } from "@/constants";
import type { TimetableState } from "@/types";
import { useTimetableStore } from "../store/useTimetableStore";

declare global {
  // window.showOpenFilePicker のための簡易定義
  interface Window {
    showOpenFilePicker: (options?: {
      types?: { description: string; accept: Record<string, string[]> }[];
      multiple?: boolean;
    }) => Promise<FileSystemFileHandle[]>;
  }
}

// File System Access API が使えるか判定
const supportsFileSystemAccess =
  typeof window !== "undefined" && "showOpenFilePicker" in window;

interface FileActionsChildrenProps {
  handleOverwriteSave: () => Promise<void>;
  handleSaveAs: () => void;
  handleLoad: () => void;
  handleExcelExport: () => Promise<void>;
  fileHandle: FileSystemFileHandle | null;
  fileName: string;
}

interface FileActionsProps {
  children: (props: FileActionsChildrenProps) => React.ReactNode;
}

const FileActions = ({ children }: FileActionsProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importState = useTimetableStore((state) => state.importState);

  // 読み込んだファイルのハンドル（上書き保存用）
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(
    null,
  );
  const [fileName, setFileName] = useState("");

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

  const handleSaveAs = () => {
    const jsonString = buildJson();
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `時間割データ_${new Date().toLocaleDateString("ja-JP").replace(/\//g, "")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOverwriteSave = async () => {
    if (!fileHandle) return;
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

  const handleLoad = () => {
    if (supportsFileSystemAccess) {
      handleLoadWithAPI();
      return;
    }
    fileInputRef.current?.click();
  };

  const handleExcelExport = async () => {
    const XLSX = await import("xlsx");
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

    // シート2「先生コマ数」
    const headers2 = ["先生名", "担当教科", "週合計"];
    for (const day of DAYS) {
      for (const period of PERIODS) {
        headers2.push(`${day}${period}`);
      }
    }
    const wsData2: (string | number)[][] = [headers2];

    for (const teacher of teachers) {
      let weekTotal = 0;
      const cells = [];
      for (const day of DAYS) {
        for (const period of PERIODS) {
          const count = timetable.filter((e) => {
            if (e.day_of_week !== day || e.period !== period) return false;
            if (e.teacher_id === teacher.id || e.alt_teacher_id === teacher.id)
              return true;
            if (e.teacher_group_id) {
              const grp = teacher_groups.find(
                (g) => g.id === e.teacher_group_id,
              );
              if (grp?.teacher_ids?.includes(teacher.id)) return true;
            }
            if (e.alt_teacher_group_id) {
              const agrp = teacher_groups.find(
                (g) => g.id === e.alt_teacher_group_id,
              );
              if (agrp?.teacher_ids?.includes(teacher.id)) return true;
            }
            return false;
          }).length;
          cells.push(count > 0 ? count : "");
          if (count > 0) weekTotal++;
        }
      }
      wsData2.push([
        teacher.name.split("(")[0].trim(),
        teacher.subjects.join("・"),
        weekTotal > 0 ? weekTotal : "",
        ...cells,
      ]);
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(wsData1),
      "時間割",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(wsData2),
      "先生コマ数",
    );

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    XLSX.writeFile(wb, `時間割_${dateStr}.xlsx`);
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
