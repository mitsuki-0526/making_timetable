/**
 * パレットからのタッチD&D処理
 * HTML5 DragEventはタッチ非対応のため、Touch Eventsで代替実装する。
 */
import type { DayOfWeek, Period } from "@/types";
import { useTimetableStore } from "@/store/useTimetableStore";

export type PaletteDragData =
  | { kind: "subject"; subject: string }
  | { kind: "teacher"; teacher_id: string }
  | { kind: "teacher_group"; teacher_group_id: string };

let _data: PaletteDragData | null = null;
let _ghost: HTMLDivElement | null = null;

/** タッチ開始時にゴースト要素を生成してドラッグ開始 */
export function touchDragStart(
  data: PaletteDragData,
  label: string,
  clientX: number,
  clientY: number,
) {
  _data = data;

  _ghost = document.createElement("div");
  _ghost.textContent = label;
  Object.assign(_ghost.style, {
    position: "fixed",
    left: `${clientX - 24}px`,
    top: `${clientY - 24}px`,
    padding: "4px 10px",
    background: "#3b82f6",
    color: "#fff",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "600",
    pointerEvents: "none",
    zIndex: "9999",
    opacity: "0.88",
    boxShadow: "0 3px 10px rgba(0,0,0,0.3)",
    whiteSpace: "nowrap",
    userSelect: "none",
  });
  document.body.appendChild(_ghost);
}

/** タッチ移動時にゴーストを追従させる */
export function touchDragMove(clientX: number, clientY: number) {
  if (!_ghost) return;
  _ghost.style.left = `${clientX - 24}px`;
  _ghost.style.top = `${clientY - 24}px`;
}

/** タッチ終了時: ゴーストを消し、指の下のセルにドロップ処理を実行 */
export function touchDragEnd(clientX: number, clientY: number) {
  if (!_data) return;
  const data = _data;
  _data = null;

  // ゴーストを一時非表示にしてelementFromPointで下の要素を取得
  if (_ghost) _ghost.style.display = "none";
  const el = document.elementFromPoint(clientX, clientY);
  if (_ghost) {
    document.body.removeChild(_ghost);
    _ghost = null;
  }

  if (!el) return;

  // data-cell-key を持つ祖先要素を探す
  let target: Element | null = el;
  while (target && !target.getAttribute("data-cell-key")) {
    target = target.parentElement;
  }
  const cellKey = target?.getAttribute("data-cell-key");
  if (!cellKey) return;

  // "grade|class_name|day_of_week|period" の形式をパース
  const [gradeStr, class_name, day_of_week, periodStr] = cellKey.split("|");
  const grade = parseInt(gradeStr, 10);
  const period = parseInt(periodStr, 10) as Period;
  const dow = day_of_week as DayOfWeek;

  // Zustand store に直接アクセス（getState はコンポーネント外でも使用可能）
  const store = useTimetableStore.getState();
  if (data.kind === "subject") {
    store.setTimetableEntry(dow, period, grade, class_name, null, data.subject);
  } else if (data.kind === "teacher") {
    store.setTimetableTeacher(dow, period, grade, class_name, data.teacher_id);
  } else if (data.kind === "teacher_group") {
    store.setEntryGroup(dow, period, grade, class_name, data.teacher_group_id);
  }
}
