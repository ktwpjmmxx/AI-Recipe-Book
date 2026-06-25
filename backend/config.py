"""
config.py — 環境変数の一元管理

v4.5 追加:
  - GEMINI_API_KEY / GEMINI_MODEL（Google Gemini 無料枠プロバイダー用）
"""
from __future__ import annotations
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── LLM ─────────────────────────────
    llm_provider:    str = "mock"
    llm_model:       str = "gpt-4o-mini"
    llm_timeout:     int = 30
    openai_api_key:  str = ""
    anthropic_api_key: str = ""

    # v4.5 追加: Gemini（無料枠・ポートフォリオ用途）
    gemini_api_key: str = ""
    gemini_model:   str = "gemini-2.0-flash"

    # ── DB ──────────────────────────────
    database_url: str = "sqlite:///./recipes.db"

    # ── ファイルアップロード ─────────────
    upload_dir_str:  str = "./uploads"
    max_upload_mb:   int = 10

    # ── 認証 ────────────────────────────
    secret_key:             str = "CHANGE_THIS_IN_PRODUCTION"
    jwt_lifetime_seconds:   int = 60 * 60 * 24 * 30

    class Config:
        env_file = ".env"

    @property
    def upload_dir(self) -> Path:
        p = Path(self.upload_dir_str)
        p.mkdir(exist_ok=True)
        return p


settings = Settings()
