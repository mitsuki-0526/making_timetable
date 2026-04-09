/** クラス情報 */
export type ClassInfo = {
  readonly name: string
  readonly is_special_needs: boolean
}

/** 学年設定 */
export type GradeConfig = {
  readonly grade: number
  readonly classes: readonly ClassInfo[]
  readonly required_hours: Readonly<Record<string, number>>
}

/** 学校構造 */
export type SchoolStructure = {
  readonly grades: readonly GradeConfig[]
}
