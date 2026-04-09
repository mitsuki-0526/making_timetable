import type { TimetableEntry, Facility, SubjectFacility } from '@/types'

export type FacilityViolation = {
  readonly type: 'facility_conflict'
  readonly severity: 'error'
  readonly facilityName: string
  readonly message: string
}

export type ValidateFacilityConflictInput = {
  readonly timetable: readonly TimetableEntry[]
  readonly facilities: readonly Facility[]
  readonly subjectFacilities: readonly SubjectFacility[]
}

/**
 * 同日同時限に施設の同時使用上限を超えた場合に違反を返す
 */
export function validateFacilityConflict(input: ValidateFacilityConflictInput): FacilityViolation[] {
  const { timetable, facilities, subjectFacilities } = input
  const violations: FacilityViolation[] = []

  // 教科→施設IDマップ
  const subjectToFacility = new Map(subjectFacilities.map((sf) => [sf.subject, sf.facility_id]))
  const facilityMap = new Map(facilities.map((f) => [f.id, f]))

  // day+period+facilityId でグルーピング
  const slotMap = new Map<string, number>()
  for (const entry of timetable) {
    if (!entry.subject) continue
    const facilityId = subjectToFacility.get(entry.subject)
    if (!facilityId) continue

    const key = `${entry.day_of_week}|${entry.period}|${facilityId}`
    slotMap.set(key, (slotMap.get(key) ?? 0) + 1)
  }

  for (const [key, count] of slotMap) {
    const [day, period, facilityId] = key.split('|')
    const facility = facilityMap.get(facilityId)
    if (!facility) continue

    if (count > facility.capacity) {
      violations.push({
        type: 'facility_conflict',
        severity: 'error',
        facilityName: facility.name,
        message: `${facility.name}: ${day}${period}限に${count}クラス使用（上限${facility.capacity}）`,
      })
    }
  }

  return violations
}
