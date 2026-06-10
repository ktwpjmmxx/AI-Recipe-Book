"""
services/recipe_service.py — レシピのビジネスロジック

ドメインロジック（分量計算など）をここに集約することで
フロントエンドとバックエンドの整合性を担保する。
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import Optional


@dataclass
class ScaledIngredient:
    """人数換算済みの材料情報"""
    name:         str
    display:      str       # 表示用文字列（例: "300 g" / "大さじ1" / "適量"）
    is_scalable:  bool      # 人数換算が有効かどうか
    amount_scaled: Optional[float]
    unit:         str


def scale_ingredients(ingredients: list[dict], ratio: float) -> list[ScaledIngredient]:
    """
    材料リストを指定の比率で換算して返す。

    ハイブリッド分量設計:
      - amount_text が存在 → テキストをそのまま表示（換算なし）
      - amount が数値     → ratio をかけて換算
      - どちらもない      → unit のみ表示（「適量」など）

    このロジックは RecipeDetailPage.jsx の displayAmount() と同一仕様。
    バックエンドでも同じ計算が可能なため、将来の PDF 生成・API 返却に再利用できる。
    """
    result: list[ScaledIngredient] = []
    for ing in ingredients:
        name        = ing.get("name", "")
        amount_text = ing.get("amount_text")
        amount      = ing.get("amount")
        unit        = ing.get("unit", "")

        if amount_text:
            # テキストモード（固定表示）
            result.append(ScaledIngredient(
                name=name, display=amount_text, is_scalable=False,
                amount_scaled=None, unit=unit,
            ))
        elif amount is not None and amount > 0:
            # 数値モード（換算あり）
            scaled = amount * ratio
            result.append(ScaledIngredient(
                name=name, display=f"{_fmt(scaled)} {unit}".strip(),
                is_scalable=True, amount_scaled=scaled, unit=unit,
            ))
        else:
            # どちらもない（適量など）
            result.append(ScaledIngredient(
                name=name, display=unit or "適量",
                is_scalable=False, amount_scaled=None, unit=unit,
            ))

    return result


def _fmt(val: float) -> str:
    """浮動小数点を見やすい文字列に変換（1.0 → "1", 1.5 → "1.5"）"""
    if val <= 0:
        return "0"
    if val == int(val):
        return str(int(val))
    f = f"{val:.1f}"
    return f.rstrip("0").rstrip(".")


def build_ingredients_text(ingredients: list[dict]) -> str:
    """AI のプロンプト用に材料リストをテキスト化する"""
    parts = []
    for ing in ingredients:
        name  = ing.get("name", "")
        atext = ing.get("amount_text")
        amt   = ing.get("amount")
        unit  = ing.get("unit", "")
        if atext:
            parts.append(f"{name} {atext}")
        elif amt:
            parts.append(f"{name} {_fmt(amt)}{unit}")
        else:
            parts.append(f"{name} {unit or '適量'}")
    return ", ".join(parts)
