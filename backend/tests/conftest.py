"""
tests/conftest.py — pytest 共通フィクスチャ

設計方針:
  - 本番用のDB（settings.database_url）とは完全に独立した一時SQLiteファイルを
    テストごとに作成する。本番の recipes.db に一切触れない。
  - main.py には過去の手書きマイグレーション関数（_migrate_add_user_id など）が
    4つ定義されているが、実際にはどこからも呼び出されておらずデッドコードだった
    （3-3で確認済み）。テーブルはすべて Base.metadata.create_all() と
    Alembicマイグレーションで完結しているため、テスト側で特別な配慮は不要。
  - ベクトルDB（ChromaDB）連携（upsert_recipe / vec_delete）は、レシピ作成・更新・
    削除のたびに BackgroundTasks 経由で呼ばれる。TestClient は BackgroundTasks を
    リクエスト完了までに同期実行するため、何もモックしないと実際に ChromaDB の
    初期化が走ってしまう。CRUD のテストではAPIの振る舞い（DBの状態）だけを検証したい
    ため、ここでは no-op に差し替えて副作用を切り離す。
  - LLM 呼び出し（services/ai）は config.py のデフォルト値 llm_provider="mock" を
    そのまま利用する。環境変数を汚さない限り、外部APIキーなしで安全にテストできる。
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# backend/ をモジュール検索パスに追加（routers 等が絶対importのため）
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

# main.py が import 時に settings を読むより先に、テスト用の環境変数を設定する
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_recipes.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")
os.environ.setdefault("LLM_PROVIDER", "mock")

# main.py は起動時に StaticFiles(directory=settings.upload_dir_str) をマウントするが、
# backend/uploads/ は .gitignore 対象でリポジトリに含まれていないため、
# クリーンな環境では存在せず RuntimeError で起動が落ちる（実際に発見したセットアップ上の不備）。
# テストではこの問題を回避しつつ、成果物として不足を記録するため一時ディレクトリを明示的に用意する。
_TEST_UPLOAD_DIR = Path(__file__).resolve().parent / ".tmp_uploads"
_TEST_UPLOAD_DIR.mkdir(exist_ok=True)
os.environ.setdefault("UPLOAD_DIR_STR", str(_TEST_UPLOAD_DIR))


@pytest.fixture(scope="session")
def test_db_path(tmp_path_factory) -> Path:
    return tmp_path_factory.mktemp("db") / "test_recipes.db"


@pytest.fixture()
def client(test_db_path, monkeypatch):
    """
    各テスト関数ごとにまっさらなDBとFastAPIアプリを用意して返す TestClient。

    scope を function にしているのは、テスト間でユーザー登録の重複
    （email UNIQUE制約違反）が起きないようにするため。1本ごとに使い捨てのDBを使う。
    """
    db_file = test_db_path.parent / f"{test_db_path.stem}_{os.getpid()}_{id(monkeypatch)}.db"
    test_engine = create_engine(
        f"sqlite:///{db_file}", connect_args={"check_same_thread": False}
    )
    TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

    import database
    from models import Base

    Base.metadata.create_all(bind=test_engine)

    def _override_get_db():
        db = TestSessionLocal()
        try:
            yield db
        finally:
            db.close()

    import main as app_module

    app_module.app.dependency_overrides[database.get_db] = _override_get_db

    import services.ai_service as ai_service_module

    # ベクトルDB連携（ChromaDB）は副作用切り離しのため no-op化する。
    # フェーズ2でAI機能のデモを別途整理する際に、ここを本物のRAG検証に
    # 差し替えることも可能（その場合は専用のテストを追加する想定）。
    monkeypatch.setattr(app_module.recipes, "upsert_recipe", lambda recipe: None)
    monkeypatch.setattr(app_module.recipes, "vec_delete", lambda recipe_id: None)
    # 検索側も同様に切り離す。本物のChromaDB(recipes_v2)を参照すると、
    # テスト用SQLiteは空でも実際のベクトルDBには本番データが残っており、
    # 「レシピ0件のときreferencesが空になること」の検証が成立しなくなるため。
    # ai_service.py が `from repositories.vector_repository import search_similar_recipes`
    # と書いているため、パッチ対象は vector_repository 側ではなく
    # 実際に呼び出している services.ai_service 側にする必要がある。
    monkeypatch.setattr(ai_service_module, "search_similar_recipes", lambda query, n_results=4: [])

    with TestClient(app_module.app) as c:
        yield c

    app_module.app.dependency_overrides.clear()
    test_engine.dispose()
    db_file.unlink(missing_ok=True)


@pytest.fixture()
def make_user(client):
    """
    ユーザー登録用ヘルパー。呼び出すたびに一意なメールアドレスでユーザーを作る。

    Returns:
        (email, password, auth_headers) のタプル
    """
    counter = {"n": 0}

    def _make(password: str = "Str0ng!Pass") -> tuple[str, str, dict]:
        counter["n"] += 1
        email = f"user{counter['n']}@example.com"
        res = client.post(
            "/api/auth/register",
            json={"email": email, "password": password, "display_name": "テストユーザー"},
        )
        assert res.status_code == 201, res.text
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        return email, password, headers

    return _make


@pytest.fixture()
def auth_headers(make_user):
    """デフォルトの1ユーザーを登録し、認証ヘッダーだけが欲しい場合のショートカット"""
    _, _, headers = make_user()
    return headers
