"""
models.py — SQLAlchemy ORM テーブル定義

v4.4 変更点（レシピ共有・フォーク機能）:
  - RecipeORM:
      is_public : 公開フラグ（True のレシピのみ /r/{share_id} でアクセス可能）
      share_id  : 公開URL用の短いランダムID（推測されにくい8文字の英数字）
      forked_from: フォーク元レシピのID（コピーであることを記録する。任意）
"""
from __future__ import annotations
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey,
    Integer, String, Text, JSON,
)
from sqlalchemy.orm import DeclarativeBase, relationship

JSON_TYPE = JSON


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


# ── ユーザー ──────────────────────────────────
class UserORM(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    display_name = Column(String, nullable=True)
    bio = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_now)

    recipes        = relationship("RecipeORM",       back_populates="owner", cascade="all, delete-orphan")
    shopping_lists = relationship("ShoppingListORM", back_populates="owner", cascade="all, delete-orphan")


# ── レシピ ────────────────────────────────────
class RecipeORM(Base):
    """
    レシピテーブル。

    v4.4 追加カラム:
      - is_public:   公開フラグ。True のレシピのみ share_id 経由で誰でも閲覧できる
      - share_id:    公開URL用の一意な短縮ID（例: "a1B2c3D4"）。
                     is_public=False でも値自体は保持し続けてよい
                     （再公開時に同じURLを使い続けられるようにするため）
      - forked_from: このレシピが他ユーザーのレシピをフォークしたものである場合、
                     元レシピの recipe_id を保持する（系譜の記録・将来の「フォーク数」表示用）
    """
    __tablename__ = "recipes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    title = Column(String,  nullable=False)
    category = Column(String,  default="その他")
    description = Column(Text,    default="")
    base_servings = Column(Float,   default=2.0)
    prep_time = Column(Integer, default=0)
    cook_time = Column(Integer, default=0)
    image_url = Column(String,  nullable=True)
    is_favorite = Column(Boolean, default=False)
    is_ai_generated = Column(Boolean, default=False)
    ingredients = Column(JSON_TYPE, default=list)
    steps = Column(JSON_TYPE, default=list)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    # v4.4 追加
    is_public = Column(Boolean, default=False, index=True)
    share_id = Column(String, unique=True, nullable=True, index=True)
    forked_from = Column(Integer, ForeignKey("recipes.id", ondelete="SET NULL"), nullable=True)

    owner = relationship("UserORM", back_populates="recipes")


# ── 買い物リスト ──────────────────────────────
class ShoppingListORM(Base):
    __tablename__ = "shopping_lists"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="SET NULL"), nullable=True)
    recipe_title = Column(String, nullable=False)
    servings = Column(Float,  default=2.0)
    items = Column(JSON_TYPE, default=list)
    created_at = Column(DateTime, default=_now)

    owner = relationship("UserORM", back_populates="shopping_lists")
