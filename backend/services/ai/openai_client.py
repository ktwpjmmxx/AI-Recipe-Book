"""
services/ai/openai_client.py — OpenAI 実装

LLMClient を継承して OpenAI API を呼び出す。
モデルの切り替えは config.py の LLM_MODEL を変更するだけでよい。
"""
from __future__ import annotations
import json
import logging
from typing import Optional
from services.ai.base import LLMClient, DiscoverItem, GeneratedRecipe
from config import settings

logger = logging.getLogger(__name__)

_CATEGORIES = "和食/洋食/中華/イタリアン/アジアン/副菜/その他"

_DISCOVER_PROMPT = """以下の条件に合う日本の家庭料理を3〜5品提案してください。
条件: {constraints}

必ずJSON形式で返してください。余分なテキストは不要。
{{"recipes":[{{"title":"料理名","category":"{cats}のいずれか","description":"1〜2文","cook_time":数値,"servings":数値}}]}}"""

_GENERATE_PROMPT = """「{title}」({servings}人前)のレシピをJSON形式で返してください。余分なテキストは不要。
{{"title":"{title}","category":"{cats}のいずれか","description":"1〜2文","base_servings":{servings},"prep_time":数値,"cook_time":数値,
"ingredients":[{{"name":"食材名","amount":数値またはnull,"unit":"単位","amount_text":"大さじ1などまたはnull"}}],
"steps":[{{"order":1,"description":"手順","tip":"ヒントまたはnull"}}]}}"""


class OpenAIClient(LLMClient):
    def __init__(self) -> None:
        from openai import OpenAI
        self._client = OpenAI(
            api_key=settings.openai_api_key,
            timeout=settings.llm_timeout,
        )
        self._model = settings.llm_model

    def _chat(self, prompt: str, max_tokens: int = 800) -> str:
        resp = self._client.chat.completions.create(
            model=self._model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
            response_format={"type": "json_object"},
        )
        return resp.choices[0].message.content

    def discover(
        self,
        mood:     Optional[str] = None,
        max_time: Optional[int] = None,
        category: Optional[str] = None,
    ) -> list[DiscoverItem]:
        parts = []
        if mood:     parts.append(f"気分: {mood}")
        if max_time: parts.append(f"調理時間: {max_time}分以内")
        if category: parts.append(f"カテゴリ: {category}")
        constraints = "、".join(parts) if parts else "特になし"

        raw  = self._chat(_DISCOVER_PROMPT.format(constraints=constraints, cats=_CATEGORIES))
        data = json.loads(raw)
        items = data.get("recipes", data.get("items", []))
        return [DiscoverItem(**i) for i in items[:5]]

    def generate_recipe(self, title: str, servings: int) -> GeneratedRecipe:
        raw  = self._chat(
            _GENERATE_PROMPT.format(title=title, servings=servings, cats=_CATEGORIES),
            max_tokens=1400,
        )
        data = json.loads(raw)
        return GeneratedRecipe(**data)

    def assist(self, recipe_title: str, ingredients_text: str, question: str) -> str:
        prompt = (
            f"レシピ「{recipe_title}」（材料: {ingredients_text}）について"
            f"日本語で答えてください。\n質問: {question}"
        )
        from openai import OpenAI
        client = OpenAI(api_key=settings.openai_api_key, timeout=settings.llm_timeout)
        resp = client.chat.completions.create(
            model=self._model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=400,
        )
        return resp.choices[0].message.content
