"""
routers/ai.py — AI 関連エンドポイント

Router はリクエスト受付と AIService への委譲のみ担当する。
"""
from __future__ import annotations
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from services.ai_service import get_ai_service
from routers.schemas import (
    DiscoverRequest, DiscoverResponse, DiscoverItemOut,
    GenerateRecipeRequest, GenerateRecipeResponse,
    AIRequest, AIResponse,
)

router = APIRouter(prefix="/api/ai", tags=["ai"])


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
