import React, { useRef, useState } from 'react';
import { useTimetableStore } from '../store/useTimetableStore';

// File System Access API が使えるか判定
const supportsFileSystemAccess = typeof window !== 'undefined' && 'showOpenFilePicker' in window;

const FileActions = () => {
  const fileInputRef = useRef(null);
  const importState = useTimetableStore(state => state.importState);

  // 読み込んだファイルのハンドル（上書き保存用）
  const [fileHandle, setFileHandle] = useState(null);
  const [fileName, setFileName] = useState('');

  // 現在のストア状態をJSONに変換
  const buildJson = () => {
    const state = useTimetableStore.getState();
    return JSON.stringify({
      teachers: state.teachers,
      teacher_groups: state.teacher_groups || [],
      class_groups: state.class_groups || [],
      structure: state.structure,
      timetable: state.timetable,
      settings: state.settings,
      subject_constraints: state.subject_constraints,
      subject_pairings: state.subject_pairings || [],
      cell_groups: state.cell_groups || [],
      fixed_slots: state.fixed_slots || [],
      teacher_constraints: state.teacher_constraints || {},
      subject_placement: state.subject_placement || {},
      facilities: state.facilities || [],
      subject_facility: state.subject_facility || {},
      alt_week_pairs: state.alt_week_pairs || [],
    }, null, 2);
  };

  // ---- 新規保存（ダウンロード） ----
  const handleSaveAs = () => {
    const jsonString = buildJson();
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `時間割データ_${new Date().toLocaleDateString('ja-JP').replace(/\//g, '')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ---- 上書き保存 ----
  const handleOverwriteSave = async () => {
    if (!fileHandle) return;
    try {
      const writable = await fileHandle.createWritable();
      await writable.write(buildJson());
      await writable.close();
      alert(`「${fileName}」に上書き保存しました`);
    } catch (err) {
      if (err.name !== 'AbortError') {
        alert('上書き保存に失敗しました: ' + err.message);
      }
    }
  };

  // ---- 読込（File System Access API 対応ブラウザ） ----
  const handleLoadWithAPI = async () => {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
      });
      const file = await handle.getFile();
      const text = await file.text();
      const jsonData = JSON.parse(text);
      if (jsonData.teachers && jsonData.structure && jsonData.timetable && jsonData.settings) {
        importState(jsonData);
        setFileHandle(handle);
        setFileName(file.name);
        alert(`「${file.name}」を読み込みました`);
      } else {
        alert('エラー: ファイルの形式が正しくありません。');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        alert('読み込みに失敗しました: ' + err.message);
      }
    }
  };

  // ---- 読込（フォールバック：旧来のinput方式） ----
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonData = JSON.parse(event.target.result);
        if (jsonData.teachers && jsonData.structure && jsonData.timetable && jsonData.settings) {
          importState(jsonData);
          setFileHandle(null);
          setFileName(file.name);
          alert(`「${file.name}」を読み込みました（上書き保存は非対応ブラウザのため使えません）`);
        } else {
          alert('エラー: ファイルの形式が正しくありません。');
        }
      } catch {
        alert('エラー: ファイルのパースに失敗しました。');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const btnBase = {
    border: 'none', borderRadius: '4px', cursor: 'pointer',
    fontWeight: 'bold', fontSize: '0.9rem',
    display: 'flex', alignItems: 'center', gap: '4px',
    padding: '0.4rem 0.8rem',
  };

  return (
    <div className="file-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>

      {/* 上書き保存ボタン（ファイル読込後のみ有効） */}
      <button
        onClick={handleOverwriteSave}
        disabled={!fileHandle}
        title={fileHandle ? `「${fileName}」に上書き保存` : '先にファイルを読み込んでください'}
        style={{
          ...btnBase,
          background: fileHandle ? '#F59E0B' : '#D1D5DB',
          color: fileHandle ? 'white' : '#9CA3AF',
          cursor: fileHandle ? 'pointer' : 'not-allowed',
        }}
      >
        💾 上書保存
        {fileName && (
          <span style={{ fontSize: '0.75rem', fontWeight: 'normal', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            ({fileName})
          </span>
        )}
      </button>

      {/* 新規保存（名前を付けて保存） */}
      <button
        onClick={handleSaveAs}
        style={{ ...btnBase, background: '#10B981', color: 'white' }}
        title="新しいファイルとしてダウンロード保存"
      >
        📥 保存
      </button>

      {/* 読込 */}
      <button
        onClick={supportsFileSystemAccess ? handleLoadWithAPI : () => fileInputRef.current?.click()}
        style={{ ...btnBase, background: '#3B82F6', color: 'white' }}
        title="時間割データを読み込みます"
      >
        📂 読込
      </button>

      <input
        type="file" accept=".json" ref={fileInputRef}
        onChange={handleFileChange} style={{ display: 'none' }}
      />
    </div>
  );
};

export default FileActions;
