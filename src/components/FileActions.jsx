import React, { useRef } from 'react';
import { useTimetableStore } from '../store/useTimetableStore';

const FileActions = () => {
  const fileInputRef = useRef(null);
  const importState = useTimetableStore(state => state.importState);
  
  // 保存ボタンの処理
  const handleSave = () => {
    // Zustandストアから必要なステートを取得
    const state = useTimetableStore.getState();
    
    // 不要な関数等を除いたデータのみを抽出
    const dataToSave = {
      teachers: state.teachers,
      structure: state.structure,
      timetable: state.timetable,
      settings: state.settings
    };

    // JSON文字列に変換
    const jsonString = JSON.stringify(dataToSave, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    // ダウンロード用リンクを作成して自動クリック
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `時間割データ_${new Date().toLocaleDateString('ja-JP').replace(/\//g, '')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 読込ボタンクリックで隠しinputを発火
  const triggerLoad = () => {
    fileInputRef.current?.click();
  };

  // ファイルが選択された時の処理
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonData = JSON.parse(event.target.result);
        
        // 簡易バリデーション
        if (jsonData.teachers && jsonData.structure && jsonData.timetable && jsonData.settings) {
          importState(jsonData);
          alert('時間割データを正常に読み込みました！');
        } else {
          alert('エラー: ファイルの形式が正しくありません。');
        }
      } catch (err) {
        alert('エラー: ファイルのパースに失敗しました。');
      }
      
      // input の value をリセットし、続けて同じファイルを選べるようにする
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="file-actions" style={{ display: 'flex', gap: '8px' }}>
      <button 
        onClick={handleSave} 
        style={{ 
          background: '#10B981', color: 'white', border: 'none', 
          padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer',
          fontWeight: 'bold', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px'
        }}
        title="現在の時間割データをパソコンに保存します"
      >
        💾 保存
      </button>

      <button 
        onClick={triggerLoad} 
        style={{ 
          background: '#3B82F6', color: 'white', border: 'none', 
          padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer',
          fontWeight: 'bold', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px'
        }}
        title="保存した時間割データを読み込みます"
      >
        📂 読込
      </button>
      
      <input 
        type="file" 
        accept=".json" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        style={{ display: 'none' }} 
      />
    </div>
  );
};

export default FileActions;
