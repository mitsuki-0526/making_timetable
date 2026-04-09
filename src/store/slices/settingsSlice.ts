import type { Settings, MappingRule } from '@/types'
import { DEFAULT_LUNCH_AFTER_PERIOD } from '@/constants/school'

export type SettingsSlice = {
  settings: Settings
  addMappingRule: (rule: MappingRule) => void
  removeMappingRule: (grade: number, fromSubject: string) => void
  updateLunchPeriod: (period: number) => void
}

export const createSettingsSlice = (
  set: (fn: (state: { settings: Settings }) => { settings: Settings }) => void,
): SettingsSlice => ({
  settings: {
    mapping_rules: [],
    lunch_after_period: DEFAULT_LUNCH_AFTER_PERIOD,
  },

  addMappingRule: (rule) => {
    set((state) => ({
      settings: {
        ...state.settings,
        mapping_rules: [...state.settings.mapping_rules, rule],
      },
    }))
  },

  removeMappingRule: (grade, fromSubject) => {
    set((state) => ({
      settings: {
        ...state.settings,
        mapping_rules: state.settings.mapping_rules.filter(
          (r) => !(r.grade === grade && r.from_subject === fromSubject),
        ),
      },
    }))
  },

  updateLunchPeriod: (period) => {
    set((state) => ({
      settings: { ...state.settings, lunch_after_period: period },
    }))
  },
})
