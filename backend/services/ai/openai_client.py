"""
services/ai/openai_client.py — OpenAI 実装

変更点（RAG対応）:
  - search_assist(): RAG コンテキストを注入したプロンプトで回答を生成
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


# ── RAG プロンプトテンプレート ────────────────────
# 設計のポイント:
#   1. ロールを明示（「パーソナルアシスタント」）
#   2. 参照データの出所を明示（「あなたが登録したレシピ」）
#   3. 範囲外の質問へのフォールバック指示（ハルシネーション防止）
#   4. 回答スタイルの指定（箇条書き・簡潔に）
_RAG_ASSIST_PROMPT = """あなたはユーザーの専用レシピアシスタントです。
以下に示すのは、ユーザーが実際にアプリに登録しているレシピです。
この情報を最大限に活用して、具体的かつ実用的なアドバイスを日本語で回答してください。

【ユーザーの登録レシピ（検索でヒットしたもの）】
{context}

【ユーザーの質問】
{question}

【回答のガイドライン】
- 上記の登録レシピを具体的に参照して回答してください
- 材料名・分量・手順の番号など、具体的な情報を使って答えてください
- 登録レシピに含まれない情報については「このレシピには記載がありませんが、一般的には〜」と前置きしてください
- 回答は読みやすく、適度に改行を入れてください
"""


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

    def _chat_text(self, prompt: str, max_tokens: int = 600) -> str:
        """JSON ではなく自然言語テキストを返す chat 呼び出し"""
        resp = self._client.chat.completions.create(
            model=self._model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
        )
        return resp.choices[0].message.content

    # ── 既存メソッド ─────────────────────────────
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
        data  = json.loads(raw)
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
        """特定レシピへのシンプルなAI質問（RAGなし）"""
        prompt = (
            f"レシピ「{recipe_title}」（材料: {ingredients_text}）について"
            f"日本語で答えてください。\n質問: {question}"
        )
        return self._chat_text(prompt)

    # ── 新規: RAGを使ったライブラリ横断回答 ─────────
    def search_assist(self, question: str, retrieved: list[dict]) -> str:
        """
        RAG の Augmented Generation ステップ。

        retrieved には vector_repository.search_similar_recipes() の
        結果が渡ってくる。各要素は {title, document, score} を持つ。

        設計上の工夫:
          - スコアが良い順（類似度が高い順）にコンテキストを並べる
          - 各レシピに番号を振って「レシピ1: ...」と明示し、
            AIが回答内で「レシピ1の手順3では〜」のように参照しやすくする
        """
        if not retrieved:
            return (
                "登録レシピから関連するものが見つかりませんでした。\n"
                "レシピをさらに追加すると、より詳しくお答えできます。"
            )

        # コンテキストを構築（スコア順に番号を付与）
        context_parts = []
        for i, hit in enumerate(retrieved, 1):
            context_parts.append(
                f"【レシピ{i}: {hit['title']} (関連度スコア: {hit['score']})】\n"
                f"{hit['document']}"
            )
        context = "\n\n".join(context_parts)

        prompt = _RAG_ASSIST_PROMPT.format(context=context, question=question)
        return self._chat_text(prompt, max_tokens=700)
