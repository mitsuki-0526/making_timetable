import React, { useRef, useState } from 'react';
import { useTimetableStore } from '../store/useTimetableStore';

const DAYS    = ['月', '火', '水', '木', '金'];
const PERIODS = [1, 2, 3, 4, 5, 6];

// File System Access API が使えるか判定
const supportsFileSystemAccess = typeof window !== 'undefined' && 'showOpenFilePicker' in window;

const FileActions = () => {
  const fileInputRef = useRef(null);
  const importState = useTimetableStore(state => state.importState);

  // ---- Excel エクスポート（2シート） ----
  const handleExportCSV = async () => {
    // xlsx を動的インポート（初回クリック時のみ読み込み、バンドルサイズを抑制）
    const XLSX = (await import('xlsx')).default ?? (await import('xlsx'));
    const { timetable, teachers, teacher_groups, structure } = useTimetableStore.getState();
    const dateStr = new Date().toLocaleDateString('ja-JP').replace(/\//g, '');

    // timetable を Map に変換
    const ttMap = new Map();
    for (const e of timetable) {
      ttMap.set(`${e.grade}|${e.class_name}|${e.day_of_week}|${e.period}`, e);
    }

    // クラス一覧（学年順）
    const classes = [];
    for (const g of structure.grades || []) {
      for (const cn of g.classes         || []) classes.push({ grade: g.grade, class_name: cn });
      for (const cn of g.special_classes || []) classes.push({ grade: g.grade, class_name: cn });
    }

    // ── シート①: 時間割（教科名のみ） ────────────────────────────────
    const ttData = []; // 行の配列（各行はセル値の配列）

    for (const cls of classes) {
      ttData.push([`${cls.grade}年${cls.class_name}`]); // クラス見出し
      ttData.push(['', ...DAYS]);                        // 曜日ヘッダー

      for (const period of PERIODS) {
        const row = [`${period}時限`];
        for (const day of DAYS) {
          const entry = ttMap.get(`${cls.grade}|${cls.class_name}|${day}|${period}`);
          if (!entry?.subject) {
            row.push('');
          } else if (entry.alt_subject) {
            row.push(`A:${entry.subject} / B:${entry.alt_subject}`);
          } else {
            row.push(entry.subject);
          }
        }
        ttData.push(row);
      }
      ttData.push([]); // クラス間の空行
    }

    // ── シート②: 先生ごとのコマ数 ────────────────────────────────────
    const slotHeaders = DAYS.flatMap(day => PERIODS.map(p => `${day}${p}`));
    const teacherData = [['先生名', '担当教科', '週計', ...slotHeaders]];

    for (const teacher of teachers) {
      const tName    = teacher.name.split('(')[0].trim();
      const subjects = teacher.subjects.join('・');
      let weekTotal  = 0;
      const cells    = [];

      for (const day of DAYS) {
        for (const period of PERIODS) {
          const entry = timetable.find(e => {
            if (e.day_of_week !== day || e.period !== period) return false;
            if (e.teacher_id === teacher.id || e.alt_teacher_id === teacher.id) return true;
            if (e.teacher_group_id) {
              const grp = (teacher_groups || []).find(g => g.id === e.teacher_group_id);
              if (grp?.teacher_ids?.includes(teacher.id)) return true;
            }
            return false;
          });

          if (!entry) {
            cells.push('');
          } else {
            const isSpecial  = entry.class_name.includes('特支');
            const classLabel = isSpecial
              ? `${entry.grade}年${entry.class_name}`
              : `${entry.grade}-${entry.class_name}`;
            const isAlt = entry.alt_teacher_id === teacher.id;
            const subj  = isAlt ? (entry.alt_subject || '') : (entry.subject || '');
            cells.push(`${classLabel} ${subj}`);
            weekTotal++;
          }
        }
      }
      teacherData.push([tName, subjects, weekTotal, ...cells]);
    }

    // ── ワークブック生成・ダウンロード ────────────────────────────────
    const wb  = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ttData),      '時間割');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(teacherData), '先生コマ数');
    XLSX.writeFile(wb, `時間割_${dateStr}.xlsx`);
  };

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
      cross_grade_groups: state.cross_grade_groups || [],
      subject_sequences: state.subject_sequences || [],
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
    <div className="file-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>

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
        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>save</span> 上書保存
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
        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>download</span> 保存
      </button>

      {/* 読込 */}
      <button
        onClick={supportsFileSystemAccess ? handleLoadWithAPI : () => fileInputRef.current?.click()}
        style={{ ...btnBase, background: '#3B82F6', color: 'white' }}
        title="時間割データを読み込みます"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>folder_open</span> 読込
      </button>

      {/* Excel エクスポート */}
      <button
        onClick={handleExportCSV}
        style={{ ...btnBase, background: '#8B5CF6', color: 'white' }}
        title="時間割・先生コマ数を Excel ファイル（2シート）としてエクスポート"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>table_view</span> Excel出力
      </button>

      <input
        type="file" accept=".json" ref={fileInputRef}
        onChange={handleFileChange} style={{ display: 'none' }}
      />
    </div>
  );
};

export default FileActions;
