"""
database.py — SQLAlchemy エンジン・セッション管理

将来 PostgreSQL に切り替える場合は DATABASE_URL を変更するだけで
このファイル以外に手を加える必要がない。
"""
from __future__ import annotations
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from config import settings

# SQLite は check_same_thread=False が必要。PostgreSQL では不要（自動無視）
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Session:
    """FastAPI の Depends() で使用する DB セッションジェネレーター"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
