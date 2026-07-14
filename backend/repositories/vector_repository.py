"""
repositories/vector_repository.py — ChromaDB アクセス層

変更点（RAG対応）:
  - search_similar_recipes(): クエリに類似したレシピをベクター検索で返す
  - build_recipe_document(): インデックス用テキストの構造を改善
"""
from __future__ import annotations
import logging
from models import RecipeORM

logger = logging.getLogger(__name__)

# ── シングルトン初期化 ─────────────────────────
_collection = None


def get_collection():
    """ChromaDB コレクションをシングルトンで返す。未インストール時は None。"""
    global _collection
    if _collection is not None:
        return _collection
    try:
        import chromadb
        client = chromadb.PersistentClient(path="./chroma_data")
        _collection = client.get_or_create_collection(
            name="recipes",
            # コサイン類似度を使用（意味的な近さで検索する）
            metadata={"hnsw:space": "cosine"},
        )
        logger.info("ChromaDB initialized")
    except ImportError:
        logger.warning("chromadb not installed. Vector indexing disabled.")
    except Exception as e:
        logger.warning(f"ChromaDB init failed: {e}")
    return _collection


# ── 材料整形（共通ロジック）─────────────────────
def format_ingredients_text(ingredients: list[dict]) -> str:
    """材料リストを「食材名 + 分量 + 単位」のテキストに整形する（「、」区切り）"""
    parts = []
    for i in (ingredients or []):
        name = i.get("name", "")
        if i.get("amount_text"):
            parts.append(f"{name} {i['amount_text']}")
        elif i.get("amount"):
            parts.append(f"{name} {i['amount']}{i.get('unit', '')}")
        else:
            parts.append(name)
    return "、".join(parts)


# ── ドキュメント構築 ───────────────────────────
def build_recipe_document(recipe: RecipeORM) -> str:
    """
    レシピをベクター化するためのテキストを構築する。

    設計方針:
      - フィールドにラベルを付けて構造化する（ラベルなしより検索精度が上がる）
      - 材料は「食材名 + 分量 + 単位」をまとめる
      - 手順は番号付きで並べる
      - これにより「材料で検索」「調理方法で検索」どちらにも対応できる
    """
    # 材料テキスト
    ingredients_text = format_ingredients_text(recipe.ingredients)

    # 手順テキスト
    steps_text = " ".join(
        f"{s.get('order', i+1)}. {s.get('description', '')}"
        for i, s in enumerate(recipe.steps or [])
    )

    return (
        f"レシピ名: {recipe.title}\n"
        f"カテゴリ: {recipe.category}\n"
        f"調理時間: {recipe.cook_time}分\n"
        f"人数: {recipe.base_servings}人前\n"
        f"材料: {ingredients_text}\n"
        f"手順: {steps_text}"
    )


# ── インデックス登録 ───────────────────────────
def upsert_recipe(recipe: RecipeORM) -> None:
    """レシピをベクターDBに登録・更新する（失敗してもメイン処理に影響しない）"""
    collection = get_collection()
    if collection is None:
        return
    try:
        document = build_recipe_document(recipe)
        collection.upsert(
            ids=[str(recipe.id)],
            documents=[document],
            metadatas=[{
                "title":     recipe.title,
                "category":  recipe.category,
                "cook_time": recipe.cook_time,
                "recipe_id": recipe.id,
            }],
        )
        logger.debug(f"ChromaDB upserted recipe {recipe.id}: {recipe.title}")
    except Exception as e:
        logger.warning(f"ChromaDB upsert failed for recipe {recipe.id}: {e}")


def delete_recipe(recipe_id: int) -> None:
    """レシピをベクターDBから削除する"""
    collection = get_collection()
    if collection is None:
        return
    try:
        collection.delete(ids=[str(recipe_id)])
    except Exception as e:
        logger.warning(f"ChromaDB delete failed for recipe {recipe_id}: {e}")


# ── RAG: 類似レシピ検索 ────────────────────────
def search_similar_recipes(
    query: str,
    n_results: int = 4,
    score_threshold: float = 0.85,  # コサイン距離の上限（小さいほど類似度が高い）
) -> list[dict]:
    """
    ユーザーの質問テキストに意味的に近いレシピを返す。

    ChromaDB はクエリテキストを自動でベクトル化し、
    コサイン類似度でインデックスを検索する。

    Args:
        query:           検索クエリ（自然言語）
        n_results:       取得する最大件数
        score_threshold: この距離を超えるものは除外（関連性が低い結果を除くフィルター）

    Returns:
        [{"recipe_id": int, "title": str, "document": str, "score": float}, ...]
        スコアが低い（類似度が高い）順に並んでいる
    """
    collection = get_collection()
    if collection is None:
        return []

    # DBにレシピが1件もない場合は空を返す
    if collection.count() == 0:
        return []

    try:
        results = collection.query(
            query_texts=[query],
            n_results=min(n_results, collection.count()),
            include=["documents", "metadatas", "distances"],
        )

        hits = []
        documents = results.get("documents",  [[]])[0]
        metadatas = results.get("metadatas",  [[]])[0]
        distances = results.get("distances",  [[]])[0]

        for doc, meta, dist in zip(documents, metadatas, distances):
            # score_threshold を超えるもの（関連性が薄いもの）は除外
            if dist > score_threshold:
                continue
            hits.append({
                "recipe_id": meta.get("recipe_id"),
                "title":     meta.get("title", ""),
                "category":  meta.get("category", ""),
                "document":  doc,
                "score":     round(dist, 4),  # 小さいほど類似度が高い
            })

        logger.debug(f"RAG search '{query}': {len(hits)} hits")
        return hits

    except Exception as e:
        logger.warning(f"ChromaDB search failed: {e}")
        return []
