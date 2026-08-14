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

# ── search_assist のハイブリッドプロンプト切り替えロジック ──────────
# フェーズ3のLLM-as-a-judge実験(8カテゴリ比較)で判明した知見:
#   ・本命が1件に明確に絞れている場合、追加指示(注記等)は冗長になり逆効果
#   ・複数候補が拮抗している場合、区別提示や確認を促す指示が有効
#   ・ただし「作り方を教えて」のように手順を明確に求める質問には、
#     複数候補時でも「確認を促す」指示を入れると逆効果になる
# → 件数/スコア差による機械的な一次分岐 + 拮抗時のみ意図分類で二次分岐する。

# 本命とノイズ(2位)のスコア差がこれ以上あれば「1件相当（明確）」とみなす。
# 実験データ（鍋焼きうどん: 0.133、キーマカレー: 0.123 等）と
# 拮抗ケース（デザート: 0.005、スープ: 0.02 等）の間に十分な余裕を持たせた値。
_SINGLE_CLEAR_SCORE_GAP = 0.08

_INTENT_CLASSIFICATION_PROMPT = """以下のユーザーの質問が、次のどちらに該当するか判定してください。

A: 具体的な手順を明確に求めている（例:「〜の作り方を教えて」「〜のレシピを教えて」「〜の手順は？」）
B: 提案や選択を求めている、または対象が曖昧である（例:「〜が食べたい」「さっぱりしたもの」）

質問: {question}

以下のJSON形式のみで回答してください。前置きや説明は不要です。
{{"intent": "A または B"}}"""


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

    def _build_context(self, retrieved: list[dict]) -> str:
        parts = [f"【レシピ{i}: {hit['title']}】\n{hit['document']}" for i, hit in enumerate(retrieved, 1)]
        return "\n\n".join(parts)

    def _build_prompt_a(self, question: str, context: str) -> str:
        """シンプル版（現行の本番プロンプト）。本命が明確な場合や、手順を明確に求める質問に使う。"""
        return (
            "以下の登録レシピを参照して回答してください。\n"
            "「レシピ1」「レシピ2」等の番号は参照用の内部ラベルであり、レシピ同士を区別するためだけのものです。"
            "回答内でこの番号には言及せず、レシピ名（例:「肉じゃが」）で言及してください。\n\n"
            f"【登録レシピ】\n{context}\n\n質問: {question}"
        )

    # 実験結果(ハイブリッド版8カテゴリ比較)から判明: 「登録情報にカロリー等の
    # 記載がない」旨の注記は、質問がそもそも栄養情報を求めていない場合にまで
    # 一律で付与すると、judgeから「聞かれていないメタ発言」として有用性を
    # 下げる原因になっていた（デザート・スープの2カテゴリで敗因となった）。
    # → 質問文に栄養関連のキーワードが含まれる場合のみ、この指示を注入する。
    _NUTRITION_KEYWORDS = ("カロリー", "栄養", "成分", "糖質", "脂質", "たんぱく質", "タンパク質", "kcal")

    def _mentions_nutrition_info(self, question: str) -> bool:
        return any(keyword in question for keyword in self._NUTRITION_KEYWORDS)

    def _build_prompt_b(self, question: str, context: str) -> str:
        """改善版。複数候補が拮抗し、かつ提案・選択を求める質問に使う。"""
        instructions = [
            "- 質問の意図と関連性が低いレシピが含まれている場合は、それらには言及せず無視してください",
            "- 複数のレシピが質問に合致する場合は、それぞれを簡潔に区別して提示してください（1つに絞り込みすぎないでください）",
            "- 質問が曖昧で対象レシピを一つに特定できない場合は、断定せずにユーザーへ確認を促してください",
        ]
        # 質問が栄養関連の情報を求めている場合のみ、この指示を追加する
        if self._mentions_nutrition_info(question):
            instructions.append(
                "- 登録レシピの情報に記載がない内容（カロリー、栄養素など）については、"
                "断定的に答えず「登録情報には記載がありません」と伝えてください"
            )

        instructions_text = "\n".join(instructions)
        return (
            "以下の登録レシピを参照して回答してください。\n"
            "「レシピ1」「レシピ2」等の番号は参照用の内部ラベルであり、レシピ同士を区別するためだけのものです。"
            "回答内でこの番号には言及せず、レシピ名（例:「肉じゃが」）で言及してください。\n\n"
            f"回答時は以下の点に注意してください:\n{instructions_text}\n\n"
            f"【登録レシピ】\n{context}\n\n質問: {question}"
        )

    def _is_single_clear_result(self, retrieved: list[dict]) -> bool:
        """検索結果が1件のみ、またはスコア差が大きく本命が明確な場合にTrue"""
        if len(retrieved) <= 1:
            return True
        gap = retrieved[1]["score"] - retrieved[0]["score"]
        return gap >= _SINGLE_CLEAR_SCORE_GAP

    def _classify_intent(self, question: str) -> str:
        """
        複数候補が拮抗している場合のみ呼ばれる。質問が手順を明確に求めているか(A)、
        提案・選択を求めているか(B)をGeminiに判定させる。
        判定に失敗した場合は、実害の小さいB（選択肢を提示する側）にフォールバックする。
        """
        try:
            result = self._generate_json(_INTENT_CLASSIFICATION_PROMPT.format(question=question))
            intent = result.get("intent", "B")
            return intent if intent in ("A", "B") else "B"
        except Exception as e:
            logger.warning(f"意図判定に失敗、Bにフォールバックします: {e}")
            return "B"

    def assist(self, recipe_title: str, ingredients_text: str, question: str) -> str:
        prompt = f"レシピ「{recipe_title}」（材料: {ingredients_text}）について回答してください。\n質問: {question}"
        return self._generate_text(prompt)

    def search_assist(self, question: str, retrieved: list[dict]) -> str:
        if not retrieved:
            return "登録レシピから関連するものが見つかりませんでした。"

        context = self._build_context(retrieved)

        if self._is_single_clear_result(retrieved):
            # 本命が明確な場合はシンプル版で即答（余計な注記による有用性の低下を防ぐ）
            prompt = self._build_prompt_a(question, context)
        else:
            # 複数候補が拮抗している場合のみ、意図を判定してプロンプトを切り替える
            intent = self._classify_intent(question)
            prompt = self._build_prompt_a(question, context) if intent == "A" else self._build_prompt_b(question, context)

        return self._generate_text(prompt)
