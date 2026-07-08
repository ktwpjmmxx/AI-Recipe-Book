"""
tests/test_ai.py — AI関連エンドポイントのテスト

方針:
  settings.llm_provider のデフォルトは "mock"（config.py参照）なので、
  外部APIキーなしで安全に実行できる。ここでは「AI機能が呼び出せて、
  期待した形のレスポンスを返す」という契約のテストに留め、
  生成AIの出力内容そのもの（文章の中身）はテスト対象にしない
  （LLMの出力は非決定的になり得るため、構造・is_mockフラグを検証する）。

  discover / generate-recipe はDBに依存しないエンドポイントだが、
  一貫性のため他のテストと同じ client フィクスチャ（テスト用DB・
  ChromaDB連携no-op化済み）を使う。
"""


def test_ai_discover_returns_mock_items(client):
    res = client.post("/api/ai/discover", json={"mood": "さっぱり", "max_time": 20})
    assert res.status_code == 200
    body = res.json()
    assert body["is_mock"] is True
    assert isinstance(body["items"], list)


def test_ai_generate_recipe_returns_mock_recipe(client):
    res = client.post("/api/ai/generate-recipe", json={"title": "親子丼", "servings": 2})
    assert res.status_code == 200
    body = res.json()
    assert body["is_mock"] is True
    assert body["title"]  # 何らかのタイトルが返る
    assert isinstance(body["ingredients"], list)
    assert isinstance(body["steps"], list)


def test_ai_generate_recipe_validates_input(client):
    res = client.post("/api/ai/generate-recipe", json={"title": "", "servings": 2})
    assert res.status_code == 422


def test_suggest_menu_with_no_recipes(client):
    """レシピが1件もない状態でも suggest-menu が壊れずに応答できることを確認"""
    res = client.post("/api/ai/suggest-menu", json={"question": "今日の献立は？"})
    assert res.status_code == 200
    body = res.json()
    assert body["is_mock"] is True
    assert "未登録" in body["answer"]


def test_search_assist_with_no_recipes_returns_empty_references(client):
    """
    RAG検索対象のレシピが0件の場合、search_similar_recipes は空リストを返す
    （repositories/vector_repository.py: collection is None または count()==0 の分岐）。
    ChromaDB未インストール環境でも安全にフォールバックすることを確認する。
    """
    res = client.post("/api/ai/search-assist", json={"question": "簡単な副菜が知りたい"})
    assert res.status_code == 200
    body = res.json()
    assert body["is_mock"] is True
    assert body["references"] == []


def test_search_assist_rejects_empty_question(client):
    res = client.post("/api/ai/search-assist", json={"question": ""})
    assert res.status_code == 422
