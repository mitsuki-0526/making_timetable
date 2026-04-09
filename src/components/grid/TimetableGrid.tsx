import { useState, useCallback } from 'react'
import { useTimetableStore } from '@/store/useTimetableStore'
import { CellDropdown } from '@/components/cell/CellDropdown'
import { DAYS, PERIODS } from '@/constants/school'
import type { CellPosition, Day } from '@/types'

const GROUP_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']

type ContextMenu = { x: number; y: number; cellKey: string | null }

export function TimetableGrid() {
  const structure = useTimetableStore((s) => s.structure)
  const timetable = useTimetableStore((s) => s.timetable)
  const teachers = useTimetableStore((s) => s.teachers)
  const groupCells = useTimetableStore((s) => s.groupCells)
  const ungroupCells = useTimetableStore((s) => s.ungroupCells)

  const [editingCell, setEditingCell] = useState<CellPosition | null>(null)
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)

  const getEntry = useCallback((grade: number, className: string, day: Day, period: number) => {
    return timetable.find(
      (e) => e.grade === grade && e.class_name === className &&
        e.day_of_week === day && e.period === period,
    )
  }, [timetable])

  const getTeacherName = useCallback((id: string | null) => {
    if (!id) return null
    return teachers.find((t) => t.id === id)?.name ?? null
  }, [teachers])

  const handleCellClick = useCallback((pos: CellPosition, ctrlKey: boolean) => {
    setContextMenu(null)
    if (ctrlKey) {
      const key = `${pos.grade}|${pos.class_name}|${pos.day_of_week}|${pos.period}`
      setSelectedCells((prev) => {
        const next = new Set(prev)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
      })
      return
    }
    setSelectedCells(new Set())
    setEditingCell(pos)
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent, cellKey: string) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, cellKey })
  }, [])

  const handleGroup = useCallback(() => {
    if (selectedCells.size < 2) return
    const groupId = crypto.randomUUID()
    groupCells([...selectedCells], groupId)
    setSelectedCells(new Set())
    setContextMenu(null)
  }, [selectedCells, groupCells])

  const handleUngroup = useCallback((groupId: string) => {
    ungroupCells(groupId)
    setContextMenu(null)
  }, [ungroupCells])

  const handleCloseDropdown = useCallback(() => {
    setEditingCell(null)
  }, [])

  // Esc で選択解除
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSelectedCells(new Set())
      setContextMenu(null)
    }
  }, [])

  // 右クリックメニュー外クリックで閉じる
  const handleGlobalClick = useCallback(() => {
    setContextMenu(null)
  }, [])

  if (structure.grades.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>
        <p>時間割データがありません</p>
        <p style={{ fontSize: 12, marginTop: 8 }}>
          ヘッダーの「設定」ボタンから学年・クラス・教員を登録してください
        </p>
      </div>
    )
  }

  return (
    <div onKeyDown={handleKeyDown} onClick={handleGlobalClick} tabIndex={-1} style={{ outline: 'none' }}>
      {selectedCells.size > 0 && (
        <div style={{
          padding: '6px 12px', backgroundColor: '#dbeafe', borderRadius: 4,
          marginBottom: 8, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>{selectedCells.size} セル選択中</span>
          <span style={{ color: '#6b7280' }}>右クリック → グループ化 / Esc で選択解除</span>
        </div>
      )}

      <div style={{ overflow: 'auto' }}>
        <table className="timetable-grid">
          <thead>
            <tr>
              <th className="row-header">クラス</th>
              {DAYS.map((day, di) =>
                PERIODS.map((period, pi) => (
                  <th
                    key={`${day}-${period}`}
                    className={pi === PERIODS.length - 1 && di < DAYS.length - 1 ? 'day-separator' : ''}
                  >
                    {period === 1 ? day : ''}{period}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {structure.grades.flatMap((gradeConfig) => {
              const normalClasses = gradeConfig.classes.filter((c) => !c.is_special_needs)
              const specialClasses = gradeConfig.classes.filter((c) => c.is_special_needs)
              return [...normalClasses, ...specialClasses].map((cls) => (
                <tr key={`${gradeConfig.grade}-${cls.name}`}>
                  <td className="row-header" style={{
                    backgroundColor: cls.is_special_needs ? '#fef9c3' : '#f9fafb',
                  }}>
                    {gradeConfig.grade}年{cls.name}
                  </td>
                  {DAYS.map((day, di) =>
                    PERIODS.map((period, pi) => {
                      const entry = getEntry(gradeConfig.grade, cls.name, day, period)
                      const pos: CellPosition = {
                        day_of_week: day, period,
                        grade: gradeConfig.grade, class_name: cls.name,
                      }
                      const cellKey = `${pos.grade}|${pos.class_name}|${pos.day_of_week}|${pos.period}`
                      const isSelected = selectedCells.has(cellKey)
                      const isEditing = editingCell &&
                        editingCell.grade === pos.grade &&
                        editingCell.class_name === pos.class_name &&
                        editingCell.day_of_week === pos.day_of_week &&
                        editingCell.period === pos.period

                      const groupColor = entry?.cell_group_id
                        ? GROUP_COLORS[
                            Math.abs(entry.cell_group_id.charCodeAt(0)) % GROUP_COLORS.length
                          ]
                        : undefined

                      const teacherName = getTeacherName(entry?.teacher_id ?? null)

                      return (
                        <td
                          key={cellKey}
                          className={pi === PERIODS.length - 1 && di < DAYS.length - 1 ? 'day-separator' : ''}
                          style={{ position: 'relative', padding: 0 }}
                          onContextMenu={(e) => handleContextMenu(e, cellKey)}
                        >
                          {groupColor && (
                            <div
                              className="cell-group-indicator"
                              style={{ backgroundColor: groupColor }}
                            />
                          )}
                          <button
                            className={[
                              'cell-btn',
                              entry?.subject ? 'has-subject' : '',
                              entry?.subject && !entry.teacher_id ? 'no-teacher' : '',
                              isSelected ? 'selected' : '',
                              entry?.is_locked ? 'locked' : '',
                            ].filter(Boolean).join(' ')}
                            onClick={(e) => handleCellClick(pos, e.ctrlKey || e.metaKey)}
                          >
                            {entry?.subject && (
                              <>
                                <div>{entry.subject}</div>
                                {teacherName && (
                                  <div style={{ fontSize: 10, color: '#6b7280' }}>
                                    {teacherName}
                                  </div>
                                )}
                                {entry.cell_group_id && (
                                  <div style={{ fontSize: 8, color: '#10b981' }}>合同</div>
                                )}
                                {entry.alt_subject && (
                                  <div style={{ fontSize: 9, color: '#8b5cf6' }}>
                                    [B]{entry.alt_subject}
                                  </div>
                                )}
                              </>
                            )}
                          </button>
                          {isEditing && (
                            <CellDropdown
                              position={pos}
                              entry={entry ?? null}
                              onClose={handleCloseDropdown}
                            />
                          )}
                        </td>
                      )
                    }),
                  )}
                </tr>
              ))
            })}
          </tbody>
        </table>
      </div>

      {/* 右クリックメニュー */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed', left: contextMenu.x, top: contextMenu.y,
            zIndex: 200, backgroundColor: '#fff', border: '1px solid #d1d5db',
            borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            padding: 4, minWidth: 160, fontSize: 12,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {selectedCells.size >= 2 && (
            <button
              onClick={handleGroup}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px',
                border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 4,
              }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.background = '#f3f4f6' }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'transparent' }}
            >
              {selectedCells.size} セルをグループ化
            </button>
          )}
          {contextMenu.cellKey && (() => {
            const entry = timetable.find((e) => {
              const key = `${e.grade}|${e.class_name}|${e.day_of_week}|${e.period}`
              return key === contextMenu.cellKey
            })
            if (entry?.cell_group_id) {
              return (
                <button
                  onClick={() => handleUngroup(entry.cell_group_id!)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px',
                    border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 4,
                  }}
                  onMouseEnter={(e) => { (e.target as HTMLElement).style.background = '#f3f4f6' }}
                  onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'transparent' }}
                >
                  グループ解除
                </button>
              )
            }
            return null
          })()}
          {selectedCells.size === 0 && !timetable.find((e) => `${e.grade}|${e.class_name}|${e.day_of_week}|${e.period}` === contextMenu.cellKey)?.cell_group_id && (
            <div style={{ padding: '6px 12px', color: '#9ca3af' }}>操作なし</div>
          )}
        </div>
      )}
    </div>
  )
}
