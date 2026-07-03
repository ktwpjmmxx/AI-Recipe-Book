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
    version="4.4.0",
    description="レシピ管理 + AI アシスタント REST API（レシピ共有・フォーク対応）",
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logging.error(f"422 detail: {exc.errors()}")
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

Base.metadata.create_all(bind=engine)


def _migrate_add_user_id():
    import sqlite3, re
    db_path = re.sub(r"sqlite:///", "", settings.database_url)
    try:
        con = sqlite3.connect(db_path)
        cur = con.cursor()
        for table in ("recipes", "shopping_lists"):
            try:
                cur.execute(f"ALTER TABLE {table} ADD COLUMN user_id INTEGER REFERENCES users(id)")
                logging.info(f"Migration: {table}.user_id added")
            except sqlite3.OperationalError:
                pass
        con.commit()
        con.close()
    except Exception as e:
        logging.warning(f"Migration skipped: {e}")


def _migrate_add_profile_columns():
    import sqlite3, re
    db_path = re.sub(r"sqlite:///", "", settings.database_url)
    try:
        con = sqlite3.connect(db_path)
        cur = con.cursor()
        for column_def in ("bio VARCHAR", "avatar_url VARCHAR"):
            col_name = column_def.split()[0]
            try:
                cur.execute(f"ALTER TABLE users ADD COLUMN {column_def}")
                logging.info(f"Migration: users.{col_name} added")
            except sqlite3.OperationalError:
                pass
        con.commit()
        con.close()
    except Exception as e:
        logging.warning(f"Migration skipped: {e}")


def _migrate_add_sharing_columns():
    """
    既存の recipes テーブルに共有機能用のカラムを追加する（v4.4）。
      - is_public:   BOOLEAN DEFAULT 0
      - share_id:    VARCHAR（UNIQUE制約はSQLiteのALTER TABLEでは直接付与できないため、
                      アプリケーション側（generate_share_id の重複チェック）で一意性を保証する）
      - forked_from: INTEGER
    """
    import sqlite3, re
    db_path = re.sub(r"sqlite:///", "", settings.database_url)
    try:
        con = sqlite3.connect(db_path)
        cur = con.cursor()
        for column_def in (
            "is_public BOOLEAN DEFAULT 0",
            "share_id VARCHAR",
            "forked_from INTEGER",
        ):
            col_name = column_def.split()[0]
            try:
                cur.execute(f"ALTER TABLE recipes ADD COLUMN {column_def}")
                logging.info(f"Migration: recipes.{col_name} added")
            except sqlite3.OperationalError:
                pass
        con.commit()
        con.close()
    except Exception as e:
        logging.warning(f"Migration skipped: {e}")


def _migrate_add_ingredients_steps():
    import sqlite3, re
    db_path = re.sub(r"sqlite:///", "", settings.database_url)
    try:
        con = sqlite3.connect(db_path)
        cur = con.cursor()
        for column_def in (
            "ingredients JSON DEFAULT '[]'",
            "steps       JSON DEFAULT '[]'",
        ):
            col_name = column_def.split()[0]
            try:
                cur.execute(f"ALTER TABLE recipes ADD COLUMN {column_def}")
                logging.info(f"Migration: recipes.{col_name} added")
            except sqlite3.OperationalError:
                pass  # すでに存在する場合はスキップ
        con.commit()
        con.close()
    except Exception as e:
        logging.warning(f"Migration skipped: {e}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=settings.upload_dir_str), name="uploads")

app.include_router(auth_router.router)
app.include_router(recipes.router)
app.include_router(shopping_lists.router)
app.include_router(ai.router)
app.include_router(misc.router)
app.include_router(public.router)   # ← 追加（認証不要の公開エンドポイント）


@app.get("/health")
def health():
    return {"status": "ok", "version": "4.4.0", "llm_provider": settings.llm_provider}
