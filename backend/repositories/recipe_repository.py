"""
repositories/recipe_repository.py — レシピの永続化操作

ここでは SQLAlchemy のクエリのみを記述する。
ビジネスロジックは services/ に置く。
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import select
from models import RecipeORM


class RecipeRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def find_all(
        self,
        *,
        category: Optional[str] = None,
        sort: str = "updated_at",
        order: str = "desc",
        favorites_only: bool = False,
    ) -> list[RecipeORM]:
        stmt = select(RecipeORM)
        if category:
            stmt = stmt.where(RecipeORM.category == category)
        if favorites_only:
            stmt = stmt.where(RecipeORM.is_favorite.is_(True))

        col_map = {
            "title":      RecipeORM.title,
            "cook_time":  RecipeORM.cook_time,
            "created_at": RecipeORM.created_at,
        }
        col = col_map.get(sort, RecipeORM.updated_at)
        stmt = stmt.order_by(col.desc() if order == "desc" else col.asc())
        return list(self._db.execute(stmt).scalars().all())

    def find_by_id(self, recipe_id: int) -> Optional[RecipeORM]:
        return self._db.get(RecipeORM, recipe_id)

    def find_distinct_categories(self) -> list[str]:
        rows = self._db.execute(select(RecipeORM.category).distinct()).scalars().all()
        return sorted(rows)

    def create(self, data: dict) -> RecipeORM:
        now = datetime.now(timezone.utc)
        recipe = RecipeORM(**data, created_at=now, updated_at=now)
        self._db.add(recipe)
        self._db.commit()
        self._db.refresh(recipe)
        return recipe

    def update(self, recipe: RecipeORM, data: dict) -> RecipeORM:
        for key, value in data.items():
            setattr(recipe, key, value)
        recipe.updated_at = datetime.now(timezone.utc)
        self._db.commit()
        self._db.refresh(recipe)
        return recipe

    def delete(self, recipe: RecipeORM) -> None:
        self._db.delete(recipe)
        self._db.commit()
