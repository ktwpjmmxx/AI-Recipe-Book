"""
services/ai/base.py — LLMClient 抽象基底クラス

新しいLLMプロバイダーを追加する場合は、このクラスを継承して
discover() / generate_recipe() / assist() を実装するだけでよい。
"""
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass
class DiscoverItem:
    title:       str
    category:    str
    description: str
    cook_time:   int
    servings:    int


@dataclass
class GeneratedRecipe:
    title:         str
    category:      str
    description:   str
    base_servings: int
    prep_time:     int
    cook_time:     int
    ingredients:   list[dict]
    steps:         list[dict]


class LLMClient(ABC):
    """すべての LLM プロバイダーが実装すべきインターフェース"""

    @abstractmethod
    def discover(
        self,
        mood:     Optional[str] = None,
        max_time: Optional[int] = None,
        category: Optional[str] = None,
    ) -> list[DiscoverItem]:
        """条件に合う料理候補を 3〜5 件返す"""
        ...

    @abstractmethod
    def generate_recipe(self, title: str, servings: int) -> GeneratedRecipe:
        """料理名からレシピ全文を生成して返す"""
        ...

    @abstractmethod
    def assist(self, recipe_title: str, ingredients_text: str, question: str) -> str:
        """レシピに関する質問に回答する"""
        ...
