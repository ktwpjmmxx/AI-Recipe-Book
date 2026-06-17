# MyRecipeBook

自分だけのオリジナルレシピをデジタルで管理する、シンプルで賢いWebアプリ。

AIによるレシピ発見・買い物リスト自動生成・時刻と季節を考慮した献立提案を備えたフルスタック個人開発プロジェクトです。実務運用に耐えうる本番グレードのアーキテクチャ・AI連携パターン・モバイルファーストUXの実践的な学習を目的として制作しました。

---

## プロジェクト概要

MyRecipeBook はユーザーが自分のレシピをデジタルで保存・管理・発見できるWebアプリです。最新のアーキテクチャ刷新（v4.0）では、単一ファイルのモノリシック構成から、本番環境への展開とスケールアウトを見据えたレイヤードアーキテクチャへ全面的に再設計しました。

**デザインテーマ:** Honey Gold — 家庭料理の温かさを表現したアンバー系ゴールドのヘッダーパレットを採用。インタラクティブ要素にはブルーを用いて視認性と操作性の対比を明確にしています。

**対象プラットフォーム:** モバイルファースト（最大幅430px）。将来的なReact Native・PWA移行を最初から意識した設計です。

---

## スクリーンショット

### ホーム — AIおすすめ・発見フィード

ライブラリ内のレシピを時間帯・季節・お気に入り状況でスコアリングし、今夜の献立をAIが自動提案します。上部のバナーからAI相談画面にワンタップでアクセスできます。

<img src="screenshots/01_home.png" width="320" alt="ホーム">

### AIレシピ発見

気分・調理時間・カテゴリを選択するとAIが3〜5品を提案し、タップするだけで材料・手順・ヒントを含むレシピ全文を生成します。

| 条件入力 | AI提案リスト |
|:---:|:---:|
| <img src="screenshots/02_discover_filter.png" height="450" alt="AI相談フィルター"> | <img src="screenshots/03_discover_results.png" height="450" alt="AI提案"> |

### レシピ詳細 — 人数換算と手順チェック

人数ステッパーを操作すると数値入力の材料が即座に換算されます。テキストモード（「大さじ2」など）で登録した材料は「固定」と明示され換算対象外となります。この仕様はバックエンドとフロントエンドで同一のドメインロジックとして実装されています。

<img src="screenshots/04_detail.png" width="320" alt="レシピ詳細">

### 買い物リスト — 在庫差し引き計算

レシピ詳細から現在の人数設定のまま買い物リストを生成できます。手元の在庫量を入力すると必要購入量から自動差し引きします。

| 在庫入力 | 最終リスト |
|:---:|:---:|
| <img src="screenshots/05_shopping_deduct.png" height="450" alt="残量入力"> | <img src="screenshots/06_shopping_list.png" height="450" alt="買い物リスト"> |

---

## アーキテクチャ

### システム全体図

```
ブラウザ / モバイル
      │
      │  HTTP REST（Axios・タイムアウト: 30秒）
      ▼
┌─────────────────────────────────────────────────┐
│  React + Vite（:5173）                          │
│                                                 │
│  pages/         — JSX 描画のみ                  │
│  hooks/         — 状態管理・API通信             │
│  components/    — 再利用UIパーツ                │
│  api/recipeApi  — Axiosクライアント             │
└───────────────────┬─────────────────────────────┘
                    │  /api/* プロキシ転送
                    ▼
┌─────────────────────────────────────────────────┐
│  FastAPI（:8000）                               │
│                                                 │
│  routers/       — HTTPエンドポイント・バリデーション│
│      └── schemas.py（Pydantic）                 │
│  services/      — ビジネスロジック              │
│      └── ai/    — LLMオーケストレーション       │
│          ├── base.py      （抽象インターフェース）│
│          ├── factory.py   （プロバイダー選択）  │
│          ├── openai_client.py                   │
│          └── mock_client.py                     │
│  repositories/  — データアクセス               │
│      ├── recipe_repository.py  （SQLAlchemy）   │
│      ├── shopping_repository.py                 │
│      └── vector_repository.py （ChromaDB）      │
│  models.py      — ORM テーブル定義             │
│  config.py      — 環境変数（pydantic-settings） │
│  database.py    — エンジン・セッション管理      │
└──────────────┬───────────────┬─────────────────┘
               │               │
               ▼               ▼
        SQLite / PG        ChromaDB
        （レシピ・         （ベクターインデックス
         買い物リスト）      RAG基盤）
               │
               ▼
        OpenAI / Anthropic / Mock
        （LLM_PROVIDER 環境変数で切り替え）
```

### バックエンド — レイヤードアーキテクチャ

以前のバージョンでは、ルーティング・ビジネスロジック・AI処理・DB操作がすべて `main.py` 1ファイル（約600行）に混在していました。これを4つの独立したレイヤーに分割しました。

