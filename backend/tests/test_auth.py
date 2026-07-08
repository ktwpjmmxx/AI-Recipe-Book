"""
tests/test_auth.py — 認証・アカウント管理のテスト

カバー範囲:
  - 新規登録（成功 / メール重複 / パスワード強度不足）
  - ログイン（成功 / パスワード誤り / 存在しないメール）
  - 現在のユーザー取得（トークンあり/なし）
  - プロフィール更新
  - パスワード変更（成功 / 現在のパスワード誤り / 新旧同一）
"""


def test_register_success(client):
    res = client.post(
        "/api/auth/register",
        json={"email": "new@example.com", "password": "Str0ng!Pass", "display_name": "太郎"},
    )
    assert res.status_code == 201
    body = res.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


def test_register_duplicate_email_returns_409(client):
    payload = {"email": "dup@example.com", "password": "Str0ng!Pass"}
    first = client.post("/api/auth/register", json=payload)
    assert first.status_code == 201

    second = client.post("/api/auth/register", json=payload)
    assert second.status_code == 409


def test_register_weak_password_rejected(client):
    """auth.validate_password_strength() のポリシー（3種類以上の文字種）を確認"""
    res = client.post(
        "/api/auth/register",
        json={"email": "weak@example.com", "password": "abcdefgh"},  # 英小文字のみ
    )
    assert res.status_code == 422


def test_register_short_password_rejected(client):
    res = client.post(
        "/api/auth/register",
        json={"email": "short@example.com", "password": "Ab1!"},  # 8文字未満
    )
    assert res.status_code == 422


def test_login_success(client, make_user):
    email, password, _ = make_user()
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    assert "access_token" in res.json()


def test_login_wrong_password_returns_401(client, make_user):
    email, _, _ = make_user()
    res = client.post("/api/auth/login", json={"email": email, "password": "WrongPass1!"})
    assert res.status_code == 401


def test_login_unknown_email_returns_401(client):
    res = client.post(
        "/api/auth/login",
        json={"email": "nobody@example.com", "password": "Str0ng!Pass"},
    )
    assert res.status_code == 401


def test_me_requires_auth(client):
    res = client.get("/api/auth/me")
    assert res.status_code == 401


def test_me_returns_current_user(client, auth_headers):
    res = client.get("/api/auth/me", headers=auth_headers)
    assert res.status_code == 200
    assert "email" in res.json()


def test_update_profile(client, auth_headers):
    res = client.patch(
        "/api/auth/me",
        json={"display_name": "更新後の名前", "bio": "よろしくお願いします"},
        headers=auth_headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["display_name"] == "更新後の名前"
    assert body["bio"] == "よろしくお願いします"


def test_change_password_success(client, make_user):
    _, password, headers = make_user()
    res = client.patch(
        "/api/auth/me/password",
        json={"current_password": password, "new_password": "N3wStr0ng!Pass"},
        headers=headers,
    )
    assert res.status_code == 204


def test_change_password_wrong_current_returns_401(client, auth_headers):
    res = client.patch(
        "/api/auth/me/password",
        json={"current_password": "WrongOne1!", "new_password": "N3wStr0ng!Pass"},
        headers=auth_headers,
    )
    assert res.status_code == 401


def test_change_password_same_as_current_returns_422(client, make_user):
    _, password, headers = make_user()
    res = client.patch(
        "/api/auth/me/password",
        json={"current_password": password, "new_password": password},
        headers=headers,
    )
    assert res.status_code == 422
