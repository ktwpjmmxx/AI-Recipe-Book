"""
verify_test_queries.py

フェーズ3（LLM-as-a-judge によるプロンプトバリエーション比較実験）
テストクエリセットの検索結果を一括検証するスクリプト。

目的:
  各テストクエリについて、ChromaDB上のベクトル検索結果(ヒット件数・スコア)を
  実行時点のデータベース状態に対して再現性のある形で記録する。
  出力ログはそのままGitHubのREADME/GrepAIの実験記録に貼り付けることを想定。

実行方法（backend/evaluation/scripts/ ディレクトリ、または backend/ 直下から実行可、
venv有効化した状態で）:
  python verify_test_queries.py
"""

import sys
from pathlib import Path

# backend/ ルートをimportパスに追加（backend/evaluation/scripts/ から2階層上）
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from datetime import datetime
from repositories.vector_repository import search_similar_recipes

# ─────────────────────────────────────────────
# テストクエリセット（9カテゴリ）
# ─────────────────────────────────────────────
TEST_QUERIES = [
    {
        "category": "0件（該当なし）",
        "query": "餃子の作り方を教えて",
        "note": "ハルシネーションせず「見つかりません」と正直に回答できるかを検証",
    },
    {
        "category": "1件相当（大差でノイズを圧倒）",
        "query": "鍋焼きうどんの作り方を教えて",
        "note": "本命との類似度スコア差が大きく、ノイズを無視して本命のみで回答できるかを検証",
    },
    {
        "category": "1件相当（大差でノイズを圧倒・名指し型）",
        "query": "キーマカレーの作り方を教えて",
        "note": "料理名を明示された際、類似ジャンル(カレー)のノイズに惑わされず正確に1件へ絞れるかを検証",
    },
    {
        "category": "僅差の2件拮抗",
        "query": "デザートが食べたい",
        "note": "スコア差がほぼ無い2件に対し、両方を適切に提示できるかを検証",
    },
    {
        "category": "複数候補・属性検索",
        "query": "カレーの作り方を教えて",
        "note": "本命3件+ノイズ1件の中から、カレー3種を過不足なく提示できるかを検証",
    },
    {
        "category": "複数候補・ジャンル横断",
        "query": "スープが飲みたい",
        "note": "和洋のジャンルを跨いだ複数候補を、優先順位をつけて提示できるかを検証",
    },
    {
        "category": "曖昧・情報不足",
        "query": "さっぱりしたもの食べたい",
        "note": "料理名を指定しない曖昧な質問に対し、聞き返す/選択肢提示ができるかを検証",
    },
    {
        "category": "制約付き（フォーマット遵守）",
        "query": "キーマカレーの材料を箇条書きで、手順は3行以内でまとめて",
        "note": "検索結果の件数は参考情報。本題はプロンプト側でのフォーマット遵守の評価",
    },
    {
        "category": "範囲外情報（DBにない情報）",
        "query": "キーマカレーのカロリーを教えて",
        "note": "検索結果の件数は参考情報。本題はDBにないカロリー情報を捏造しないかの評価",
    },
]


def format_score_gap(hits: list[dict]) -> str:
    """上位ヒットと次点のスコア差をコメントとして返す（2件以上ヒットした場合のみ）"""
    if len(hits) < 2:
        return ""
    gap = hits[1]["score"] - hits[0]["score"]
    return f"  → 本命と次点のスコア差: {gap:.4f}"


def main() -> None:
    print("=" * 70)
    print("フェーズ3 テストクエリセット 検証ログ")
    print(f"実行日時: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    for i, item in enumerate(TEST_QUERIES, start=1):
        hits = search_similar_recipes(item["query"], n_results=4)

        print(f"\n[{i}/{len(TEST_QUERIES)}] カテゴリ: {item['category']}")
        print(f"クエリ: 「{item['query']}」")
        print(f"検証観点: {item['note']}")
        print(f"結果: {len(hits)}件ヒット")

        for h in hits:
            print(f"   - {h['title']} (score={h['score']:.4f})")

        print(format_score_gap(hits))
        print("-" * 70)

    print("\n検証完了。")


if __name__ == "__main__":
    main()
