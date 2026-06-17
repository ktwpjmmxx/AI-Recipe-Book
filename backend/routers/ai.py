"""
routers/ai.py — AI 関連エンドポイント

変更点（RAG対応）:
  - POST /api/ai/search-assist : ライブラリ横断型RAG回答
"""
from __future__ import annotations
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from database import get_db
from services.ai_service import get_ai_service
from routers.schemas import (
    DiscoverRequest, DiscoverResponse, DiscoverItemOut,
    GenerateRecipeRequest, GenerateRecipeResponse,
    AIRequest, AIResponse,
)

router = APIRouter(prefix="/api/ai", tags=["ai"])


# ── 既存エンドポイント ─────────────────────────

@router.post("/discover", response_model=DiscoverResponse)
def ai_discover(body: DiscoverRequest):
    items, is_mock = get_ai_service().discover(
        mood=body.mood,
        max_time=body.max_time,
        category=body.category,
    )
    return DiscoverResponse(
        items=[DiscoverItemOut(**vars(i)) for i in items],
        is_mock=is_mock,
    )


@router.post("/generate-recipe", response_model=GenerateRecipeResponse)
def ai_generate_recipe(body: GenerateRecipeRequest):
    recipe, is_mock = get_ai_service().generate_recipe(body.title, body.servings)
    return GenerateRecipeResponse(
        title=recipe.title,
        category=recipe.category,
        description=recipe.description,
        base_servings=recipe.base_servings,
        prep_time=recipe.prep_time,
        cook_time=recipe.cook_time,
        ingredients=recipe.ingredients,
        steps=recipe.steps,
        is_mock=is_mock,
    )


@router.post("/suggest-menu", response_model=AIResponse)
def suggest_menu(body: AIRequest, db: Session = Depends(get_db)):
    from sqlalchemy import select
    from models import RecipeORM
    recipes = db.execute(select(RecipeORM)).scalars().all()
    titles  = [r.title for r in recipes[:5]]
    mock = (
        f"保存中のレシピ（{len(recipes)}件）から提案します。\n\n"
        f"本日のおすすめ\n"
        f"・メイン: {titles[0] if titles else '未登録'}\n"
        f"・副菜: {titles[1] if len(titles) > 1 else 'サラダ'}\n"
        f"※ OPENAI_API_KEY を設定するとAIが本格回答します。"
    )
    return AIResponse(answer=mock, is_mock=True)


# ── 新規: RAG ライブラリ横断回答 ──────────────

class SearchAssistRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=500)


class RetrievedRecipe(BaseModel):
    """RAG で参照したレシピ（フロントエンドで「参照元」表示に使う）"""
    recipe_id: int | None = None
    title:     str
    category:  str
    score:     float  # コサイン距離（小さいほど類似度が高い）


class SearchAssistResponse(BaseModel):
    answer:     str
    is_mock:    bool
    references: list[RetrievedRecipe]  # 回答の根拠となったレシピ一覧


@router.post("/search-assist", response_model=SearchAssistResponse)
def ai_search_assist(body: SearchAssistRequest):
    """
    RAGを使ったライブラリ横断型AI回答。

    ユーザーの質問に対して:
      1. ChromaDB でライブラリ全体を意味検索
      2. ヒットしたレシピをコンテキストとしてプロンプトに注入
      3. LLM が「ユーザーのレシピ」を参照して回答

    レスポンスに references を含めることで、フロントエンドが
    「このレシピを参照して回答しました」と表示できる。
    """
    answer, is_mock, retrieved = get_ai_service().search_assist(body.question)

    references = [
        RetrievedRecipe(
            recipe_id=r.get("recipe_id"),
            title=r.get("title", ""),
            category=r.get("category", ""),
            score=r.get("score", 0.0),
        )
        for r in retrieved
    ]

    return SearchAssistResponse(
        answer=answer,
        is_mock=is_mock,
        references=references,
    )
