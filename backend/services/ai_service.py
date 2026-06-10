"""
services/ai_service.py — AI オーケストレーション層

LLM の呼び出し・エラーハンドリング・リトライを一元管理する。
Router 層はこのサービスを呼ぶだけでよい。
"""
from __future__ import annotations
import logging
from typing import Optional
from services.ai.factory import get_llm_client
from services.ai.base import DiscoverItem, GeneratedRecipe

logger = logging.getLogger(__name__)


class AIService:
    def __init__(self) -> None:
        self._llm = get_llm_client()

    def discover(
        self,
        mood:     Optional[str] = None,
        max_time: Optional[int] = None,
        category: Optional[str] = None,
    ) -> tuple[list[DiscoverItem], bool]:
        """
        料理候補を返す。
        Returns: (items, is_mock)
        """
        from services.ai.mock_client import MockLLMClient
        is_mock = isinstance(self._llm, MockLLMClient)
        try:
            items = self._llm.discover(mood=mood, max_time=max_time, category=category)
            return items, is_mock
        except Exception as e:
            logger.error(f"AI discover failed: {e}")
            from services.ai.mock_client import MockLLMClient
            items = MockLLMClient().discover(mood=mood, max_time=max_time, category=category)
            return items, True

    def generate_recipe(self, title: str, servings: int) -> tuple[GeneratedRecipe, bool]:
        """
        レシピ全文を生成して返す。
        Returns: (recipe, is_mock)
        """
        from services.ai.mock_client import MockLLMClient
        is_mock = isinstance(self._llm, MockLLMClient)
        try:
            recipe = self._llm.generate_recipe(title, servings)
            return recipe, is_mock
        except Exception as e:
            logger.error(f"AI generate_recipe failed: {e}")
            recipe = MockLLMClient().generate_recipe(title, servings)
            return recipe, True

    def assist(self, recipe_title: str, ingredients_text: str, question: str) -> tuple[str, bool]:
        """
        レシピに関する質問に回答する。
        Returns: (answer, is_mock)
        """
        from services.ai.mock_client import MockLLMClient
        is_mock = isinstance(self._llm, MockLLMClient)
        try:
            answer = self._llm.assist(recipe_title, ingredients_text, question)
            return answer, is_mock
        except Exception as e:
            logger.error(f"AI assist failed: {e}")
            answer = MockLLMClient().assist(recipe_title, ingredients_text, question)
            return answer, True


# --- module-level singleton ---
_service: AIService | None = None


def get_ai_service() -> AIService:
    global _service
    if _service is None:
        _service = AIService()
    return _service
