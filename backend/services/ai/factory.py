"""
services/ai/factory.py — LLMClient Factory

LLM_PROVIDER 環境変数を変えるだけでプロバイダーを切り替えられる。
新しいプロバイダーを追加する場合はここに 1 ケースを追加するだけでよい。

対応プロバイダー:
  openai    : OpenAI GPT シリーズ
  anthropic : Anthropic Claude シリーズ（将来実装）
  mock      : API キー不要のモック（開発・テスト用）
"""
from __future__ import annotations
import logging
from services.ai.base import LLMClient
from config import settings

logger = logging.getLogger(__name__)

_instance: LLMClient | None = None


def get_llm_client() -> LLMClient:
    """シングルトンで LLMClient を返す"""
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

    if provider == "anthropic":
        if not settings.anthropic_api_key:
            logger.warning("LLM_PROVIDER=anthropic だが ANTHROPIC_API_KEY が未設定。mock にフォールバック。")
            return _mock()
        # 将来実装: from services.ai.anthropic_client import AnthropicClient
        raise NotImplementedError("Anthropic クライアントは未実装です。")

    if provider == "mock":
        return _mock()

    logger.warning(f"不明な LLM_PROVIDER: {provider}。mock にフォールバック。")
    return _mock()


def _mock():
    from services.ai.mock_client import MockLLMClient
    logger.info("LLM: Mock（開発モード）")
    return MockLLMClient()
