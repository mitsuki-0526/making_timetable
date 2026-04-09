/** 曜日 */
export type Day = '月' | '火' | '水' | '木' | '金'

/** セルの位置（曜日・時限・学年・クラス） */
export type CellPosition = {
  readonly day_of_week: Day
  readonly period: number
  readonly grade: number
  readonly class_name: string
}

/** セルキー（一意識別子） "grade|class_name|day_of_week|period" */
export type CellKey = string

/** セルキーを生成する */
export function toCellKey(pos: CellPosition): CellKey {
  return `${pos.grade}|${pos.class_name}|${pos.day_of_week}|${pos.period}`
}

/** セルキーからCellPositionを復元する */
export function fromCellKey(key: CellKey): CellPosition {
  const [grade, class_name, day_of_week, period] = key.split('|')
  return {
    grade: Number(grade),
    class_name,
    day_of_week: day_of_week as Day,
    period: Number(period),
  }
}

/** 時間割エントリ */
export type TimetableEntry = {
  readonly day_of_week: Day
  readonly period: number
  readonly grade: number
  readonly class_name: string
  readonly subject: string | null
  readonly teacher_id: string | null
  readonly alt_subject: string | null
  readonly alt_teacher_id: string | null
  readonly teacher_group_id: string | null
  readonly cell_group_id: string | null
  readonly is_locked: boolean
}

/** 合同コマグループ */
export type CellGroup = {
  readonly id: string
  readonly cell_keys: readonly CellKey[]
}
