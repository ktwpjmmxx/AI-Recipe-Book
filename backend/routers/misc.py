"""
routers/misc.py — カテゴリ一覧など雑多なエンドポイント
"""
from __future__ import annotations
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from repositories.recipe_repository import RecipeRepository

router = APIRouter(prefix="/api", tags=["misc"])


@router.get(
    "/categories",
    response_model=list[str],
    summary="登録済みカテゴリ一覧取得",
    description="ログインユーザーが実際に保存しているレシピから、重複を除いたカテゴリ一覧を返す（フィルタUIの選択肢生成用）。",
)
def list_categories(db: Session = Depends(get_db)):
    return RecipeRepository(db).find_distinct_categories()
