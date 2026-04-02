// =====================================================
// Gemini API ユーティリティ
// APIキーはブラウザの localStorage に保存します。
// 通信先は Google の Gemini API のみです。
// =====================================================

export const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash-lite';
export const AVAILABLE_MODELS = [
  { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite (最速)', recommended: true },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (高性能)', recommended: false },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (標準)', recommended: false },
  { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash-8b (軽量・無料枠多)', recommended: false },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (最高性能・制限強)', recommended: false },
];
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// --- APIキー・モデルの保存・取得 ---
export const getStoredModel = () => localStorage.getItem('gemini_model') || DEFAULT_GEMINI_MODEL;
export const setStoredModel = (model) => {
  if (model) {
    localStorage.setItem('gemini_model', model);
  } else {
    localStorage.removeItem('gemini_model');
  }
};

export const getStoredApiKey = () => localStorage.getItem('gemini_api_key') || '';
export const setStoredApiKey = (key) => {
  if (key) {
    localStorage.setItem('gemini_api_key', key);
  } else {
    localStorage.removeItem('gemini_api_key');
  }
};

// --- Gemini API 呼び出し（非ストリーミング）---
export const callGemini = async (apiKey, prompt) => {
  if (!apiKey) throw new Error('APIキーが設定されていません。マスタ設定の「AI設定」タブで登録してください。');

  const model = getStoredModel();
  
  // APIキーがURL形式（GASプロキシなど）の場合は、そのURLを直接使用
  // そうでない場合は標準のGemini API URLを生成
  let url;
  if (apiKey.startsWith('http')) {
    url = apiKey;
    // URLにモデル情報を付与（プロキシ側での対応用）
    if (!url.includes('model=')) {
      url += (url.includes('?') ? '&' : '?') + `model=${model}`;
    }
  } else {
    url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 8192,
      },
    }),
  });

  if (!response.ok) {
    let errMsg = `APIエラー (HTTP ${response.status})`;
    try {
      const err = await response.json();
      errMsg = err.error?.message || errMsg;
    } catch { /* ignore */ }
    throw new Error(errMsg);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('AIから有効な応答が得られませんでした。');
  return text;
};

// --- 接続テスト ---
export const testApiKey = async (apiKey) => {
  const result = await callGemini(apiKey, '「接続テスト成功」とだけ返答してください。');
  return result;
};

// =====================================================
// プロンプトビルダー
// =====================================================

const DAYS = ['月', '火', '水', '木', '金'];

// 時間割レビュー用プロンプト
export const buildReviewPrompt = (teachers, structure, timetable, subject_constraints) => {
  // 全クラスのリスト
  const classes = [];
  structure.grades.forEach(g => {
    g.classes.forEach(c => classes.push({ grade: g.grade, class_name: c, isSpecial: false }));
    if (g.special_classes) {
      g.special_classes.forEach(c => classes.push({ grade: g.grade, class_name: c, isSpecial: true }));
    }
  });

  // 教員ごとの配置サマリ
  const teacherSummary = teachers.map(t => {
    const slots = timetable.filter(e => e.teacher_id === t.id || e.alt_teacher_id === t.id);
    const unavail = t.unavailable_times.map(u => `${u.day_of_week}曜${u.period}限`).join('・') || 'なし';
    return `・${t.name}（担当教科: ${t.subjects.join('・')} / 対象学年: ${t.target_grades.join('・')}年 / 週${slots.length}コマ / 配置不可: ${unavail}）`;
  }).join('\n');

  // クラスごとの時間割グリッド
  const classSummary = classes.map(cls => {
    const label = cls.isSpecial ? `${cls.grade}年${cls.class_name}（特支）` : `${cls.grade}年${cls.class_name}`;
    const entries = timetable.filter(e => e.grade === cls.grade && e.class_name === cls.class_name);
    const grid = DAYS.map(day => {
      const cells = Array.from({ length: 6 }, (_, i) => {
        const p = i + 1;
        const e = entries.find(e => e.day_of_week === day && e.period === p);
        if (!e) return `${p}:未設定`;
        const tName = teachers.find(t => t.id === e.teacher_id)?.name?.split('(')[0]?.trim() || '未定';
        const altPart = e.alt_subject ? `(B週:${e.alt_subject})` : '';
        return `${p}:${e.subject}${altPart}/${tName}`;
      });
      return `  ${day}: ${cells.join(' | ')}`;
    }).join('\n');
    return `【${label}】\n${grid}`;
  }).join('\n\n');

  // 連続日数制約
  const constraints = Object.entries(subject_constraints || {})
    .filter(([, c]) => c.max_consecutive_days != null)
    .map(([subj, c]) => `・${subj}: ${c.max_consecutive_days}日以上連続不可`)
    .join('\n') || 'なし';

  return `あなたは日本の中学校の時間割作成の専門家です。以下の時間割を分析し、問題点と改善提案を日本語で報告してください。

## 教員情報
${teacherSummary}

## クラス別時間割（教科/担当教員）
${classSummary}

## 教科の連続授業日数制約
${constraints}

## 分析してほしい観点
1. 教員の授業負担バランス（特定の先生への集中・連続コマなど）
2. 各クラスの教科配置バランス（午前・午後の偏り、週前半・後半の偏りなど）
3. 未設定のコマがある場合の指摘
4. 連続日数制約の違反がないか
5. その他気になる点と具体的な改善提案

返答は日本語で、箇条書きと見出しを使って読みやすく構造化してください。`;
};

