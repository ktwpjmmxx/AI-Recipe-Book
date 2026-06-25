"""
services/ai/factory.py — LLMClient Factory

v4.5 変更:
  - LLM_PROVIDER=gemini の分岐を追加
    （Google Gemini API の無料枠を利用するプロバイダー。
     ポートフォリオのデモ用途として、追加コストなしでAI機能を
     紹介する目的で採用。本番運用で不特定多数のユーザーを
     想定する場合は無料枠の制限により不適切である点に注意。）
"""
from __future__ import annotations
import logging
from services.ai.base import LLMClient
from config import settings

logger = logging.getLogger(__name__)

_instance: LLMClient | None = None


def get_llm_client() -> LLMClient:
    global _instance
    if _instance is not None:
        return _instance
    _instance = _create()
    return _instance


def _create() -> LLMClient:
    provider = settings.llm_provider.lower()

    if provider == "openai":
        if not settings.openai_api_key:
            logger.warning("LLM_PROVIDER=openai だが OPENAI_API_KEY が未設定。mock にフォールバック。")
            return _mock()
        from services.ai.openai_client import OpenAIClient
        logger.info(f"LLM: OpenAI ({settings.llm_model})")
        return OpenAIClient()

    if provider == "gemini":
        if not settings.gemini_api_key:
            logger.warning("LLM_PROVIDER=gemini だが GEMINI_API_KEY が未設定。mock にフォールバック。")
            return _mock()
        from services.ai.gemini_client import GeminiClient
        logger.info(f"LLM: Gemini ({settings.gemini_model}) — 無料枠運用・ポートフォリオ用途")
        return GeminiClient()

    if provider == "anthropic":
        if not settings.anthropic_api_key:
            logger.warning("LLM_PROVIDER=anthropic だが ANTHROPIC_API_KEY が未設定。mock にフォールバック。")
            return _mock()
        raise NotImplementedError("Anthropic クライアントは未実装です。")

    if provider == "mock":
        return _mock()

    logger.warning(f"不明な LLM_PROVIDER: {provider}。mock にフォールバック。")
    return _mock()


def _mock():
    from services.ai.mock_client import MockLLMClient
    logger.info("LLM: Mock（開発モード）")
    return MockLLMClient()
