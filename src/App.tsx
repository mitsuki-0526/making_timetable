import { useState } from 'react'
import { Settings, ListChecks, Bot, Cpu } from 'lucide-react'
import { TimetableGrid } from './components/grid/TimetableGrid'
import { TeacherScheduleGrid } from './components/grid/TeacherScheduleGrid'
import { ValidationPanel } from './components/ValidationPanel'
import { SubjectHoursChart } from './components/SubjectHoursChart'
import { SettingsModal } from './components/settings/SettingsModal'
import { ConstraintsModal } from './components/constraints/ConstraintsModal'
import { FileActions } from './components/FileActions'
import { PdfExport } from './components/PdfExport'
import { AIAssistPanel } from './components/AIAssistPanel'
import { SolverPanel } from './components/solver/SolverPanel'

type ViewTab = 'class' | 'teacher'

export default function App() {
  const [viewTab, setViewTab] = useState<ViewTab>('class')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [constraintsOpen, setConstraintsOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [solverOpen, setSolverOpen] = useState(false)

  return (
    <div>
      <header className="app-header">
        <h1>時間割作成ツール v2.0</h1>
        <div className="header-actions">
          <button className="header-btn" onClick={() => setSettingsOpen(true)}><Settings size={14} /> <span>設定</span></button>
          <button className="header-btn" onClick={() => setConstraintsOpen(true)}><ListChecks size={14} /> <span>制約</span></button>
          <FileActions />
          <PdfExport />
          <button className="header-btn" onClick={() => setSolverOpen(true)}><Cpu size={14} /> <span>ソルバー</span></button>
          <button className="header-btn" onClick={() => setAiOpen(true)}><Bot size={14} /> <span>AI</span></button>
        </div>
      </header>

      <div className="view-tabs">
        <button
          className={`view-tab ${viewTab === 'class' ? 'active' : ''}`}
          onClick={() => setViewTab('class')}
        >
          クラス別
        </button>
        <button
          className={`view-tab ${viewTab === 'teacher' ? 'active' : ''}`}
          onClick={() => setViewTab('teacher')}
        >
          先生別
        </button>
      </div>

      <div className="main-layout">
        <div className="grid-container">
          {viewTab === 'class' ? <TimetableGrid /> : <TeacherScheduleGrid />}
        </div>
        <div className="side-panel">
          <SubjectHoursChart />
          <ValidationPanel />
        </div>
      </div>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ConstraintsModal isOpen={constraintsOpen} onClose={() => setConstraintsOpen(false)} />
      <SolverPanel isOpen={solverOpen} onClose={() => setSolverOpen(false)} />
      <AIAssistPanel isOpen={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  )
}
