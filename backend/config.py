"""
config.py — 環境変数の一元管理

v4.2 追加:
  - SECRET_KEY: JWT 署名用の秘密鍵（.env で必ず設定すること）
  - JWT_LIFETIME_SECONDS: トークンの有効期限（デフォルト30日）
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

    # ── DB ──────────────────────────────
    database_url: str = "sqlite:///./recipes.db"

    # ── ファイルアップロード ─────────────
    upload_dir_str:  str = "./uploads"
    max_upload_mb:   int = 10

    # ── 認証（v4.2 追加） ────────────────
    # 必ず .env に設定すること。
    # 生成例: python -c "import secrets; print(secrets.token_hex(32))"
    secret_key:             str = "CHANGE_THIS_IN_PRODUCTION"
    jwt_lifetime_seconds:   int = 60 * 60 * 24 * 30  # 30日

    class Config:
        env_file = ".env"

    @property
    def upload_dir(self) -> Path:
        p = Path(self.upload_dir_str)
        p.mkdir(exist_ok=True)
        return p


settings = Settings()
