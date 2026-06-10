"""
models.py — SQLAlchemy ORM モデル定義

ビジネスロジックや DB アクセスはここに書かない。
テーブル定義と関係のみを記述する。
"""
from __future__ import annotations
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, Float, Boolean
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


def _now() -> datetime:
    return datetime.now(timezone.utc)


class RecipeORM(Base):
    __tablename__ = "recipes"

    id              = Column(Integer, primary_key=True, index=True)
    title           = Column(String(255), nullable=False, index=True)
    category        = Column(String(100), nullable=False, index=True)
    description     = Column(Text, default="")
    base_servings   = Column(Float, default=2.0)
    prep_time       = Column(Integer, default=0)
    cook_time       = Column(Integer, default=0)
    image_url       = Column(String(512), nullable=True)
    is_favorite     = Column(Boolean, default=False)
    is_ai_generated = Column(Boolean, default=False)
    # ingredients: [{"name":"..","amount":float|null,"unit":"..","amount_text":".."|null}]
    ingredients     = Column(JSON, default=list)
    # steps: [{"order":int,"description":"..","tip":".."|null}]
    steps           = Column(JSON, default=list)
    created_at      = Column(DateTime(timezone=True), default=_now)
    updated_at      = Column(DateTime(timezone=True), default=_now, onupdate=_now)


class ShoppingListORM(Base):
    __tablename__ = "shopping_lists"

    id           = Column(Integer, primary_key=True, index=True)
    recipe_id    = Column(Integer, nullable=True)
    recipe_title = Column(String(255), nullable=False)
    servings     = Column(Float, default=2.0)
    # items: [{"name":"..", "needed":float|null, "unit":"..","is_text":bool,"text_val":".."|null,"checked":bool}]
    items        = Column(JSON, default=list)
    created_at   = Column(DateTime(timezone=True), default=_now)
