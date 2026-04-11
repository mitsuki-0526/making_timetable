import React, { useState } from 'react';
import TimetableGrid from './components/TimetableGrid';
import ValidationPanel from './components/ValidationPanel';
import TeacherScheduleGrid from './components/TeacherScheduleGrid';
import SettingsModal from './components/SettingsModal';
import ConstraintsModal from './components/ConstraintsModal';
import SubjectHoursChart from './components/SubjectHoursChart';
import FileActions from './components/FileActions';
import AIAssistPanel from './components/AIAssistPanel';
import PdfExport from './components/PdfExport';

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isConstraintsOpen, setIsConstraintsOpen] = useState(false);
  const [isChartOpen, setIsChartOpen] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);

  return (
    <div className="layout">
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>時間割作成ツール</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <FileActions />
          <PdfExport />
          <button
            onClick={() => setIsChartOpen(true)}
            style={{
              padding: '0.5rem 1rem', border: 'none', borderRadius: '6px', cursor: 'pointer',
              background: 'linear-gradient(135deg, #0EA5E9, #0284C7)',
              color: '#fff', fontWeight: 600, fontSize: '0.9rem',
            }}
          >
            📊 コマ数確認
          </button>
          <button
            onClick={() => setIsAIOpen(true)}
            style={{
              padding: '0.5rem 1rem', border: 'none', borderRadius: '6px', cursor: 'pointer',
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              color: '#fff', fontWeight: 600, fontSize: '0.9rem',
            }}
          >
            🤖 AI支援
          </button>
          <button
            onClick={() => setIsConstraintsOpen(true)}
            style={{
              padding: '0.5rem 1rem', border: 'none', borderRadius: '6px', cursor: 'pointer',
              background: 'linear-gradient(135deg, #F59E0B, #D97706)',
              color: '#fff', fontWeight: 600, fontSize: '0.9rem',
            }}
          >
            📋 条件設定
          </button>
          <button className="btn-primary" onClick={() => setIsSettingsOpen(true)}>⚙️ マスタ設定</button>
        </div>
      </header>

      <main className="main-content">
        <TimetableGrid />
        <ValidationPanel />
        <TeacherScheduleGrid />
      </main>

      {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
      {isConstraintsOpen && <ConstraintsModal onClose={() => setIsConstraintsOpen(false)} />}
      {isChartOpen && <SubjectHoursChart onClose={() => setIsChartOpen(false)} />}
      {isAIOpen && <AIAssistPanel onClose={() => setIsAIOpen(false)} />}
    </div>
  );
}

export default App;
