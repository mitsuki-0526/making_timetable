"""
時間割作成ツール - デスクトップ版 バックエンドサーバー
FastAPI + uvicorn で 127.0.0.1:8000 にて起動します。
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Any
import uvicorn

import ai_engine
import solver as timetable_solver

app = FastAPI(title="時間割作成ツール API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "app://.",                # Electron production
        "file://",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# ヘルスチェック
# --------------------------------------------------
@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.2.0"}


# --------------------------------------------------
# AI: モデル状態確認
# --------------------------------------------------
@app.get("/api/ai/model-status")
def model_status():
    return ai_engine.get_model_status()


# --------------------------------------------------
# AI: チャット（Gemma 4 GGUF）
# --------------------------------------------------
class ChatRequest(BaseModel):
    prompt: str
    model: Optional[str] = "gemma4"

@app.post("/api/ai/chat")
def ai_chat(req: ChatRequest):
    """
    プロンプトを受け取り、ローカルLLM（Gemma 4）の応答テキストを返す。
    モデル未配置の場合は 503 を返す。
    """
    status = ai_engine.get_model_status()
    if not status["ready"]:
        raise HTTPException(
            status_code=503,
            detail=status["message"],
        )
    try:
        text = ai_engine.chat(req.prompt)
        return {"text": text}
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI推論エラー: {e}")


# --------------------------------------------------
# AI: 制約テキスト → JSON 変換（フェーズ1）
# --------------------------------------------------
class ConstraintRequest(BaseModel):
    text: str

@app.post("/api/ai/parse-constraints")
def parse_constraints(req: ConstraintRequest):
    """
    自然言語の制約テキストをソルバー用 JSON に変換する。
    """
    status = ai_engine.get_model_status()
    if not status["ready"]:
        raise HTTPException(status_code=503, detail=status["message"])

    # AI に制約解析を依頼するプロンプト
    prompt = f"""あなたは時間割作成システムのアシスタントです。
以下の要望を、時間割ソルバーが扱える制約 JSON に変換してください。

使用できる制約タイプ:
- avoid_consecutive: 特定教科の連続配置を避ける
  例: {{"type": "avoid_consecutive", "subject": "体育", "max_days": 2}}
- avoid_slot: 特定の曜日・時限を避ける
  例: {{"type": "avoid_slot", "teacher_id": "T01", "day": "月", "period": 1}}
- prefer_slot: 特定の曜日・時限を優先する
  例: {{"type": "prefer_slot", "subject": "体育", "day": "水"}}

要望:
{req.text}

JSON のみ返してください（説明文不要）:
{{"constraints": [...]}}"""

    try:
        raw = ai_engine.chat(prompt)
        # JSON 部分を抽出
        import json, re
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            parsed = json.loads(match.group())
            return parsed
        return {"constraints": [], "raw": raw}
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        return {"constraints": [], "error": str(e), "raw": ""}


# --------------------------------------------------
# ソルバー: 時間割自動生成（フェーズ2）
# --------------------------------------------------
class SolverRequest(BaseModel):
    teachers: list[dict[str, Any]]
    structure: dict[str, Any]
    subject_constraints: dict[str, Any]
    settings: Optional[dict[str, Any]] = None
    time_limit: Optional[int] = 60
    # 条件設定モーダルから渡される新フィールド
    fixed_slots: Optional[list[dict[str, Any]]] = None
    teacher_constraints: Optional[dict[str, Any]] = None
    subject_placement: Optional[dict[str, Any]] = None
    facilities: Optional[list[dict[str, Any]]] = None
    subject_facility: Optional[dict[str, Any]] = None
    alt_week_pairs: Optional[list[dict[str, Any]]] = None
    cross_grade_groups: Optional[list[dict[str, Any]]] = None
    # v0.5 以降の新フィールド
    teacher_groups: Optional[list[dict[str, Any]]] = None       # 教員グループ（subjects/target_grades付き）
    class_groups: Optional[list[dict[str, Any]]] = None         # 合同クラス
    subject_sequences: Optional[list[dict[str, Any]]] = None    # 連続配置ペア
    existing_timetable: Optional[list[dict[str, Any]]] = None   # 既存コマ（空きコマ埋めモード）

@app.post("/api/solver/run")
def run_solver(req: SolverRequest):
    """
    学校マスタデータを受け取り、OR-Tools CP-SAT で最適化された時間割を返す。
    フロントエンドは受け取った timetable を setGeneratedTimetable() で適用する。
    """
    if not req.teachers:
        raise HTTPException(status_code=400, detail="教員データがありません。")
    if not req.structure.get("grades"):
        raise HTTPException(status_code=400, detail="クラス構造データがありません。")

    # settings から lunch_after_period を取得（デフォルト4）
    lunch_after_period = (req.settings or {}).get("lunch_after_period", 4)

    timetable, error = timetable_solver.run(
        teachers=req.teachers,
        structure=req.structure,
        subject_constraints=req.subject_constraints or {},
        fixed_slots=req.fixed_slots or [],
        teacher_constraints=req.teacher_constraints or {},
        subject_placement=req.subject_placement or {},
        lunch_after_period=lunch_after_period,
        facilities=req.facilities or [],
        subject_facility=req.subject_facility or {},
        alt_week_pairs=req.alt_week_pairs or [],
        cross_grade_groups=req.cross_grade_groups or [],
        class_groups=req.class_groups or [],
        subject_sequences=req.subject_sequences or [],
        teacher_groups=req.teacher_groups or [],
        existing_timetable=req.existing_timetable or [],
        time_limit=req.time_limit or 60,
    )

    if error:
        raise HTTPException(status_code=400, detail=error)

    return {
        "timetable": timetable,
        "count": len(timetable),
        "message": f"{len(timetable)} コマの時間割を生成しました。",
    }


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
