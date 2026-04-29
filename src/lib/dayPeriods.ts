import { DAYS, PERIODS } from "@/constants";
import type { AppSettings, DayOfWeek, Period } from "@/types";

export const DEFAULT_DAY_PERIODS: Record<DayOfWeek, Period> = {
  月: 6,
  火: 6,
  水: 6,
  木: 6,
  金: 6,
};

function clampPeriod(value: number | null | undefined): Period {
  const normalized = Math.floor(Number(value));
  if (Number.isNaN(normalized)) return 6;
  return Math.min(6, Math.max(1, normalized)) as Period;
}

export function normalizeDayPeriods(
  dayPeriods?: Partial<Record<DayOfWeek, number | Period>> | null,
): Record<DayOfWeek, Period> {
  return Object.fromEntries(
    DAYS.map((day) => [day, clampPeriod(dayPeriods?.[day])]),
  ) as Record<DayOfWeek, Period>;
}

export function getMaxPeriodForDay(
  settings: Partial<AppSettings> | null | undefined,
  day: DayOfWeek,
): Period {
  return normalizeDayPeriods(settings?.day_periods)[day];
}

export function getPeriodsForDay(
  settings: Partial<AppSettings> | null | undefined,
  day: DayOfWeek,
): Period[] {
  const maxPeriod = getMaxPeriodForDay(settings, day);
  return PERIODS.filter((period) => period <= maxPeriod);
}

export function getDisplayPeriods(
  settings: Partial<AppSettings> | null | undefined,
): Period[] {
  const maxConfiguredPeriod = DAYS.reduce(
    (currentMax, day) =>
      Math.max(currentMax, getMaxPeriodForDay(settings, day)),
    1,
  ) as Period;

  return PERIODS.filter((period) => period <= maxConfiguredPeriod);
}

export function isPeriodEnabled(
  settings: Partial<AppSettings> | null | undefined,
  day: DayOfWeek,
  period: Period,
): boolean {
  return period <= getMaxPeriodForDay(settings, day);
}

export function getActiveSlots(
  settings: Partial<AppSettings> | null | undefined,
) {
  return DAYS.flatMap((day) =>
    getPeriodsForDay(settings, day).map((period) => ({ day, period })),
  );
}

export function getTotalWeeklyPeriods(
  settings: Partial<AppSettings> | null | undefined,
): number {
  return DAYS.reduce(
    (sum, day) => sum + getPeriodsForDay(settings, day).length,
    0,
  );
}
