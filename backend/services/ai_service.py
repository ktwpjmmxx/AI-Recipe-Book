"""
services/ai_service.py — AI オーケストレーション層

変更点（RAG対応）:
  - search_assist(): RAGを使ったライブラリ横断型のAI回答
  - assist(): 特定レシピへの質問でもRAGコンテキストを補助注入
"""
from __future__ import annotations
import logging
from typing import Optional
from services.ai.factory import get_llm_client
from services.ai.base import DiscoverItem, GeneratedRecipe
from repositories.vector_repository import search_similar_recipes

logger = logging.getLogger(__name__)


class AIService:
    def __init__(self) -> None:
        self._llm = get_llm_client()

    # ── 既存: レシピ候補の提案 ───────────────────
    def discover(
        self,
        mood:     Optional[str] = None,
        max_time: Optional[int] = None,
        category: Optional[str] = None,
    ) -> tuple[list[DiscoverItem], bool]:
        from services.ai.mock_client import MockLLMClient
        is_mock = isinstance(self._llm, MockLLMClient)
        try:
            items = self._llm.discover(mood=mood, max_time=max_time, category=category)
            return items, is_mock
        except Exception as e:
            logger.error(f"AI discover failed: {e}")
            items = MockLLMClient().discover(mood=mood, max_time=max_time, category=category)
            return items, True

    # ── 既存: レシピ全文生成 ─────────────────────
    def generate_recipe(self, title: str, servings: int) -> tuple[GeneratedRecipe, bool]:
        from services.ai.mock_client import MockLLMClient
        is_mock = isinstance(self._llm, MockLLMClient)
        try:
            recipe = self._llm.generate_recipe(title, servings)
            return recipe, is_mock
        except Exception as e:
            logger.error(f"AI generate_recipe failed: {e}")
            recipe = MockLLMClient().generate_recipe(title, servings)
            return recipe, True

    # ── 既存: 特定レシピへのAI質問 ───────────────
    def assist(
        self,
        recipe_title:    str,
        ingredients_text: str,
        question:        str,
    ) -> tuple[str, bool]:
        from services.ai.mock_client import MockLLMClient
        is_mock = isinstance(self._llm, MockLLMClient)
        try:
            answer = self._llm.assist(recipe_title, ingredients_text, question)
            return answer, is_mock
        except Exception as e:
            logger.error(f"AI assist failed: {e}")
            answer = MockLLMClient().assist(recipe_title, ingredients_text, question)
            return answer, True

    # ── 新規: RAGを使ったライブラリ横断型回答 ─────
    def search_assist(self, question: str) -> tuple[str, bool, list[dict]]:
        """
        ユーザーの質問に対して、登録レシピ全体を検索した上で回答する。

        処理フロー:
          1. ChromaDB でクエリに類似するレシピを取得（Retrieval）
          2. 取得したレシピをコンテキストとしてプロンプトに注入（Augmented）
          3. LLM が「ユーザーのライブラリ」を参照した上で回答（Generation）

        Returns:
            (answer, is_mock, retrieved_recipes)
            - answer: AIの回答テキスト
            - is_mock: モック動作かどうか
            - retrieved_recipes: 検索でヒットしたレシピ（フロントで「参照レシピ」表示に使う）
        """
        from services.ai.mock_client import MockLLMClient
        is_mock = isinstance(self._llm, MockLLMClient)

        # ── Step 1: Retrieval ───────────────────
        retrieved = search_similar_recipes(question, n_results=4)
        logger.info(f"RAG search_assist: query='{question}', hits={len(retrieved)}")

        # ── Step 2 & 3: Augmented Generation ────
        try:
            if is_mock:
                answer = self._mock_rag_answer(question, retrieved)
            else:
                answer = self._llm.search_assist(question, retrieved)
            return answer, is_mock, retrieved
        except Exception as e:
            logger.error(f"RAG search_assist LLM call failed: {e}")
            answer = self._mock_rag_answer(question, retrieved)
            return answer, True, retrieved

    def _mock_rag_answer(self, question: str, retrieved: list[dict]) -> str:
        """OPENAI_API_KEY 未設定時のモック回答（検索結果は実際に使用）"""
        if not retrieved:
            return (
                "登録されているレシピから関連するものが見つかりませんでした。\n"
                "レシピを追加すると、より精度の高い回答ができるようになります。\n"
                "（OPENAI_API_KEY を設定すると本格的なAI回答が有効になります）"
            )
        titles = "、".join(r["title"] for r in retrieved)
        return (
            f"「{question}」に関連するレシピとして「{titles}」が見つかりました。\n\n"
            f"OPENAI_API_KEY を設定すると、これらのレシピを参照した上で\n"
            f"具体的なアドバイスをAIが回答します。"
        )


# ── シングルトン ──────────────────────────────
_service: AIService | None = None


def get_ai_service() -> AIService:
    global _service
    if _service is None:
        _service = AIService()
    return _service
