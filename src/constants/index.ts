// ═══════════════════════════════════════════════════════════
// 時間割作成ツール — 共有定数
// ═══════════════════════════════════════════════════════════

import type { DayOfWeek, Period } from "@/types";

/** 曜日（月〜金） */
export const DAYS: readonly DayOfWeek[] = [
  "月",
  "火",
  "水",
  "木",
  "金",
] as const;

/** 時限（1〜6） */
export const PERIODS: readonly Period[] = [1, 2, 3, 4, 5, 6] as const;

/** セルグループのカラーパレット */
export const GROUP_COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#84CC16",
] as const;

/** 曜日ごとのコンテナカラー（M3 harmonized） */
export const DAY_COLOR: Record<
  DayOfWeek,
  { container: string; on: string; fixed: string }
> = {
  月: {
    container: "var(--day-mon-container)",
    on: "var(--day-mon-on)",
    fixed: "var(--day-mon-fixed)",
  },
  火: {
    container: "var(--day-tue-container)",
    on: "var(--day-tue-on)",
    fixed: "var(--day-tue-fixed)",
  },
  水: {
    container: "var(--day-wed-container)",
    on: "var(--day-wed-on)",
    fixed: "var(--day-wed-fixed)",
  },
  木: {
    container: "var(--day-thu-container)",
    on: "var(--day-thu-on)",
    fixed: "var(--day-thu-fixed)",
  },
  金: {
    container: "var(--day-fri-container)",
    on: "var(--day-fri-on)",
    fixed: "var(--day-fri-fixed)",
  },
};
