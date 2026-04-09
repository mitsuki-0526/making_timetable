import { ModalShell } from '../common/ModalShell'
import { TabContainer } from '../common/TabContainer'
import { FixedSlotsTab } from './FixedSlotsTab'
import { TeacherConstraintsTab } from './TeacherConstraintsTab'
import { SubjectPlacementTab } from './SubjectPlacementTab'
import { FacilitiesTab } from './FacilitiesTab'
import { AltWeekTab } from './AltWeekTab'
import { SequencesTab } from './SequencesTab'

type Props = {
  isOpen: boolean
  onClose: () => void
}

export function ConstraintsModal({ isOpen, onClose }: Props) {
  const tabs = [
    { id: 'fixed', label: '固定コマ', content: <FixedSlotsTab /> },
    { id: 'teacher', label: '教員制約', content: <TeacherConstraintsTab /> },
    { id: 'subject', label: '教科配置', content: <SubjectPlacementTab /> },
    { id: 'facilities', label: '施設', content: <FacilitiesTab /> },
    { id: 'alt-week', label: '隔週ペア', content: <AltWeekTab /> },
    { id: 'sequences', label: '連続配置', content: <SequencesTab /> },
  ]

  return (
    <ModalShell title="制約条件設定" isOpen={isOpen} onClose={onClose} width="950px">
      <TabContainer tabs={tabs} />
    </ModalShell>
  )
}
