import { Printer } from 'lucide-react'
import { useTimetableStore } from '@/store/useTimetableStore'
import { DAYS, PERIODS } from '@/constants/school'

/**
 * PDF出力コンポーネント
 * 新規ウィンドウに印刷用HTMLを生成 → window.print()
 */
export function PdfExport() {
  const structure = useTimetableStore((s) => s.structure)
  const timetable = useTimetableStore((s) => s.timetable)
  const teachers = useTimetableStore((s) => s.teachers)

  const getTeacherName = (id: string | null) =>
    id ? teachers.find((t) => t.id === id)?.name ?? '' : ''

  const getEntry = (grade: number, className: string, day: string, period: number) =>
    timetable.find(
      (e) => e.grade === grade && e.class_name === className && e.day_of_week === day && e.period === period,
    )

  const handlePrint = () => {
    const win = window.open('', '_blank')
    if (!win) {
      alert('ポップアップがブロックされました。ブラウザの設定を確認してください。')
      return
    }

    let html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>時間割表</title>
<style>
  body { font-family: 'Segoe UI', sans-serif; font-size: 10px; margin: 8px; }
  h2 { font-size: 14px; margin: 8px 0 4px; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 16px; page-break-inside: avoid; }
  th, td { border: 1px solid #999; padding: 2px 4px; text-align: center; min-width: 55px; height: 24px; }
  th { background: #f0f0f0; font-weight: 600; }
  .subject { font-weight: 500; }
  .teacher { font-size: 8px; color: #666; }
  .alt { color: #8b5cf6; font-size: 8px; }
  .no-teacher { color: #dc2626; }
  @media print { body { margin: 0; } @page { size: A4 landscape; margin: 10mm; } }
</style></head><body>`

    // クラス別時間割
    for (const gradeConfig of structure.grades) {
      html += `<h2>${gradeConfig.grade}年 時間割表</h2>`
      html += '<table><thead><tr><th></th>'
      for (const day of DAYS) {
        for (const p of PERIODS) {
          html += `<th>${day}${p}</th>`
        }
      }
      html += '</tr></thead><tbody>'

      for (const cls of gradeConfig.classes) {
        html += `<tr><th>${cls.name}${cls.is_special_needs ? '(特支)' : ''}</th>`
        for (const day of DAYS) {
          for (const p of PERIODS) {
            const entry = getEntry(gradeConfig.grade, cls.name, day, p)
            if (entry?.subject) {
              const teacherStr = getTeacherName(entry.teacher_id)
              const noTeacher = !entry.teacher_id ? ' no-teacher' : ''
              html += `<td><div class="subject${noTeacher}">${entry.subject}</div>`
              if (teacherStr) html += `<div class="teacher">${teacherStr}</div>`
              if (entry.alt_subject) {
                html += `<div class="alt">[B] ${entry.alt_subject}`
                const altTeacher = getTeacherName(entry.alt_teacher_id)
                if (altTeacher) html += ` (${altTeacher})`
                html += '</div>'
              }
              html += '</td>'
            } else {
              html += '<td></td>'
            }
          }
        }
        html += '</tr>'
      }
      html += '</tbody></table>'
    }

    // 先生別コマ数表
    html += '<h2>先生別 週コマ数</h2><table><thead><tr><th>教員名</th><th>週計</th>'
    for (const day of DAYS) {
      for (const p of PERIODS) {
        html += `<th>${day}${p}</th>`
      }
    }
    html += '</tr></thead><tbody>'

    for (const teacher of teachers) {
      const assigned = timetable.filter(
        (e) => e.teacher_id === teacher.id || e.alt_teacher_id === teacher.id,
      )
      // 週コマ数（合同グループは1カウント）
      const uniqueSlots = new Set(assigned.map((e) => `${e.day_of_week}|${e.period}|${e.cell_group_id ?? e.grade + e.class_name}`))
      html += `<tr><th>${teacher.name}</th><td><strong>${uniqueSlots.size}</strong></td>`
      for (const day of DAYS) {
        for (const p of PERIODS) {
          const entries = assigned.filter((e) => e.day_of_week === day && e.period === p)
          if (entries.length > 0) {
            const labels = entries.map((e) => `${e.grade}-${e.class_name}`).join(', ')
            html += `<td style="font-size:8px">${labels}</td>`
          } else {
            html += '<td></td>'
          }
        }
      }
      html += '</tr>'
    }
    html += '</tbody></table>'

    html += '<script>window.onload = function() { window.print(); }</script></body></html>'
    win.document.write(html)
    win.document.close()
  }

  return (
    <button className="header-btn" onClick={handlePrint}>
      <Printer size={14} /> PDF
    </button>
  )
}
