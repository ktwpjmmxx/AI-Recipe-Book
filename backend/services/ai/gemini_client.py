"""
services/ai/gemini_client.py — Google Gemini 実装（最新 google-genai パッケージ修正版）
"""
from __future__ import annotations
import json
import logging
import time
from google.genai import client, types  # 最新パッケージ
from services.ai.base import LLMClient, DiscoverItem, GeneratedRecipe
from config import settings

logger = logging.getLogger(__name__)

_CATEGORIES = "和食/洋食/中華/イタリアン/アジアン/副菜/その他"

_DISCOVER_PROMPT = """以下の条件に合う日本の家庭料理を3〜5品提案してください。
条件: {constraints}

必ずJSON形式のみを出力してください。
{{"recipes":[{{"title":"料理名","category":"{cats}のいずれか","description":"1〜2文","cook_time":数値,"servings":数値}}]}}"""

_GENERATE_PROMPT = """「{title}」({servings}人前)のレシピをJSON形式のみで出力してください。
{{"title":"{title}","category":"{cats}のいずれか","description":"1〜2文","base_servings":{servings},"prep_time":数値,"cook_time":数値,
"ingredients":[{{"name":"食材名","amount":数値またはnull","unit":"単位","amount_text":"大さじ1などまたはnull"}}],
"steps":[{{"order":1,"description":"手順","tip":"ヒントまたはnull"}}]}}"""

_MAX_RETRIES = 3
_RETRY_STATUSES = ("503", "429", "UNAVAILABLE", "RESOURCE_EXHAUSTED")


class GeminiClient(LLMClient):
    def __init__(self) -> None:
        # vertexai=False を明示。未指定だと google-genai SDK は
        # GOOGLE_GENAI_USE_VERTEXAI / GOOGLE_GENAI_USE_ENTERPRISE 環境変数を見て
        # Vertex AI モードに自動的に切り替わることがあり、その場合 api_key（Gemini
        # Developer APIキー）を渡しても認証形式が合わず
        # 401 ACCESS_TOKEN_TYPE_UNSUPPORTED になる。本プロジェクトは
        # Gemini Developer API（無料枠）のみを利用するため常に False で固定する。
        self._client = client.Client(api_key=settings.gemini_api_key, vertexai=False)
        self._model_name = settings.gemini_model

    def _call_with_retry(self, **kwargs) -> object:
        """
        503（過負荷）・429（レート制限）に対してエクスポネンシャルバックオフでリトライする。
        AFC（Automatic Function Calling）は不要なリクエストを防ぐため無効化。
        """
        for attempt in range(_MAX_RETRIES):
            try:
                return self._client.models.generate_content(**kwargs)
            except Exception as e:
                err = str(e)
                is_retryable = any(s in err for s in _RETRY_STATUSES)
                if is_retryable and attempt < _MAX_RETRIES - 1:
                    wait = 2 ** attempt  # 1秒 → 2秒 → 4秒
                    logger.warning(f"Gemini API エラー（{attempt+1}/{_MAX_RETRIES}）、{wait}秒後にリトライ: {e}")
                    time.sleep(wait)
                else:
                    raise

    def _generate_json(self, prompt: str) -> dict:
        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        )

        response = self._call_with_retry(
            model=self._model_name,
            contents=prompt,
            config=config,
        )
        raw = (response.text or "").strip()

        if raw.startswith("```"):
            raw = raw.strip("`")
            if raw.lower().startswith("json"):
                raw = raw[4:].strip()
            logger.info(f"Gemini raw response: {raw}")
        return json.loads(raw)

    def _generate_text(self, prompt: str) -> str:
        config = types.GenerateContentConfig(
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        )

        response = self._call_with_retry(
            model=self._model_name,
            contents=prompt,
            config=config,
        )
        return (response.text or "").strip()

    def discover(self, mood=None, max_time=None, category=None) -> list[DiscoverItem]:
        parts = []
        if mood:
            parts.append(f"気分: {mood}")
        if max_time:
            parts.append(f"調理時間: {max_time}分以内")
        if category:
            parts.append(f"カテゴリ: {category}")
        constraints = "、".join(parts) if parts else "特になし"

        data  = self._generate_json(_DISCOVER_PROMPT.format(constraints=constraints, cats=_CATEGORIES))
        items = data.get("recipes", data.get("items", []))
        return [DiscoverItem(**i) for i in items[:5]]

    def generate_recipe(self, title: str, servings: int) -> GeneratedRecipe:
        data = self._generate_json(_GENERATE_PROMPT.format(title=title, servings=servings, cats=_CATEGORIES))
        return GeneratedRecipe(**data)


        # ── 画像生成（本番運用時に有効化） ──────────────────
    # Imagen 3 を使ってレシピ画像を生成する。
    # 無料枠なし・1枚あたり約$0.03のため、ポートフォリオ環境では無効化中。
    #
    # image_response = self._client.models.generate_images(
    #     model="imagen-3.0-generate-002",
    #     prompt=f"日本の家庭料理「{data['title']}」の美しい料理写真、自然光、白い皿",
    #     config=types.GenerateImagesConfig(
    #         number_of_images=1,
    #         aspect_ratio="4:3",
    #     ),
    # )
    # image_bytes = image_response.generated_images[0].image.image_bytes
    # # → S3やローカルに保存して image_url を GeneratedRecipe に追加する

    def assist(self, recipe_title: str, ingredients_text: str, question: str) -> str:
        prompt = f"レシピ「{recipe_title}」（材料: {ingredients_text}）について回答してください。\n質問: {question}"
        return self._generate_text(prompt)

    def search_assist(self, question: str, retrieved: list[dict]) -> str:
        if not retrieved:
            return "登録レシピから関連するものが見つかりませんでした。"
        context_parts = [f"【レシピ{i}: {hit['title']}】\n{hit['document']}" for i, hit in enumerate(retrieved, 1)]
        context = "\n\n".join(context_parts)
        prompt = (
            "以下の登録レシピを参照して回答してください。\n"
            "「レシピ1」「レシピ2」等の番号は参照用の内部ラベルであり、レシピ同士を区別するためだけのものです。"
            "回答内でこの番号には言及せず、レシピ名（例:「肉じゃが」）で言及してください。\n\n"
            f"【登録レシピ】\n{context}\n\n質問: {question}"
        )
        return self._generate_text(prompt)
