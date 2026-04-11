"""
AI エンジン — llama-cpp-python + Gemma 4 (GGUF) ラッパー
モデルは初回リクエスト時に遅延ロードします。
"""

from pathlib import Path
from typing import Optional

MODELS_DIR = Path(__file__).parent / "models"

_llm = None
_loaded_path: Optional[Path] = None


def find_gguf() -> Optional[Path]:
    """models/ 内の最初の .gguf ファイルを返す。なければ None。"""
    if not MODELS_DIR.is_dir():
        return None
    files = sorted(MODELS_DIR.glob("*.gguf"))
    return files[0] if files else None


def get_model_status() -> dict:
    path = find_gguf()
    if path:
        return {"ready": True, "model": path.name, "message": ""}
    return {
        "ready": False,
        "model": None,
        "message": (
            f"python/models/ に .gguf ファイルが見つかりません。\n"
            "Gemma 4 の GGUF ファイルをダウンロードして配置してください。\n"
            "例: https://huggingface.co/google/gemma-4-GGUF"
        ),
    }


def _load() -> "Llama":
    """モデルを遅延ロードして返す。"""
    global _llm, _loaded_path
    from llama_cpp import Llama  # type: ignore

    path = find_gguf()
    if path is None:
        raise RuntimeError(
            "GGUFモデルファイルが見つかりません。python/models/ に配置してください。"
        )

    # パスが変わった場合は再ロード
    if _llm is None or _loaded_path != path:
        _llm = Llama(
            model_path=str(path),
            n_ctx=4096,
            n_gpu_layers=-1,   # GPU がある場合は自動的に VRAM を使用
            verbose=False,
        )
        _loaded_path = path

    return _llm


def chat(prompt: str, max_tokens: int = 2048, temperature: float = 0.4) -> str:
    """
    プロンプトを渡してLLMの応答テキストを返す。
    モデル未配置の場合は RuntimeError を送出する。
    """
    llm = _load()
    output = llm.create_chat_completion(
        messages=[{"role": "user", "content": prompt}],
        max_tokens=max_tokens,
        temperature=temperature,
    )
    return output["choices"][0]["message"]["content"]
