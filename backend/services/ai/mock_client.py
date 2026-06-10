"""
services/ai/mock_client.py — モック LLM クライアント

OPENAI_API_KEY 未設定時や開発環境で使用する。
LLMClient を継承しているため、本番クライアントと差し替えが簡単。
"""
from __future__ import annotations
from typing import Optional
from services.ai.base import LLMClient, DiscoverItem, GeneratedRecipe

_MOCK_ITEMS = [
    DiscoverItem(title="豚キムチ炒め",       category="和食",      description="ピリ辛でご飯がすすむ定番の炒め物。",       cook_time=15, servings=2),
    DiscoverItem(title="ペペロンチーノ",      category="イタリアン", description="にんにくと唐辛子のシンプルなパスタ。",     cook_time=20, servings=2),
    DiscoverItem(title="麻婆豆腐",           category="中華",      description="豆腐と豚ひき肉の旨辛スープが絡む一品。",   cook_time=20, servings=2),
    DiscoverItem(title="ほうれん草の胡麻和え", category="副菜",      description="栄養満点のさっぱりした副菜。",             cook_time=10, servings=4),
    DiscoverItem(title="ガパオライス",        category="アジアン",   description="バジルの香りが食欲をそそるタイ料理。",     cook_time=20, servings=2),
]


class MockLLMClient(LLMClient):
    def discover(
        self,
        mood:     Optional[str] = None,
        max_time: Optional[int] = None,
        category: Optional[str] = None,
    ) -> list[DiscoverItem]:
        items = list(_MOCK_ITEMS)
        if max_time:
            items = [i for i in items if i.cook_time <= max_time]
        if category:
            filtered = [i for i in items if i.category == category]
            items = filtered if filtered else items
        return items[:5]

    def generate_recipe(self, title: str, servings: int) -> GeneratedRecipe:
        return GeneratedRecipe(
            title=title,
            category="和食",
            description=f"{title}の基本レシピです（モックデータ）。",
            base_servings=servings,
            prep_time=10,
            cook_time=20,
            ingredients=[
                {"name": "食材A", "amount": 200.0, "unit": "g",  "amount_text": None},
                {"name": "醤油",  "amount": None,  "unit": "",   "amount_text": "大さじ2"},
                {"name": "砂糖",  "amount": None,  "unit": "",   "amount_text": "小さじ1"},
            ],
            steps=[
                {"order": 1, "description": f"{title}の工程1（モック）。", "tip": None},
                {"order": 2, "description": "調味料を加えて味を調えます。", "tip": "味見しながら調整してください。"},
                {"order": 3, "description": "盛り付けて完成です。", "tip": None},
            ],
        )

    def assist(self, recipe_title: str, ingredients_text: str, question: str) -> str:
        if "時短" in question:
            return "圧力鍋で煮込み時間を1/3に短縮できます。"
        if "代用" in question:
            return "みりん → 砂糖小さじ1＋酒大さじ1で代用できます。"
        return f"「{recipe_title}」へのご質問ありがとうございます。OPENAI_API_KEY を設定すると本格的な回答が得られます。"
