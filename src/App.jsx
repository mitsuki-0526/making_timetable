import React, { useState } from 'react';
import TimetableGrid from './components/TimetableGrid';
import ValidationPanel from './components/ValidationPanel';
import TeacherScheduleGrid from './components/TeacherScheduleGrid';
import SettingsModal from './components/SettingsModal';
import FileActions from './components/FileActions';
import AIAssistPanel from './components/AIAssistPanel';
import PdfExport from './components/PdfExport';

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);

  return (
    <div className="layout">
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>時間割作成ツール</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <FileActions />
          <PdfExport />
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
          <button className="btn-primary" onClick={() => setIsSettingsOpen(true)}>⚙️ マスタ設定</button>
        </div>
      </header>

      <main className="main-content">
        <TimetableGrid />
        <ValidationPanel />
        <TeacherScheduleGrid />
      </main>

      {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
      {isAIOpen && <AIAssistPanel onClose={() => setIsAIOpen(false)} />}
    </div>
  );
}

export default App;
