import type { StateCreator } from "zustand";
import type { AppSettings, TimetableStore } from "@/types";

export interface SettingsSlice {
  settings: AppSettings;
  updateLunchPeriod: (period: number) => void;
}

export const createSettingsSlice: StateCreator<
  TimetableStore,
  [],
  [],
  SettingsSlice
> = (set) => ({
  settings: {
    lunch_after_period: 4,
  },

  updateLunchPeriod: (period) => {
    set((state) => ({
      settings: { ...state.settings, lunch_after_period: Number(period) },
    }));
  },
});