| レイヤー | ディレクトリ | 責務 |
|---|---|---|
| Router層 | `routers/` | HTTPリクエストの受付・Pydanticバリデーション・レスポンス変換 |
| Service層 | `services/` | ビジネスロジック（人数換算・材料テキスト生成など） |
| AIオーケストレーション層 | `services/ai/` | プロンプト構築・LLM呼び出し・エラー処理・フォールバック |
| Repository層 | `repositories/` | DBおよびベクターDBへのアクセスを完全に隠蔽 |

各レイヤーは直下のレイヤーにのみ依存します。RouterはDBに直接アクセスせず、ServiceはHTTPレスポンスを生成しません。

### フロントエンド — Custom Hooksパターン

ページコンポーネント内に大量の `useState`・インラインAxios通信・サブコンポーネント定義が同居していた状態を解消しました。

| 変更前 | 変更後 |
|---|---|
| `DiscoverPage.jsx` 約450行 | `DiscoverPage.jsx` 約180行（描画のみ） |
| `RecipeDetailPage.jsx` 約380行 | `RecipeDetailPage.jsx` 約200行（描画のみ） |
| `SuggestionCard` をページ内に定義 | `components/SuggestionCard.jsx` として独立 |
| `AIPanel` をページ内に定義 | `components/AIPanel.jsx` として独立 |
| 関心の分離なし | `hooks/useDiscover.js`、`hooks/useRecipeDetail.js` |

---

## 主要な設計判断

### LLMプロバイダー抽象化（Factoryパターン）

AIプロバイダーの切り替えは環境変数を変えるだけで完結します。アプリケーションコードの変更は一切不要です。

```
LLM_PROVIDER=openai     → OpenAIClient   （GPT-4o-mini）
LLM_PROVIDER=anthropic  → AnthropicClient（Claude）— インターフェース定義済み・実装準備中
LLM_PROVIDER=mock       → MockLLMClient  （APIキー不要）
```

抽象基底クラス `LLMClient` は `discover()`・`generate_recipe()`・`assist()` の3メソッドを定義しており、すべてのプロバイダーはこれを実装します。新しいプロバイダーを追加する場合は `LLMClient` を継承した新しいファイルを1つ作成し、`factory.py` にケースを追加するだけです。

```python
# 新プロバイダーの追加は factory.py の1箇所のみ変更
if provider == "anthropic":
    from services.ai.anthropic_client import AnthropicClient
    return AnthropicClient()
```

### Repositoryパターン（DB操作の隠蔽）

SQLAlchemyのクエリはすべてRepositoryクラスに集約されています。アプリケーションの他の部分は `Session` をインポートせず、SQLを直接記述しません。これにより：

- SQLiteからPostgreSQLへの移行は `DATABASE_URL` の変更だけで完了します
- ビジネスロジックのテスト時にRepositoryをモックに差し替えることができます

### 分量計算ロジックのドメイン知識共有

材料の表示ロジック（数値はサービング比率で換算・テキストモードは固定表示）は、`services/recipe_service.py`（Python）と `hooks/useRecipeDetail.js`（JavaScript）の両方に同一仕様で実装されています。

将来のPDF出力・買い物リスト集計・献立提案などバックエンド側で材料リストを扱う機能が増えても、フロントエンドの表示と一貫性が保たれます。

### AI通信の堅牢性

| リスク | 対策 |
|---|---|
| AI応答が長時間かかる | Axios `timeout: 30000`。タイムアウト時は画面が固まらず読みやすいエラーメッセージをUI表示 |
| LLMが不正なJSONを返す | optional chaining（`?.`）をAI応答消費箇所に徹底適用。`TypeError` クラッシュを防止 |
| LLM APIが利用不可 | `AIService` が全例外をキャッチして自動的に `MockLLMClient` にフォールバック |
| 大容量画像がメモリを圧迫 | チャンク読み込み（65,536バイト単位）によるストリーミング書き込みでメモリ上に全展開しない |

### BackgroundTasksによる非同期インデックス

ChromaDBへの書き込みはFastAPIの `BackgroundTasks` で非同期実行します。HTTPレスポンスはすぐにクライアントへ返り、ベクターインデックス処理はリクエストスレッドをブロックせずに後続で実行されます。

```python
@router.post("")
def create_recipe(body: RecipeCreate, background_tasks: BackgroundTasks, ...):
    recipe = repo.create(data)
    background_tasks.add_task(upsert_recipe, recipe)   # ノンブロッキング
    return _to_out(recipe)
```

---

## 技術スタック

### フロントエンド

