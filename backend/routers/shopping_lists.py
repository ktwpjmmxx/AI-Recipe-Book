"""
routers/shopping_lists.py — 買い物リスト CRUD エンドポイント
"""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from repositories.shopping_repository import ShoppingListRepository
from routers.schemas import ShoppingListCreate, ShoppingListOut

router = APIRouter(prefix="/api/shopping-lists", tags=["shopping-lists"])


def _to_out(sl) -> ShoppingListOut:
    return ShoppingListOut.model_validate(sl)


def _not_found():
    raise HTTPException(404, "買い物リストが見つかりません")


@router.post("", response_model=ShoppingListOut, status_code=201)
def create_shopping_list(body: ShoppingListCreate, db: Session = Depends(get_db)):
    repo = ShoppingListRepository(db)
    data = {
        "recipe_id":    body.recipe_id,
        "recipe_title": body.recipe_title,
        "servings":     body.servings,
        "items":        [i.model_dump() for i in body.items],
    }
    sl = repo.create(data)
    return _to_out(sl)


@router.get("", response_model=list[ShoppingListOut])
def list_shopping_lists(db: Session = Depends(get_db)):
    return [_to_out(sl) for sl in ShoppingListRepository(db).find_all()]


@router.get("/{list_id}", response_model=ShoppingListOut)
def get_shopping_list(list_id: int, db: Session = Depends(get_db)):
    sl = ShoppingListRepository(db).find_by_id(list_id)
    if not sl: _not_found()
    return _to_out(sl)


@router.patch("/{list_id}/items", response_model=ShoppingListOut)
def update_items(list_id: int, items: list[dict], db: Session = Depends(get_db)):
    repo = ShoppingListRepository(db)
    sl   = repo.find_by_id(list_id)
    if not sl: _not_found()
    sl = repo.update_items(sl, items)
    return _to_out(sl)


@router.delete("/{list_id}", status_code=204)
def delete_shopping_list(list_id: int, db: Session = Depends(get_db)):
    repo = ShoppingListRepository(db)
    sl   = repo.find_by_id(list_id)
    if not sl: _not_found()
    repo.delete(sl)
