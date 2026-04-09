const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

export type GeminiModel = 'gemini-2.0-flash-lite' | 'gemini-2.0-flash' | 'gemini-1.5-flash'

export function getApiKey(): string | null {
  return localStorage.getItem('gemini_api_key')
}

export function setApiKey(key: string): void {
  localStorage.setItem('gemini_api_key', key)
}

export function getModel(): GeminiModel {
  return (localStorage.getItem('gemini_model') as GeminiModel) ?? 'gemini-2.0-flash-lite'
}

export function setModel(model: GeminiModel): void {
  localStorage.setItem('gemini_model', model)
}

export type GeminiResponse = {
  candidates?: { content: { parts: { text: string }[] } }[]
  error?: { message: string; code: number }
}

/**
 * Gemini APIにテキストプロンプトを送信する
 */
export async function callGemini(prompt: string): Promise<string> {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('APIキーが設定されていません。設定画面からGemini APIキーを入力してください。')

  const model = getModel()
  const url = `${API_BASE}/${model}:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
    }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const msg = body?.error?.message ?? `HTTP ${res.status}`
    if (res.status === 429) throw new Error(`APIリクエスト制限に達しました。しばらく待つか、別のモデルを試してください。(${msg})`)
    throw new Error(`Gemini API エラー: ${msg}`)
  }

  const data: GeminiResponse = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('AIからの応答が空でした')
  return text
}

/**
 * API接続テスト
 */
export async function testConnection(): Promise<boolean> {
  try {
    const response = await callGemini('こんにちは。接続テストです。「OK」とだけ返してください。')
    return response.length > 0
  } catch {
    return false
  }
}
