"""
main.py — FastAPI アプリのエントリポイント

v4.4 変更:
  - public ルーターを追加（認証不要の公開レシピ閲覧・フォーク）
  - recipes テーブルへの is_public / share_id / forked_from カラムのマイグレーションを追加
"""
from __future__ import annotations
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import engine
from models import Base
from config import settings
from routers import recipes, shopping_lists, ai, misc, public
from routers import auth as auth_router

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

app = FastAPI(
    title="MyRecipeBook API",
    version="4.9.0",
    description="レシピ管理 + AI アシスタント REST API（レシピ共有・フォーク対応）",
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logging.error(f"422 detail: {exc.errors()}")
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

Base.metadata.create_all(bind=engine)

# v4.9: 以前ここに手書きのSQLiteマイグレーション関数
# （_migrate_add_user_id / _migrate_add_profile_columns /
#   _migrate_add_sharing_columns / _migrate_add_ingredients_steps）が
# 4つ定義されていたが、コード内のどこからも呼び出されていない
# デッドコードだったため削除した（3-3のスキーマ整合性調査で判明）。
# 新規カラムの追加は Base.metadata.create_all()（新規インストール時）と
# Alembicマイグレーション（既存DBのアップグレード時）で完結しており、
# この4関数がなくても動作に影響しないことをテスト・手動検証済み。

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=str(settings.upload_dir)), name="uploads")

app.include_router(auth_router.router)
app.include_router(recipes.router)
app.include_router(shopping_lists.router)
app.include_router(ai.router)
app.include_router(misc.router)
app.include_router(public.router)   # ← 追加（認証不要の公開エンドポイント）


@app.get("/health")
def health():
    return {"status": "ok", "version": "4.9.0", "llm_provider": settings.llm_provider}
