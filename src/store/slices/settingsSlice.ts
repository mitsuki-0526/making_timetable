import type { StateCreator } from "zustand";
import type { AppSettings, TimetableStore } from "@/types";

export interface SettingsSlice {
  settings: AppSettings;
  updateLunchPeriod: (period: number) => void;
  addMappingRule: (grade: number, fromSubj: string, toSubj: string) => void;
  removeMappingRule: (grade: number, fromSubj: string) => void;
}

export const createSettingsSlice: StateCreator<
  TimetableStore,
  [],
  [],
  SettingsSlice
> = (set) => ({
  settings: {
    mappingRules: {
      1: { 国語: "自立活動", 数学: "自立活動" },
      2: { 国語: "自立活動" },
    },
    lunch_after_period: 4,
  },

  updateLunchPeriod: (period) => {
    set((state) => ({
      settings: { ...state.settings, lunch_after_period: Number(period) },
    }));
  },

  addMappingRule: (grade, fromSubj, toSubj) => {
    set((state) => {
      const gradeRules = state.settings.mappingRules[grade] || {};
      return {
        settings: {
          ...state.settings,
          mappingRules: {
            ...state.settings.mappingRules,
            [grade]: { ...gradeRules, [fromSubj]: toSubj },
          },
        },
      };
    });
  },

  removeMappingRule: (grade, fromSubj) => {
    set((state) => {
      const newGradeRules = {
        ...(state.settings.mappingRules[grade] || {}),
      };
      delete newGradeRules[fromSubj];
      return {
        settings: {
          ...state.settings,
          mappingRules: {
            ...state.settings.mappingRules,
            [grade]: newGradeRules,
          },
        },
      };
    });
  },
});
