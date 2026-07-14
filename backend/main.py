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
from starlette.exceptions import HTTPException as StarletteHTTPException

from errors import build_error_body, code_for_status


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

_TAGS_METADATA = [
    {"name": "auth", "description": "ユーザー登録・ログイン・プロフィール管理。"},
    {"name": "recipes", "description": "レシピのCRUD、画像アップロード、公開設定、AI質問応答。"},
    {"name": "shopping-lists", "description": "レシピから生成する買い物リストの管理。"},
    {"name": "ai", "description": "AIレシピ提案・生成・RAGライブラリ横断質問応答。LLM呼び出し失敗時は常にモックへフォールバックし、is_mockで判別できる。"},
    {"name": "public", "description": "認証不要の公開レシピ閲覧・フォーク。"},
    {"name": "misc", "description": "カテゴリ一覧などの補助エンドポイント。"},
]

app = FastAPI(
    title="MyRecipeBook API",
    version="5.2.0",
    description=(
        "レシピ管理 + AI アシスタント REST API（レシピ共有・フォーク対応）\n\n"
        "エラーレスポンスは全エンドポイント共通で "
        "`{\"error\": {\"code\": \"...\", \"message\": \"...\"}}` 形式に統一されている。"
    ),
    openapi_tags=_TAGS_METADATA,
)


# ── フェーズ3: 統一エラーレスポンス形式 ──────────────────
# 既存の各router内の `raise HTTPException(status_code, "message")` は
# 一切変更せず、ここで {"error": {"code": ..., "message": ...}} 形式に変換する。

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content=build_error_body(
            code=code_for_status(exc.status_code),
            message=str(exc.detail),
        ),
        headers=getattr(exc, "headers", None),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"422 detail: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content=build_error_body(
            code="VALIDATION_ERROR",
            message="入力内容に誤りがあります。",
            details=exc.errors(),
        ),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled exception on {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content=build_error_body(
            code="INTERNAL_ERROR",
            message="サーバー内部でエラーが発生しました。",
        ),
    )

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
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://ai-recipe-book-wheat.vercel.app",
    ],
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
