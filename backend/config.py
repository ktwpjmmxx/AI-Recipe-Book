"""
config.py — 設定・環境変数の一元管理

環境変数一覧:
  DATABASE_URL      : DB接続文字列（デフォルト: SQLite）
  OPENAI_API_KEY    : OpenAI APIキー
  LLM_PROVIDER      : 使用するLLMプロバイダー（openai / anthropic / mock）
  UPLOAD_DIR        : 画像アップロード先ディレクトリ
  MAX_UPLOAD_MB     : アップロード上限（MB）
"""
from __future__ import annotations
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # DB
    database_url: str = "sqlite:///./recipes.db"

    # LLM
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    llm_provider: str = "mock"          # "openai" | "anthropic" | "mock"
    llm_model: str = "gpt-4o-mini"     # モデル名（プロバイダーごとに解釈）
    llm_timeout: int = 30              # LLM APIタイムアウト（秒）

    # Upload
    upload_dir: Path = Path("uploads")
    max_upload_mb: int = 10

    @property
    def upload_dir_str(self) -> str:
        return str(self.upload_dir)


settings = Settings()
settings.upload_dir.mkdir(exist_ok=True)
