import type { Day } from '@/types'

export const DAYS: readonly Day[] = ['月', '火', '水', '木', '金'] as const

export const PERIODS = [1, 2, 3, 4, 5, 6] as const

export const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'temporary', 'substitute'] as const

export const DEFAULT_LUNCH_AFTER_PERIOD = 4
