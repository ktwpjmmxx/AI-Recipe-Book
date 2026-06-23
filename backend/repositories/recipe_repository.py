"""
repositories/recipe_repository.py — レシピ DB アクセス層

v4.4 追加:
  - generate_share_id(): 推測されにくいランダムIDを生成
  - find_by_share_id():  公開URL経由でのレシピ取得（is_public=True のみ）
  - set_visibility():    公開/非公開の切り替え（share_id が未発行なら同時に発行）
  - fork():              他ユーザーのレシピを自分のライブラリにコピー
"""
from __future__ import annotations
import secrets
import string
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import asc, desc
from models import RecipeORM

_SHARE_ID_ALPHABET = string.ascii_letters + string.digits
_SHARE_ID_LENGTH    = 8


class RecipeRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def find_all(
        self,
        user_id:       Optional[int] = None,
        category:      Optional[str] = None,
        sort:          str           = "updated_at",
        order:         str           = "desc",
        favorites_only: bool         = False,
    ) -> list[RecipeORM]:
        q = self._db.query(RecipeORM)
        if user_id is not None:
            q = q.filter(RecipeORM.user_id == user_id)
        if category:
            q = q.filter(RecipeORM.category == category)
        if favorites_only:
            q = q.filter(RecipeORM.is_favorite == True)
        col = getattr(RecipeORM, sort, RecipeORM.updated_at)
        q   = q.order_by(desc(col) if order == "desc" else asc(col))
        return q.all()

    def find_by_id(self, recipe_id: int, user_id: Optional[int] = None) -> Optional[RecipeORM]:
        q = self._db.query(RecipeORM).filter(RecipeORM.id == recipe_id)
        if user_id is not None:
            q = q.filter(RecipeORM.user_id == user_id)
        return q.first()

    def create(self, data: dict) -> RecipeORM:
        recipe = RecipeORM(**data)
        self._db.add(recipe)
        self._db.commit()
        self._db.refresh(recipe)
        return recipe

    def update(self, recipe: RecipeORM, data: dict) -> RecipeORM:
        for k, v in data.items():
            setattr(recipe, k, v)
        self._db.commit()
        self._db.refresh(recipe)
        return recipe

    def delete(self, recipe: RecipeORM) -> None:
        self._db.delete(recipe)
        self._db.commit()

    def find_distinct_categories(self, user_id: Optional[int] = None) -> list[str]:
        q = self._db.query(RecipeORM.category).distinct()
        if user_id is not None:
            q = q.filter(RecipeORM.user_id == user_id)
        return [row[0] for row in q.all() if row[0]]

    # ── v4.4: 共有・フォーク機能 ────────────────

    def _generate_unique_share_id(self) -> str:
        """
        他のレシピと衝突しないランダムIDを生成する。
        8文字の英数字（大文字・小文字・数字）で約218兆通りの組み合わせがあり、
        現実的に推測・総当たりされるリスクは極めて低い。
        """
        while True:
            candidate = "".join(secrets.choice(_SHARE_ID_ALPHABET) for _ in range(_SHARE_ID_LENGTH))
            exists = self._db.query(RecipeORM).filter(RecipeORM.share_id == candidate).first()
            if not exists:
                return candidate

    def find_by_share_id(self, share_id: str) -> Optional[RecipeORM]:
        """
        公開URL経由でレシピを取得する。

        is_public=True のレシピのみを返す。これにより、
        オーナーが非公開化した瞬間に既存のURLでもアクセス不可能になる
        （share_id 自体は変えずに「鍵をかける」イメージ）。
        """
        return (
            self._db.query(RecipeORM)
            .filter(RecipeORM.share_id == share_id, RecipeORM.is_public == True)
            .first()
        )

    def set_visibility(self, recipe: RecipeORM, is_public: bool) -> RecipeORM:
        """
        公開/非公開を切り替える。

        初めて公開する際に share_id が未発行であれば、ここで新規発行する。
        一度発行した share_id は非公開化しても保持し続けるため、
        再公開時に以前と同じURLを使い続けられる。
        """
        if is_public and not recipe.share_id:
            recipe.share_id = self._generate_unique_share_id()
        recipe.is_public = is_public
        self._db.commit()
        self._db.refresh(recipe)
        return recipe

    def fork(self, source: RecipeORM, new_owner_id: int) -> RecipeORM:
        """
        他ユーザーの公開レシピを、新しい所有者（new_owner_id）のレシピとして複製する。

        重要な設計判断:
          - ingredients / steps はそのままコピーする（JSON型なのでディープコピー相当になる）
          - is_public / share_id はコピーしない（フォーク後のレシピは常に非公開スタートにする。
            「他人のレシピを無断で再公開できる」という事故を防ぐため）
          - forked_from に元レシピのIDを記録する（系譜を残す）
          - is_favorite はリセットする（フォークしたユーザーの意思を反映する前のニュートラルな状態にする）
        """
        forked = RecipeORM(
            user_id=new_owner_id,
            title=source.title,
            category=source.category,
            description=source.description,
            base_servings=source.base_servings,
            prep_time=source.prep_time,
            cook_time=source.cook_time,
            image_url=source.image_url,
            is_favorite=False,
            is_ai_generated=source.is_ai_generated,
            ingredients=source.ingredients,
            steps=source.steps,
            is_public=False,
            share_id=None,
            forked_from=source.id,
        )
        self._db.add(forked)
        self._db.commit()
        self._db.refresh(forked)
        return forked
