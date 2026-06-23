"""
routers/public.py — 公開レシピ閲覧・フォークエンドポイント（v4.4 新規）

設計方針:
  - GET  /api/public/recipes/{share_id}        : 認証不要。誰でも閲覧できる
  - POST /api/public/recipes/{share_id}/fork   : 認証必須。ログインユーザーのライブラリにコピー

この2エンドポイントだけを別ファイルに分離している理由:
  recipes.py の他のエンドポイントは全て get_current_user を必須にしているが、
  公開レシピの閲覧だけは「ログインしていない第三者」もアクセスできる必要がある。
  認証必須のルーターと認証不要のルーターを明確にファイルレベルで分けることで、
  「このファイルの中身は認証不要なので公開情報以外を絶対に返してはいけない」という
  注意点をコードの構造そのもので表現している。
"""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import UserORM
from repositories.recipe_repository import RecipeRepository
from routers.schemas import RecipeOut

router = APIRouter(prefix="/api/public", tags=["public"])


def _to_out(r) -> RecipeOut:
    return RecipeOut.model_validate(r)


# ── 公開レシピの閲覧（認証不要） ──────────────
@router.get("/recipes/{share_id}", response_model=RecipeOut)
def get_public_recipe(share_id: str, db: Session = Depends(get_db)):
    """
    共有URL経由でレシピを閲覧する。

    認証は一切要求しない。find_by_share_id() が is_public=True のレシピしか
    返さないため、非公開化されたレシピは自動的に 404 になる。
    """
    repo = RecipeRepository(db)
    recipe = repo.find_by_share_id(share_id)
    if not recipe:
        raise HTTPException(404, "このレシピは公開されていない、または存在しません。")
    return _to_out(recipe)


# ── フォーク（認証必須） ──────────────────────
class ForkResponse(BaseModel):
    id: int
    title: str


@router.post("/recipes/{share_id}/fork", response_model=ForkResponse, status_code=201)
def fork_recipe(
    share_id:     str,
    db:           Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user),
):
    """
    公開レシピを自分のライブラリにコピー（フォーク）する。

    閲覧自体は認証不要だが、フォークは「誰のライブラリに追加するか」を
    特定する必要があるため get_current_user を必須にしている。

    自分自身のレシピをフォークすることも技術的には可能だが、
    特に禁止する必要もないため許可している（複製して別バリエーションを
    作りたいケースに自然に対応できる）。
    """
    repo = RecipeRepository(db)
    source = repo.find_by_share_id(share_id)
    if not source:
        raise HTTPException(404, "このレシピは公開されていない、または存在しません。")

    forked = repo.fork(source, new_owner_id=current_user.id)
    return ForkResponse(id=forked.id, title=forked.title)
