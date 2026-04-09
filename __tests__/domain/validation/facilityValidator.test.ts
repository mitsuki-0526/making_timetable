import { describe, it, expect } from 'vitest'
import { validateFacilityConflict } from '@/domain/validation/facilityValidator'
import { createEntry, createFacility } from '../../helpers/fixtures'
import type { SubjectFacility } from '@/types'

describe('validateFacilityConflict', () => {
  it('同日同時限に施設の同時使用上限を超えた場合に違反', () => {
    const facilities = [createFacility({ id: 'f1', name: '体育館', capacity: 1 })]
    const subjectFacilities: SubjectFacility[] = [{ subject: '体育', facility_id: 'f1' }]
    const timetable = [
      createEntry({ day_of_week: '月', period: 3, grade: 1, class_name: '1組', subject: '体育' }),
      createEntry({ day_of_week: '月', period: 3, grade: 1, class_name: '2組', subject: '体育' }),
    ]
    const result = validateFacilityConflict({ timetable, facilities, subjectFacilities })
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('error')
  })

  it('capacity内なら違反なし', () => {
    const facilities = [createFacility({ id: 'f1', name: '体育館', capacity: 2 })]
    const subjectFacilities: SubjectFacility[] = [{ subject: '体育', facility_id: 'f1' }]
    const timetable = [
      createEntry({ day_of_week: '月', period: 3, grade: 1, class_name: '1組', subject: '体育' }),
      createEntry({ day_of_week: '月', period: 3, grade: 1, class_name: '2組', subject: '体育' }),
    ]
    const result = validateFacilityConflict({ timetable, facilities, subjectFacilities })
    expect(result).toHaveLength(0)
  })

  it('施設マッピングがない教科は対象外', () => {
    const facilities = [createFacility({ id: 'f1', name: '体育館', capacity: 1 })]
    const subjectFacilities: SubjectFacility[] = [{ subject: '体育', facility_id: 'f1' }]
    const timetable = [
      createEntry({ day_of_week: '月', period: 3, grade: 1, class_name: '1組', subject: '数学' }),
      createEntry({ day_of_week: '月', period: 3, grade: 1, class_name: '2組', subject: '数学' }),
    ]
    const result = validateFacilityConflict({ timetable, facilities, subjectFacilities })
    expect(result).toHaveLength(0)
  })
})