| 技術 | バージョン | 用途 |
|---|---|---|
| React | 18.3 | コンポーネントモデル・状態管理 |
| React Router | v6 | クライアントサイドルーティング（SPA） |
| Vite | 5.4 | 開発サーバー・ビルド・APIプロキシ |
| Axios | 1.7 | HTTPクライアント（タイムアウト・インターセプター） |

### バックエンド

| 技術 | バージョン | 用途 |
|---|---|---|
| FastAPI | 0.115 | REST APIサーバー・自動OpenAPIドキュメント |
| SQLAlchemy | 2.0 | ORM・データベース抽象化 |
| Pydantic v2 | 2.x | リクエスト・レスポンスのバリデーション |
| pydantic-settings | 2.x | 型付き環境変数管理 |
| SQLite | — | デフォルトDB（PostgreSQL移行対応済み） |

### AI機能

| 技術 | 用途 |
|---|---|
| ChromaDB | ベクターストア（意味検索・RAG基盤） |
| OpenAI API | GPT-4o-miniによるレシピ生成・発見・料理Q&A |

---

## ディレクトリ構成

```
myrecipebook/
├── backend/
│   ├── main.py                    # エントリポイント（約50行・ルーターのマウントのみ）
│   ├── config.py                  # 全環境変数の一元管理
│   ├── database.py                # エンジン・セッションファクトリー
│   ├── models.py                  # SQLAlchemy ORM定義
│   ├── requirements.txt
│   ├── .env.example
│   ├── recipes.db                 # SQLite（初回起動時に自動生成）
│   ├── uploads/                   # アップロード画像の保存先
│   ├── repositories/
│   │   ├── recipe_repository.py
│   │   ├── shopping_repository.py
│   │   └── vector_repository.py
│   ├── services/
│   │   ├── recipe_service.py      # 人数換算・材料テキスト化ロジック
│   │   ├── ai_service.py          # AIオーケストレーションとフォールバック
│   │   └── ai/
│   │       ├── base.py            # LLMClient 抽象インターフェース
│   │       ├── factory.py         # 環境変数によるプロバイダー選択
│   │       ├── openai_client.py   # OpenAI実装（差し替え可能）
│   │       └── mock_client.py     # モック実装（APIキー不要）
│   └── routers/
│       ├── schemas.py             # 全Pydanticスキーマ
│       ├── recipes.py
│       ├── shopping_lists.py
│       ├── ai.py
│       └── misc.py
│
└── frontend/
    ├── vite.config.js
    └── src/
        ├── App.jsx
        ├── global.css             # CSS変数・Honey Goldテーマ
        ├── api/
        │   └── recipeApi.js       # Axiosクライアント（タイムアウト・インターセプター）
        ├── hooks/
        │   ├── useRecipes.js      # レシピ一覧の状態・API通信
        │   ├── useRecipeDetail.js # 詳細・換算・手順管理・AIパネル
        │   └── useDiscover.js     # AI発見フロー全体のステートマシン
        ├── components/
        │   ├── BottomNav.jsx      # ナビゲーションバー + FAB
        │   ├── RecipeCard.jsx     # カード（インライン画像アップロード対応）
        │   ├── SuggestionCard.jsx # AI提案カード（切り出し）
        │   └── AIPanel.jsx        # AIチャットパネル（切り出し）
        └── pages/
            ├── HomePage.jsx
            ├── LibraryPage.jsx
            ├── FavoritesPage.jsx
            ├── DiscoverPage.jsx
            ├── ShoppingListPage.jsx
            ├── SavedShoppingListPage.jsx
            ├── RecipeDetailPage.jsx
            └── RecipeFormPage.jsx
```

---

## ローカル起動手順

### 必要な環境

- Python 3.10+
- Node.js 18+

### バックエンド

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
# API:  http://localhost:8000
# Docs: http://localhost:8000/docs
```

### フロントエンド

```bash
cd frontend
npm install
npm run dev
# App: http://localhost:5173
```

### 環境変数

`backend/.env.example` を `backend/.env` としてコピーして設定します。

```env
# LLMプロバイダー: openai | anthropic | mock（デフォルト）
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini

# LLM_PROVIDER=openai の場合に必要
OPENAI_API_KEY=sk-...

