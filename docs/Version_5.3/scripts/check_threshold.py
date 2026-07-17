from repositories.vector_repository import get_collection, _get_query_embedder

c = get_collection()

test_queries = [
    "ナシゴレンのレシピを教えて",
    "玉ねぎを使った料理を教えて",
    "じゃがいもを使った料理",
    "ジャガイモを使った料理",
    "時短で作れる料理ある?",
    "30分以内で作れて卵を使わない料理",
    "牛肉の刺身のレシピは?",
    "あっさりした夕飯のメニュー",
]

threshold_candidates = [0.30, 0.35, 0.40, 0.45, 0.50]

for q in test_queries:
    query_embedding = _get_query_embedder()([q])[0]
    results = c.query(query_embeddings=[query_embedding], n_results=12, include=["metadatas", "distances"])
    dists = results["distances"][0]
    titles = [m["title"] for m in results["metadatas"][0]]

    print(f"\n--- 質問: {q} ---")
    for th in threshold_candidates:
        hit_titles = [t for t, d in zip(titles, dists) if d <= th]
        print(f"  threshold={th}: hits={len(hit_titles)}件 -> {hit_titles[:5]}{'...' if len(hit_titles) > 5 else ''}")
