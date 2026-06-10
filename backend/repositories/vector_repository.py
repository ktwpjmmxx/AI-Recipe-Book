"""
repositories/vector_repository.py — ChromaDB ベクターDB アクセス

シングルトンで初期化し、未インストール時はサイレントに無効化する。
"""
from __future__ import annotations
import logging
from typing import Optional
from models import RecipeORM

logger = logging.getLogger(__name__)
_collection = None


def get_collection():
    global _collection
    if _collection is not None:
        return _collection
    try:
        import chromadb
        client = chromadb.PersistentClient(path="./chroma_data")
        _collection = client.get_or_create_collection("recipes")
        logger.info("ChromaDB initialized")
    except ImportError:
        logger.warning("chromadb not installed. Vector indexing disabled.")
    except Exception as e:
        logger.warning(f"ChromaDB init failed: {e}")
    return _collection


def upsert_recipe(recipe: RecipeORM) -> None:
    """レシピをベクターDBにインデックスする（失敗してもメイン処理に影響しない）"""
    collection = get_collection()
    if collection is None:
        return
    try:
        ings = ", ".join(
            f"{i['name']} {i.get('amount_text') or str(i.get('amount', ''))}{i.get('unit', '')}"
            for i in (recipe.ingredients or [])
        )
        steps = " ".join(
            f"工程{s['order']}: {s['description']}"
            for s in (recipe.steps or [])
        )
        collection.upsert(
            ids=[str(recipe.id)],
            documents=[f"レシピ:{recipe.title} カテゴリ:{recipe.category} 材料:{ings} 手順:{steps}"],
            metadatas=[{"title": recipe.title, "category": recipe.category}],
        )
    except Exception as e:
        logger.warning(f"ChromaDB upsert failed for recipe {recipe.id}: {e}")


def delete_recipe(recipe_id: int) -> None:
    collection = get_collection()
    if collection is None:
        return
    try:
        collection.delete(ids=[str(recipe_id)])
    except Exception as e:
        logger.warning(f"ChromaDB delete failed for recipe {recipe_id}: {e}")
