// =====================================================
// ローカルLLM ユーティリティ（デスクトップ版）
// AI呼び出しはすべて Python バックエンド (FastAPI) 経由。
// llama-cpp-python + Gemma 4 を使用（Ollama 不要）。
// =====================================================

export const PYTHON_API_BASE = 'http://127.0.0.1:8000';

export const DEFAULT_MODEL = 'gemma4';

export const AVAILABLE_MODELS = [
  { id: 'gemma4',     name: 'Gemma 4 (推奨)',       recommended: true  },
  { id: 'gemma3',     name: 'Gemma 3',               recommended: false },
  { id: 'gemma3:12b', name: 'Gemma 3 12B (高性能)',  recommended: false },
  { id: 'llama3.2',   name: 'Llama 3.2 (代替)',      recommended: false },
];

// --- モデル設定の保存・取得 ---
// デスクトップ版は Python 側でモデルを管理するが、
// UI の選択状態を localStorage に保持しておく。
export const getStoredModel    = () => localStorage.getItem('desktop_model') || DEFAULT_MODEL;
export const setStoredModel    = (m) => m ? localStorage.setItem('desktop_model', m) : localStorage.removeItem('desktop_model');

// web版との互換性のため getStoredOllamaUrl / setStoredOllamaUrl もエクスポート
export const getStoredOllamaUrl = () => PYTHON_API_BASE;
export const setStoredOllamaUrl = () => {};  // デスクトップ版では変更不要

// --- Python バックエンドへの AI チャット呼び出し ---
export const callLocalLLM = async (prompt) => {
  let response;
  try {
    response = await fetch(`${PYTHON_API_BASE}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, model: getStoredModel() }),
    });
  } catch {
    throw new Error(
      'Python バックエンドに接続できませんでした。\nアプリを再起動してください。'
    );
  }

  if (!response.ok) {
    let errMsg = `バックエンドエラー (HTTP ${response.status})`;
    try {
      const err = await response.json();
      errMsg = err.detail || err.message || errMsg;
    } catch { /* ignore */ }
    throw new Error(errMsg);
  }

  const data = await response.json();
  const text = data.text;
  if (!text) throw new Error('AIから有効な応答が得られませんでした。');
  return text;
};

// --- OR-Tools ソルバー呼び出し ---
export const runSolver = async (payload) => {
  let response;
  try {
    response = await fetch(`${PYTHON_API_BASE}/api/solver/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('Python バックエンドに接続できませんでした。\nアプリを再起動してください。');
  }

  if (!response.ok) {
    let errMsg = `ソルバーエラー (HTTP ${response.status})`;
    try {
      const err = await response.json();
      errMsg = err.detail || err.message || errMsg;
    } catch { /* ignore */ }
    throw new Error(errMsg);
  }

  const data = await response.json();
  return data; // { timetable, count, message }
};

// --- 接続テスト ---
export const testOllamaConnection = async () => {
  let response;
  try {
    response = await fetch(`${PYTHON_API_BASE}/api/health`);
  } catch {
    throw new Error('Python バックエンドに接続できませんでした。\nアプリを再起動してください。');
  }
  if (!response.ok) throw new Error(`バックエンドエラー (HTTP ${response.status})`);
  const data = await response.json();
  return `バックエンド v${data.version} に接続しました。`;
};

// --- モデルの利用可否確認 ---
export const checkModelAvailable = async () => {
  let response;
  try {
    response = await fetch(`${PYTHON_API_BASE}/api/ai/model-status`);
  } catch {
    throw new Error('Python バックエンドに接続できませんでした。');
  }
  if (!response.ok) throw new Error(`バックエンドエラー (HTTP ${response.status})`);
  const data = await response.json();
  if (!data.ready) {
    throw new Error(
      `モデルが準備できていません。\n` +
      (data.message || 'GGUFモデルファイルが配置されているか確認してください。')
    );
  }
  return `モデル「${data.model}」が利用可能です。`;
};
