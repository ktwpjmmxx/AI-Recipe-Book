"""
main.py — FastAPI アプリのエントリポイント（薄いラッパー）

このファイルの責務:
  - アプリのインスタンス化
  - ミドルウェアの登録
  - ルーターのマウント
  - スタティックファイルの配信
  - DB テーブルの自動作成

ビジネスロジック・DB操作・AI処理は一切書かない。
"""
from __future__ import annotations
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import engine
from models import Base
from config import settings
from routers import recipes, shopping_lists, ai, misc

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

# DB テーブルを自動作成（未作成のものだけ）
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="MyRecipeBook API",
    version="4.0.0",
    description="レシピ管理 + AI アシスタント REST API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=settings.upload_dir_str), name="uploads")

# ルーターをマウント
app.include_router(recipes.router)
app.include_router(shopping_lists.router)
app.include_router(ai.router)
app.include_router(misc.router)


@app.get("/health")
def health():
    """ヘルスチェック用エンドポイント"""
    return {"status": "ok", "llm_provider": settings.llm_provider}
