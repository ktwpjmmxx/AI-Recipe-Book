"""
repositories/shopping_repository.py — 買い物リストの永続化操作
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import select
from models import ShoppingListORM


class ShoppingListRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def find_all(self) -> list[ShoppingListORM]:
        stmt = select(ShoppingListORM).order_by(ShoppingListORM.created_at.desc())
        return list(self._db.execute(stmt).scalars().all())

    def find_by_id(self, list_id: int) -> Optional[ShoppingListORM]:
        return self._db.get(ShoppingListORM, list_id)

    def create(self, data: dict) -> ShoppingListORM:
        sl = ShoppingListORM(**data, created_at=datetime.now(timezone.utc))
        self._db.add(sl)
        self._db.commit()
        self._db.refresh(sl)
        return sl

    def update_items(self, sl: ShoppingListORM, items: list[dict]) -> ShoppingListORM:
        sl.items = items
        self._db.commit()
        self._db.refresh(sl)
        return sl

    def delete(self, sl: ShoppingListORM) -> None:
        self._db.delete(sl)
        self._db.commit()
