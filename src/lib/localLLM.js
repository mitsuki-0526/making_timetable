// =====================================================
// ローカルLLM（Ollama / Gemma 4）ユーティリティ
// OllamaをローカルにインストールしてGemma 4を使用します。
// 設定はブラウザの localStorage に保存されます。
// 外部への通信は行いません（完全ローカル動作）。
// =====================================================

export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
export const DEFAULT_MODEL = 'gemma3';

export const AVAILABLE_MODELS = [
  { id: 'gemma3', name: 'Gemma 3 (推奨)', recommended: true },
  { id: 'gemma3:4b', name: 'Gemma 3 4B (軽量)', recommended: false },
  { id: 'gemma3:12b', name: 'Gemma 3 12B (高性能)', recommended: false },
  { id: 'gemma3:27b', name: 'Gemma 3 27B (最高性能)', recommended: false },
  { id: 'llama3.2', name: 'Llama 3.2 (代替)', recommended: false },
];

// --- エンドポイント・モデルの保存・取得 ---
export const getStoredOllamaUrl = () => localStorage.getItem('ollama_url') || DEFAULT_OLLAMA_URL;
export const setStoredOllamaUrl = (url) => {
  if (url) {
    localStorage.setItem('ollama_url', url);
  } else {
    localStorage.removeItem('ollama_url');
  }
};

export const getStoredModel = () => localStorage.getItem('ollama_model') || DEFAULT_MODEL;
export const setStoredModel = (model) => {
  if (model) {
    localStorage.setItem('ollama_model', model);
  } else {
    localStorage.removeItem('ollama_model');
  }
};

// --- Ollama API 呼び出し ---
export const callLocalLLM = async (prompt) => {
  const baseUrl = getStoredOllamaUrl().replace(/\/$/, '');
  const model = getStoredModel();
  const url = `${baseUrl}/api/chat`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        options: {
          temperature: 0.4,
          num_predict: 8192,
        },
      }),
    });
  } catch {
    throw new Error(
      `Ollamaに接続できませんでした（${baseUrl}）。\nOllamaが起動しているか確認してください。`
    );
  }

  if (!response.ok) {
    let errMsg = `Ollamaエラー (HTTP ${response.status})`;
    try {
      const err = await response.json();
      errMsg = err.error || errMsg;
    } catch { /* ignore */ }
    throw new Error(errMsg);
  }

  const data = await response.json();
  const text = data.message?.content;
  if (!text) throw new Error('ローカルLLMから有効な応答が得られませんでした。');
  return text;
};

// --- 接続テスト（Ollamaのバージョン確認） ---
export const testOllamaConnection = async () => {
  const baseUrl = getStoredOllamaUrl().replace(/\/$/, '');
  let response;
  try {
    response = await fetch(`${baseUrl}/api/version`);
  } catch {
    throw new Error(
      `Ollamaに接続できませんでした（${baseUrl}）。\nOllamaが起動しているか確認してください。`
    );
  }
  if (!response.ok) throw new Error(`Ollamaエラー (HTTP ${response.status})`);
  const data = await response.json();
  return `Ollama v${data.version} に接続しました。`;
};

// --- モデルの存在確認 ---
export const checkModelAvailable = async () => {
  const baseUrl = getStoredOllamaUrl().replace(/\/$/, '');
  const model = getStoredModel();
  let response;
  try {
    response = await fetch(`${baseUrl}/api/tags`);
  } catch {
    throw new Error('Ollamaに接続できませんでした。');
  }
  if (!response.ok) throw new Error(`Ollamaエラー (HTTP ${response.status})`);
  const data = await response.json();
  const models = data.models || [];
  const found = models.some(m => m.name === model || m.name.startsWith(model + ':'));
  if (!found) {
    const available = models.map(m => m.name).join(', ') || 'なし';
    throw new Error(
      `モデル「${model}」が見つかりません。\n` +
      `ollama pull ${model} を実行してダウンロードしてください。\n` +
      `（インストール済みモデル: ${available}）`
    );
  }
  return `モデル「${model}」が利用可能です。`;
};
