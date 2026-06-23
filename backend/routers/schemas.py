"""
routers/schemas.py — リクエスト / レスポンス Pydantic スキーマ

v4.4.1 修正:
  - RecipeOut に is_public / share_id を追加
    （これが欠落していたため、再ログイン後にShareModalが
     「未公開」として初期化される不具合が発生していた。
     DBには正しく保存されていたが、APIレスポンスから
     除外されていたためフロントが状態を復元できなかった。）
"""
from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# ── 材料・手順 ─────────────────────────────────
class IngredientIn(BaseModel):
    name:        str
    amount:      Optional[float] = None
    unit:        str             = ""
    amount_text: Optional[str]  = None


class StepIn(BaseModel):
    order:       int
    description: str
    tip:         Optional[str] = None


# ── レシピ ─────────────────────────────────────
class RecipeCreate(BaseModel):
    title:           str   = Field(..., min_length=1)
    category:        str   = Field(..., min_length=1)
    description:     str   = ""
    base_servings:   float = Field(2.0, gt=0)
    prep_time:       int   = Field(0, ge=0)
    cook_time:       int   = Field(0, ge=0)
    is_ai_generated: bool  = False
    ingredients:     list[IngredientIn] = []
    steps:           list[StepIn]       = []


class RecipeUpdate(BaseModel):
    title:         Optional[str]   = None
    category:      Optional[str]   = None
    description:   Optional[str]   = None
    base_servings: Optional[float] = None
    prep_time:     Optional[int]   = None
    cook_time:     Optional[int]   = None
    is_favorite:   Optional[bool]  = None
    ingredients:   Optional[list[IngredientIn]] = None
    steps:         Optional[list[StepIn]]       = None


class RecipeOut(BaseModel):
    id:              int
    title:           str
    category:        str
    description:     str
    base_servings:   float
    prep_time:       int
    cook_time:       int
    image_url:       Optional[str] = None
    is_favorite:     bool
    is_ai_generated: bool
    ingredients:     list[dict]
    steps:           list[dict]
    created_at:      datetime
    updated_at:      datetime

    # v4.4 で追加されたが、スキーマへの反映漏れがあったフィールド（v4.4.1 で修正）
    is_public:       bool           = False
    share_id:        Optional[str] = None
    forked_from:     Optional[int] = None

    model_config    = {"from_attributes": True}


# ── 買い物リスト ───────────────────────────────
class ShoppingItemIn(BaseModel):
    name:     str
    needed:   Optional[float] = None
    unit:     str             = ""
    is_text:  bool            = False
    text_val: Optional[str]  = None
    checked:  bool            = False


class ShoppingListCreate(BaseModel):
    recipe_id:    Optional[int] = None
    recipe_title: str           = Field(..., min_length=1)
    servings:     float         = Field(2.0, gt=0)
    items:        list[ShoppingItemIn]


class ShoppingListOut(BaseModel):
    id:           int
    recipe_id:    Optional[int] = None
    recipe_title: str
    servings:     float
    items:        list[dict]
    created_at:   datetime
    model_config = {"from_attributes": True}


# ── AI ─────────────────────────────────────────
class AIRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=500)


class AIResponse(BaseModel):
    answer:  str
    is_mock: bool = True


class DiscoverRequest(BaseModel):
    mood:     Optional[str] = None
    max_time: Optional[int] = None
    category: Optional[str] = None


class DiscoverItemOut(BaseModel):
    title:       str
    category:    str
    description: str
    cook_time:   int
    servings:    int


class DiscoverResponse(BaseModel):
    items:   list[DiscoverItemOut]
    is_mock: bool


class GenerateRecipeRequest(BaseModel):
    title:    str = Field(..., min_length=1)
    servings: int = Field(2, gt=0)


class GenerateRecipeResponse(BaseModel):
    title:         str
    category:      str
    description:   str
    base_servings: int
    prep_time:     int
    cook_time:     int
    ingredients:   list[dict]
    steps:         list[dict]
    is_mock:       bool
