import { ModalShell } from '../common/ModalShell'
import { TabContainer } from '../common/TabContainer'
import { SubjectsTab } from './SubjectsTab'
import { ClassesTab } from './ClassesTab'
import { TeachersTab } from './TeachersTab'
import { TeacherGroupsTab } from './TeacherGroupsTab'
import { ClassGroupsTab } from './ClassGroupsTab'
import { PairingsTab } from './PairingsTab'
import { CrossGradeTab } from './CrossGradeTab'

type Props = {
  isOpen: boolean
  onClose: () => void
}

export function SettingsModal({ isOpen, onClose }: Props) {
  const tabs = [
    { id: 'subjects', label: '教科設定', content: <SubjectsTab /> },
    { id: 'classes', label: 'クラス設定', content: <ClassesTab /> },
    { id: 'teachers', label: '教員設定', content: <TeachersTab /> },
    { id: 'teacher-groups', label: '教員グループ', content: <TeacherGroupsTab /> },
    { id: 'class-groups', label: '合同クラス', content: <ClassGroupsTab /> },
    { id: 'pairings', label: '抱き合わせ', content: <PairingsTab /> },
    { id: 'cross-grade', label: '複数学年合同', content: <CrossGradeTab /> },
  ]

  return (
    <ModalShell title="マスタ設定" isOpen={isOpen} onClose={onClose} width="950px">
      <TabContainer tabs={tabs} />
    </ModalShell>
  )
}
