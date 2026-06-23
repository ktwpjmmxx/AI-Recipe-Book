"""
routers/recipes.py — レシピ CRUD エンドポイント

v4.4 追加:
  PATCH /api/recipes/{recipe_id}/visibility : 公開/非公開の切り替え・共有URL取得
"""
from __future__ import annotations
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import RecipeORM, UserORM
from repositories.recipe_repository import RecipeRepository
from repositories.vector_repository import upsert_recipe, delete_recipe as vec_delete
from routers.schemas import RecipeCreate, RecipeUpdate, RecipeOut
from config import settings

router = APIRouter(prefix="/api/recipes", tags=["recipes"])

_ALLOWED_IMG = {".jpg", ".jpeg", ".png", ".webp"}


def _to_out(r) -> RecipeOut:
    return RecipeOut.model_validate(r)


def _not_found():
    raise HTTPException(404, "レシピが見つかりません")


@router.get("", response_model=list[RecipeOut])
def list_recipes(
    category:       Optional[str] = None,
    sort:           str           = "updated_at",
    order:          str           = "desc",
    favorites_only: bool          = False,
    db:             Session       = Depends(get_db),
    current_user:   UserORM       = Depends(get_current_user),
):
    repo = RecipeRepository(db)
    recipes = repo.find_all(
        user_id=current_user.id,
        category=category, sort=sort, order=order, favorites_only=favorites_only,
    )
    return [_to_out(r) for r in recipes]


@router.get("/{recipe_id}", response_model=RecipeOut)
def get_recipe(
    recipe_id:    int,
    db:           Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user),
):
    r = RecipeRepository(db).find_by_id(recipe_id, user_id=current_user.id)
    if not r: _not_found()
    return _to_out(r)


@router.post("", response_model=RecipeOut, status_code=201)
def create_recipe(
    body:             RecipeCreate,
    background_tasks: BackgroundTasks,
    db:               Session = Depends(get_db),
    current_user:     UserORM = Depends(get_current_user),
):
    repo = RecipeRepository(db)
    data = body.model_dump()
    data["ingredients"] = [i.model_dump() for i in body.ingredients]
    data["steps"]       = [s.model_dump() for s in body.steps]
    data["user_id"]     = current_user.id
    r = repo.create(data)
    background_tasks.add_task(upsert_recipe, r)
    return _to_out(r)


@router.patch("/{recipe_id}", response_model=RecipeOut)
def update_recipe(
    recipe_id:        int,
    body:             RecipeUpdate,
    background_tasks: BackgroundTasks,
    db:               Session = Depends(get_db),
    current_user:     UserORM = Depends(get_current_user),
):
    repo = RecipeRepository(db)
    r    = repo.find_by_id(recipe_id, user_id=current_user.id)
    if not r: _not_found()

    data = body.model_dump(exclude_unset=True)
    if "ingredients" in data and data["ingredients"] is not None:
        data["ingredients"] = [i.model_dump() if hasattr(i, "model_dump") else i for i in data["ingredients"]]
    if "steps" in data and data["steps"] is not None:
        data["steps"] = [s.model_dump() if hasattr(s, "model_dump") else s for s in data["steps"]]

    r = repo.update(r, data)
    background_tasks.add_task(upsert_recipe, r)
    return _to_out(r)


@router.delete("/{recipe_id}", status_code=204)
def delete_recipe(
    recipe_id:        int,
    background_tasks: BackgroundTasks,
    db:               Session = Depends(get_db),
    current_user:     UserORM = Depends(get_current_user),
):
    repo = RecipeRepository(db)
    r    = repo.find_by_id(recipe_id, user_id=current_user.id)
    if not r: _not_found()
    repo.delete(r)
    background_tasks.add_task(vec_delete, recipe_id)


@router.post("/{recipe_id}/image", response_model=RecipeOut)
async def upload_image(
    recipe_id:    int,
    file:         UploadFile = File(...),
    db:           Session    = Depends(get_db),
    current_user: UserORM    = Depends(get_current_user),
):
    repo = RecipeRepository(db)
    r    = repo.find_by_id(recipe_id, user_id=current_user.id)
    if not r: _not_found()

    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in _ALLOWED_IMG:
        raise HTTPException(422, "jpg/png/webp のみ対応")

    max_bytes = settings.max_upload_mb * 1024 * 1024
    path = settings.upload_dir / f"{uuid.uuid4()}{suffix}"

    size = 0
    with path.open("wb") as buf:
        while chunk := await file.read(65536):
            size += len(chunk)
            if size > max_bytes:
                buf.close(); path.unlink(missing_ok=True)
                raise HTTPException(413, f"ファイルサイズが {settings.max_upload_mb}MB を超えています")
            buf.write(chunk)

    r = repo.update(r, {"image_url": f"/uploads/{path.name}"})
    return _to_out(r)


@router.patch("/{recipe_id}/favorite", response_model=RecipeOut)
def toggle_favorite(
    recipe_id:    int,
    db:           Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user),
):
    repo = RecipeRepository(db)
    r    = repo.find_by_id(recipe_id, user_id=current_user.id)
    if not r: _not_found()
    r = repo.update(r, {"is_favorite": not (r.is_favorite or False)})
    return _to_out(r)


# ── v4.4: 公開/非公開の切り替え ────────────────

class VisibilityRequest(BaseModel):
    is_public: bool


class VisibilityResponse(BaseModel):
    is_public:  bool
    share_id:   Optional[str] = None
    share_path: Optional[str] = None  # フロントエンドがそのままURLに使える相対パス


@router.patch("/{recipe_id}/visibility", response_model=VisibilityResponse)
def set_visibility(
    recipe_id:    int,
    body:         VisibilityRequest,
    db:           Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user),
):
    """
    レシピの公開/非公開を切り替える。

    公開にした瞬間に share_id が（未発行であれば）新規発行され、
    /r/{share_id} のURLでログインなしに誰でも閲覧できるようになる。
    非公開にすると、同じURLにアクセスしても 404 が返るようになる
    （share_id 自体は削除しないため、再公開すれば同じURLが復活する）。
    """
    repo = RecipeRepository(db)
    r    = repo.find_by_id(recipe_id, user_id=current_user.id)
    if not r: _not_found()

    r = repo.set_visibility(r, body.is_public)
    return VisibilityResponse(
        is_public=r.is_public,
        share_id=r.share_id,
        share_path=f"/r/{r.share_id}" if (r.is_public and r.share_id) else None,
    )
