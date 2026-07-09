# アーキテクチャ

MyRecipeBook のシステム全体構成と、CI・自動テストによる品質保証の位置づけをまとめる。

## 全体構成図

```mermaid
flowchart TB
    subgraph Client["クライアント"]
        UI["React 18 / Vite\n(frontend/src)"]
    end

    subgraph API["FastAPI バックエンド (backend/)"]
        direction TB
        Routers["routers/\nauth・recipes（ai-assist含む）・shopping_lists・ai・misc・public"]
        Services["services/\nai_service.py（AIオーケストレーション）\nrecipe_service.py"]
        Factory["services/ai/factory.py\nLLM_PROVIDER で切替"]
        Clients["mock_client / gemini_client\nopenai_client（未実装）"]
        VecRepo["repositories/vector_repository.py"]
        RecipeRepo["repositories/recipe_repository.py\nshopping_repository.py"]
        Models["models.py（SQLAlchemy）\nnaming_convention 適用済み"]
    end

    subgraph Data["データストア"]
        SQLite[("SQLite\nrecipes.db")]
        Chroma[("ChromaDB\nchroma_data/")]
    end

    subgraph External["外部サービス"]
        Gemini["Google Gemini API\n(gemini-2.5-flash)"]
    end

    subgraph Quality["品質保証基盤"]
        CI["GitHub Actions\nruff → pytest → npm build"]
        Tests["backend/tests/\n29件（auth/recipes/ai）"]
        Alembic["Alembic migrations/\nスキーマのバージョン管理"]
    end

    UI -->|Axios / REST| Routers
    Routers --> Services
    Services --> Factory
    Factory --> Clients
    Clients -->|API呼び出し\n(LLM_PROVIDER=gemini時)| Gemini
    Services --> VecRepo
    Services --> RecipeRepo
    VecRepo --> Chroma
    RecipeRepo --> Models
    Models --> SQLite
    Models -.migrated by.-> Alembic

    CI -.検証.-> Tests
    Tests -.対象.-> Routers
    Tests -.対象.-> Services
```

## レイヤーごとの役割

| レイヤー | 主なファイル | 役割 |
|---|---|---|
| クライアント | `frontend/src/pages`, `hooks`, `components` | React + Vite。i18n（ja/en/tr）、PWA対応 |
| ルーター層 | `backend/routers/*.py` | HTTPエンドポイントの定義。バリデーションのみ担当し、ロジックはservicesに委譲。`recipes.py`の`POST /{recipe_id}/ai-assist`（個別レシピへのAI質問）と`ai.py`の`POST /search-assist`（ライブラリ横断RAG検索）は、対象範囲の違いによりファイルを分離している |
| サービス層 | `backend/services/ai_service.py`, `recipe_service.py` | ビジネスロジックの中心。AIオーケストレーション（Retrieval→Augment→Generation）はここに集約 |
| AIプロバイダ抽象化 | `backend/services/ai/factory.py`, `base.py` | `LLMClient`という共通インターフェースの下に mock / gemini / openai を切替可能な形で実装。環境変数`LLM_PROVIDER`で選択し、APIキー未設定時は自動でmockにフォールバック |
| リポジトリ層 | `backend/repositories/*.py` | DBアクセス（SQLAlchemy）とベクトルDBアクセス（ChromaDB）を分離 |
| データ層 | `models.py` + SQLite / ChromaDB | 構造化データはSQLite、意味検索用の埋め込みはChromaDBに分離して保持 |
| 品質保証 | `.github/workflows/ci.yml`, `backend/tests/`, `backend/migrations/` | pushのたびにlint・テスト・ビルドを自動実行。スキーマ変更はAlembicで追跡可能な形にバージョン管理 |

## 設計上のポイント

- **AIプロバイダの抽象化**: `LLMClient`という抽象基底クラスを介して、mock/Gemini/OpenAIを実装差し替え可能にしている。ポートフォリオゆえのコスト制約（APIキー未設定時）でも、モックにフォールバックしてアプリ全体が壊れない設計。
- **RAGの責務分離**: 「検索(Retrieval)」は`vector_repository.py`、「プロンプト組み立てと生成(Augmented Generation)」は`ai_service.py`／各LLMクライアントに分離しており、検索ロジックとLLM呼び出しロジックが疎結合。
- **失敗時のグレースフルデグラデーション**: ChromaDB未インストール・API障害時も`try/except`で例外を握り潰さず、mock回答にフォールバックしてサービス全体を止めない設計（`ai_service.py`の`search_assist`参照）。
- **品質保証の自動化**: v4.9でpytest 29件・GitHub Actions CIを導入し、「壊れていないこと」を継続的に検証できる体制に移行済み。

## 実装済みだが接続・検証が未完了の箇所（v5.0時点）

- **RAG横断検索（`POST /api/ai/search-assist`）のフロントUI未接続**: バックエンドAPI・`vector_repository.py`側のRetrieval処理は実装済みで動作確認も可能だが、フロントエンドのどの画面からも呼ばれていない。簡易的なUIで妥協せず、本格的なUI/UXを設計した上でPhase 3以降に導入する方針。
- **Gemini API呼び出しの認証エラー**: `services/ai/factory.py`経由でGemini APIを呼び出す際に`401 UNAUTHENTICATED`（`ACCESS_TOKEN_TYPE_UNSUPPORTED`）が発生することを確認済み。上図の「グレースフルデグラデーション」設計により自動的にmock回答へフォールバックしているため機能停止には至っていないが、根本原因の調査はPhase 3以降の課題。
