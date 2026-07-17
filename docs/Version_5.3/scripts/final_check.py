from repositories.vector_repository import get_collection, search_similar_recipes

c = get_collection()
print(f"レシピ総数: {c.count()}")

test_queries = [
    "ナシゴレンのレシピを教えて",
    "玉ねぎを使った料理を教えて",
    "じゃがいもを使った料理",
    "時短で作れる料理ある?",
    "牛肉の刺身のレシピは?",
]

for q in test_queries:
    hits = search_similar_recipes(q)
    print(f"\n質問: {q}")
    print(f"  hits={len(hits)}件 -> {[h['title'] for h in hits]}")
