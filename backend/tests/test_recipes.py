"""
tests/test_recipes.py — レシピ CRUD のテスト

カバー範囲:
  - 作成・一覧・単体取得・更新・削除の基本CRUD
  - 未認証アクセスの拒否
  - 他人のレシピへのアクセス拒否（user_idによる分離）
  - お気に入りトグル

注記:
  作成・更新・削除は BackgroundTasks 経由で ChromaDB 連携（upsert_recipe /
  vec_delete）を呼ぶが、conftest.py の client フィクスチャで no-op に
  差し替え済みのため、ここでは純粋にDBの状態だけを検証する。
"""

_SAMPLE_RECIPE = {
    "title": "肉じゃが",
    "category": "和食",
    "description": "定番の家庭料理",
    "base_servings": 2,
    "prep_time": 10,
    "cook_time": 30,
    "ingredients": [
        {"name": "じゃがいも", "amount": 3, "unit": "個"},
        {"name": "牛肉", "amount": 200, "unit": "g"},
    ],
    "steps": [
        {"order": 1, "description": "じゃがいもを切る"},
        {"order": 2, "description": "煮込む"},
    ],
}


def test_create_recipe(client, auth_headers):
    res = client.post("/api/recipes", json=_SAMPLE_RECIPE, headers=auth_headers)
    assert res.status_code == 201
    body = res.json()
    assert body["title"] == "肉じゃが"
    assert len(body["ingredients"]) == 2
    assert body["is_favorite"] is False


def test_create_recipe_requires_auth(client):
    res = client.post("/api/recipes", json=_SAMPLE_RECIPE)
    assert res.status_code == 401


def test_create_recipe_missing_title_returns_422(client, auth_headers):
    bad = {**_SAMPLE_RECIPE, "title": ""}
    res = client.post("/api/recipes", json=bad, headers=auth_headers)
    assert res.status_code == 422


def test_list_recipes_returns_only_own(client, make_user):
    _, _, headers_a = make_user()
    _, _, headers_b = make_user()

    client.post("/api/recipes", json=_SAMPLE_RECIPE, headers=headers_a)
    client.post("/api/recipes", json={**_SAMPLE_RECIPE, "title": "カレー"}, headers=headers_b)

    res_a = client.get("/api/recipes", headers=headers_a)
    assert res_a.status_code == 200
    titles_a = [r["title"] for r in res_a.json()]
    assert titles_a == ["肉じゃが"]


def test_get_recipe_by_id(client, auth_headers):
    created = client.post("/api/recipes", json=_SAMPLE_RECIPE, headers=auth_headers).json()
    res = client.get(f"/api/recipes/{created['id']}", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["title"] == "肉じゃが"


def test_get_other_users_recipe_returns_404(client, make_user):
    _, _, headers_owner = make_user()
    _, _, headers_other = make_user()

    created = client.post("/api/recipes", json=_SAMPLE_RECIPE, headers=headers_owner).json()
    res = client.get(f"/api/recipes/{created['id']}", headers=headers_other)
    assert res.status_code == 404


def test_update_recipe(client, auth_headers):
    created = client.post("/api/recipes", json=_SAMPLE_RECIPE, headers=auth_headers).json()
    res = client.patch(
        f"/api/recipes/{created['id']}",
        json={"title": "肉じゃが（改良版）", "cook_time": 25},
        headers=auth_headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["title"] == "肉じゃが（改良版）"
    assert body["cook_time"] == 25
    # 更新していないフィールドは維持される
    assert body["category"] == "和食"


def test_delete_recipe(client, auth_headers):
    created = client.post("/api/recipes", json=_SAMPLE_RECIPE, headers=auth_headers).json()
    res = client.delete(f"/api/recipes/{created['id']}", headers=auth_headers)
    assert res.status_code == 204

    res_after = client.get(f"/api/recipes/{created['id']}", headers=auth_headers)
    assert res_after.status_code == 404


def test_toggle_favorite(client, auth_headers):
    created = client.post("/api/recipes", json=_SAMPLE_RECIPE, headers=auth_headers).json()
    assert created["is_favorite"] is False

    res = client.patch(f"/api/recipes/{created['id']}/favorite", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["is_favorite"] is True

    # もう一度呼ぶとトグルで戻る
    res2 = client.patch(f"/api/recipes/{created['id']}/favorite", headers=auth_headers)
    assert res2.json()["is_favorite"] is False


def test_set_visibility_generates_share_path(client, auth_headers):
    created = client.post("/api/recipes", json=_SAMPLE_RECIPE, headers=auth_headers).json()
    res = client.patch(
        f"/api/recipes/{created['id']}/visibility",
        json={"is_public": True},
        headers=auth_headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["is_public"] is True
    assert body["share_id"] is not None
    assert body["share_path"] == f"/r/{body['share_id']}"