# DBの切り替え（デフォルトはSQLite）
# DATABASE_URL=postgresql://user:pass@localhost:5432/myrecipebook
```

APIキー未設定でも `LLM_PROVIDER=mock` で全機能が動作します。UIの全フローをローカルで確認できます。

> **2回目以降の起動**
> ```bash
> # ターミナル①（バックエンド）
> cd backend && venv\Scripts\activate && uvicorn main:app --reload
> # ターミナル②（フロントエンド）
> cd frontend && npm run dev
> ```

---

## APIエンドポイント

### レシピ

| メソッド | パス | 説明 |
|---|---|---|
| `GET` | `/api/recipes` | 一覧取得（カテゴリ・ソート・お気に入り絞り込み） |
| `GET` | `/api/recipes/{id}` | 詳細取得 |
| `POST` | `/api/recipes` | 新規作成（ベクターインデックスをBackgroundTasksで非同期更新） |
| `PATCH` | `/api/recipes/{id}` | 部分更新 |
| `DELETE` | `/api/recipes/{id}` | 削除（ベクターインデックスも非同期削除） |
| `POST` | `/api/recipes/{id}/image` | ストリーミング画像アップロード |
| `PATCH` | `/api/recipes/{id}/favorite` | お気に入りトグル |
| `POST` | `/api/recipes/{id}/ai-assist` | レシピへのAI質問 |

### 買い物リスト

| メソッド | パス | 説明 |
|---|---|---|
| `POST` | `/api/shopping-lists` | リストを保存 |
| `GET` | `/api/shopping-lists` | 保存済みリスト一覧（新しい順） |
| `GET` | `/api/shopping-lists/{id}` | リスト詳細 |
| `PATCH` | `/api/shopping-lists/{id}/items` | チェック状態などを更新 |
| `DELETE` | `/api/shopping-lists/{id}` | 削除 |

### AI

| メソッド | パス | 説明 |
|---|---|---|
| `POST` | `/api/ai/discover` | 気分・時間・カテゴリから料理候補を提案 |
| `POST` | `/api/ai/generate-recipe` | 料理名からレシピ全文を生成 |
| `POST` | `/api/ai/suggest-menu` | 保存レシピを元にした献立提案 |

### ユーティリティ

| メソッド | パス | 説明 |
|---|---|---|
| `GET` | `/api/categories` | ライブラリに存在するカテゴリ一覧 |
| `GET` | `/health` | ヘルスチェック（アクティブなLLMプロバイダーを含む） |

---

## 主な機能

| 機能 | 説明 |
|---|---|
| レシピ管理（CRUD） | 料理名・カテゴリ・材料・手順・写真の登録・編集・削除 |
| カテゴリバッジ | ジャンルごとに色分けされたバッジ |
| 人数換算 | ステッパー操作で数値材料をリアルタイム換算 |
| ハイブリッド分量入力 | 数値モード（換算あり）と自由テキストモード（固定）を材料ごとに選択 |
| 手順チェック | タップで完了マーク。進捗バーで残り工程を把握 |
| ライブラリ | 追加日・ジャンル・五十音・調理時間の4軸ソート＋リアルタイム検索 |
| お気に入り | ハートタップで即登録・専用タブで一覧管理 |
| AIアシスタント | 保存レシピへの質問に回答（RAG対応設計） |
| AIレシピ発見 | 気分・時間・カテゴリでフィルタリングしてAIが料理提案→全文生成 |
| AIおすすめフィード | 時間帯・季節・お気に入りスコアによる献立自動提案 |
| 買い物リスト | 在庫差し引き計算・チェックリスト・永続保存 |
| モバイルファーストUI | ボトムナビ＋FABボタン。PWA・React Native移行を見据えた設計 |

---

## ロードマップ

### Phase 1 — 調理・買い物サポート

- [x] 買い物リスト自動生成（在庫差し引き・永続保存）
- [x] 時刻・季節ベースのAIサジェスト
- [x] AIレシピ発見・評価・ライブラリ保存
- [ ] 食材の消費期限タグと期限切れ優先サジェスト

### Phase 2 — オンライン化・ソーシャル機能

- [ ] レシピIDによる公開・URL共有（例: `/r/00142`）
- [ ] 友人のレシピIDを入力して閲覧・フォーク
- [ ] PWA化（オフライン対応）
- [ ] 料理ログとAIによる食の偏りフィードバック

### Phase 3 — 本格RAG連携

ChromaDBのセットアップはすでに完了しています。Phase 3ではこれを本格的に活用します。

- [ ] 冷蔵庫の食材からベクター検索で献立を提案
- [ ] 「みりんがない」などの代替食材をセマンティック検索で回答
- [ ] 料理ログの栄養バランス分析
- [ ] ユーザークラスタリングによるホームフィードのトレンド表示

レイヤードアーキテクチャへの移行により、Phase 3の機能追加はServiceクラスの追加のみで完結します。RouterやModel層の変更は不要です。

---

## 開発者について

フルスタック開発・AI連携パターン・モバイルファーストUX・アーキテクチャ設計と実装速度のトレードオフを実践的に学ぶために制作した個人開発プロジェクトです。

技術的な質問・フィードバック・コラボレーションのご提案はIssueまたはDiscussionsからどうぞ。

---

## ライセンス

MIT License — 詳細は [LICENSE](LICENSE) をご覧ください。