// 自動時間割生成用プロンプト
export const buildGenerationPrompt = (teachers, structure, settings, subject_constraints) => {
  const classes = [];
  structure.grades.forEach(g => {
    g.classes.forEach(c => classes.push({ grade: g.grade, class_name: c }));
    if (g.special_classes) {
      g.special_classes.forEach(c => classes.push({ grade: g.grade, class_name: c }));
    }
  });

  const teacherInfo = teachers.map(t => ({
    id: t.id,
    name: t.name,
    subjects: t.subjects,
    target_grades: t.target_grades,
    unavailable_times: t.unavailable_times,
  }));

  const constraintInfo = Object.entries(subject_constraints || {})
    .filter(([, c]) => c.max_consecutive_days != null)
    .map(([subj, c]) => `・${subj}: 同一クラスで${c.max_consecutive_days}日以上連続配置禁止`)
    .join('\n') || 'なし';

  return `あなたは日本の中学校の時間割作成の専門家AIです。以下の制約をすべて満たす時間割の草案をJSON形式で生成してください。

## 学校構成（クラス一覧）
${JSON.stringify(classes, null, 2)}

## 規定授業時数（週当たり）
${JSON.stringify(structure.required_hours, null, 2)}

## 教員リスト
${JSON.stringify(teacherInfo, null, 2)}

## 特別支援学級の教科連動ルール
${JSON.stringify(settings.mappingRules, null, 2)}

## 教科の連続配置制約
${constraintInfo}

## 守るべきルール
- 各教員は同日・同時限に1クラスのみ担当できる
- unavailable_times に記載の日時には配置不可
- 各クラスの各教科は規定時数ぴったりになるよう配置すること
- 特別支援学級(特支)は全学年の教員が担当可能

## 出力形式（厳守）
説明文・マークダウン・コードブロック不要。JSONの配列のみを返すこと。
[
  {"day_of_week":"月","period":1,"grade":1,"class_name":"1組","subject":"国語","teacher_id":"T01","alt_subject":null,"alt_teacher_id":null},
  ...
]`;
};

// AIレスポンスからJSONを抽出してパース
export const parseGeneratedTimetable = (responseText) => {
  // マークダウンのコードブロックを除去
  const cleaned = responseText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // JSON配列を抽出
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('AIの応答にJSONが含まれていませんでした。再度お試しください。');

  const entries = JSON.parse(match[0]);
  if (!Array.isArray(entries)) throw new Error('JSONの形式が正しくありません。');

  // 最低限のバリデーション
  entries.forEach((e, i) => {
    if (!e.day_of_week || !e.period || e.grade == null || !e.class_name || !e.subject) {
      throw new Error(`${i + 1}番目のエントリに必須フィールドが不足しています。`);
    }
  });

  return entries;
};
