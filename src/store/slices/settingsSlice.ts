import type { StateCreator } from "zustand";
import { DEFAULT_DAY_PERIODS } from "@/lib/dayPeriods";
import type { AppSettings, TimetableStore } from "@/types";

export interface SettingsSlice {
  settings: AppSettings;
  updateLunchPeriod: (period: number) => void;
  updateDayMaxPeriod: (
    day: keyof typeof DEFAULT_DAY_PERIODS,
    period: number,
  ) => void;
}

export const createSettingsSlice: StateCreator<
  TimetableStore,
  [],
  [],
  SettingsSlice
> = (set) => ({
  settings: {
    lunch_after_period: 4,
    day_periods: DEFAULT_DAY_PERIODS,
  },

  updateLunchPeriod: (period) => {
    set((state) => ({
      settings: { ...state.settings, lunch_after_period: Number(period) },
    }));
  },

  updateDayMaxPeriod: (day, period) => {
    set((state) => ({
      settings: {
        ...state.settings,
        day_periods: {
          ...state.settings.day_periods,
          [day]: Math.min(6, Math.max(1, Number(period))) as
            | 1
            | 2
            | 3
            | 4
            | 5
            | 6,
        },
      },
    }));
  },
});
