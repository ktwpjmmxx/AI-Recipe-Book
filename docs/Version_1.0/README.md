# 🍽️ MyRecipeBook

**自分だけのレシピをデジタルで管理する、シンプルで賢いWebアプリ。**

料理写真・材料・手順をまとめて保存し、人数に合わせた分量自動計算やAIアシスタントによる料理サポートを提供します。将来的にはオンライン共有・RAGを活用した献立提案など、日々の料理をもっと楽しくする機能の追加を予定しています。

<br>

## 📸 スクリーンショット

### ホーム画面 — レシピ一覧
カテゴリチップでフィルタ、ソートで並び替え。写真なしのレシピはカテゴリ別のデフォルトアイコンを表示。

![ホーム画面](screenshots/07_home_with_recipe.png)

<br>

### レシピ登録フォーム — 基本情報 & 写真アップロード
料理名・カテゴリ（タップ式ピル）・基準人数・調理時間を入力。写真はその場でプレビューして確認できます。

![フォーム基本情報](screenshots/04_form_photo_ingredients.png)

<br>

### レシピ登録フォーム — 材料 & 手順
食材名・分量・単位をセットで登録。手順にはワンポイントヒントを任意で追加できます。

![フォーム手順入力](screenshots/05_form_steps.png)

<br>

### レシピ詳細 — 人数切り替えで分量を自動換算
プルダウン一つで 0.5人前〜6人前を切り替え。材料の分量がリアルタイムで比例計算されます。

| 2人前で表示 | 6人前に切り替え（自動換算） |
|:---:|:---:|
| ![詳細2人前](screenshots/08_detail_mobile.png) | ![詳細6人前](screenshots/10_serving_selector.png) |

<br>

### AIアシスタント
「みりんの代用は？」「時短テクニックは？」などをその場で質問。OpenAI APIキー設定でGPT-4o-miniが本格回答します（未設定時はモック回答）。

![AIアシスタント](screenshots/09_ai_assistant.png)

<br>

### お気に入り管理
ハートアイコンをタップするだけでお気に入り登録。専用タブで一覧管理できます。

![お気に入り](screenshots/02_favorites.png)

<br>

---

## ✨ 主な機能

| 機能 | 説明 |
|---|---|
| 📝 レシピ管理（CRUD） | 料理名・カテゴリ・材料・手順・写真を登録・編集・削除 |
| 📸 写真アップロード | 料理写真を登録、未設定はカテゴリ別アイコンで表示 |
| 👥 人数別分量計算 | 0.5 / 1 / 2 / 3 / 4 / 6人前をプルダウンで即切り替え |
| 🔍 カテゴリ・ソート | 和食・洋食・中華などで絞り込み、更新日時・料理名でソート |
| ❤️ お気に入り | ハートタップで即登録、専用ページで一覧管理 |
| 🤖 AIアシスタント | レシピに関する質問にAIが回答（RAG対応設計） |
| 📱 モバイル対応 | ボトムナビゲーション採用のモバイルファーストUI |

<br>

---

## 🛠️ 技術スタック

### フロントエンド
| 技術 | バージョン | 用途 |
|---|---|---|
| **React** | 18.3 | UIコンポーネント・State管理 |
| **React Router** | v6 | クライアントサイドルーティング |
| **Vite** | 5.4 | 開発サーバー・ビルドツール |
| **Axios** | 1.7 | バックエンドとのHTTP通信 |

### バックエンド
| 技術 | バージョン | 用途 |
|---|---|---|
| **FastAPI** | 0.115 | REST APIサーバー・自動ドキュメント生成 |
| **SQLAlchemy** | 2.0 | ORM（PythonオブジェクトでのDB操作） |
| **Pydantic** | v2 | リクエスト/レスポンスのバリデーション |
| **SQLite** | — | 開発用データベース（PostgreSQL移行対応済み） |

### AI機能
| 技術 | 用途 |
|---|---|
| **ChromaDB** | レシピのベクトルデータ管理（意味検索用） |
| **OpenAI API** | GPT-4o-miniによる料理Q&A・献立提案 |

<br>

---

## 🏗️ アーキテクチャ

```
ユーザー
  │
  ▼
React (Vite Dev Server :5173)
  │ Proxy転送 (/api/*)
  ▼
FastAPI (:8000)
  ├── SQLAlchemy ──► SQLite (recipes.db)
  │                    └─ レシピデータの永続化
  └── ChromaDB ──────► chroma_data/
                         └─ レシピのベクトルインデックス
                              │
                              ▼
                         OpenAI API (GPT-4o-mini)
                              └─ 自然言語での料理サポート
```

### ディレクトリ構成

```
myrecipebook/
├── backend/
│   ├── main.py              # FastAPI アプリ本体（CRUD + AI エンドポイント）
│   ├── requirements.txt
│   ├── recipes.db           # SQLite DB（起動時自動生成）
│   └── uploads/             # アップロード画像の保存先
│
└── frontend/
    ├── vite.config.js       # Vite設定（APIプロキシ含む）
    └── src/
        ├── App.jsx           # React Router ルーティング定義
        ├── global.css        # アプリ共通スタイル・CSS変数
        ├── api/
        │   └── recipeApi.js  # バックエンド通信レイヤー（Axios）
        ├── components/
        │   ├── BottomNav.jsx  # 共通ボトムナビゲーション
        │   └── RecipeCard.jsx # レシピカード（画像アップロード対応）
        └── pages/
            ├── RecipeListPage.jsx    # 一覧・フィルタ・ソート
            ├── RecipeDetailPage.jsx  # 詳細・人数切り替え・AI相談
            ├── RecipeFormPage.jsx    # 新規作成・編集フォーム
            └── FavoritesPage.jsx     # お気に入り一覧
```

<br>

---

## 🚀 ローカル起動手順

### 必要な環境

- Python 3.10+
- Node.js 18+

### バックエンド

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
# → http://localhost:8000
# → http://localhost:8000/docs  (Swagger UI)
```

### フロントエンド

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### 環境変数（任意）

`backend/.env.example` をコピーして `.env` を作成します。

```env
# OpenAI APIキー（未設定でもモック回答で動作します）
OPENAI_API_KEY=your_key_here

# PostgreSQLに切り替える場合（デフォルトはSQLite）
# DATABASE_URL=postgresql://user:password@localhost:5432/myrecipebook
```

<br>

---

## 📡 APIエンドポイント

| メソッド | パス | 説明 |
|---|---|---|
| `GET` | `/api/recipes` | 一覧取得（カテゴリ・ソート・お気に入り絞り込み） |
| `GET` | `/api/recipes/{id}` | 詳細取得 |
| `POST` | `/api/recipes` | 新規作成 |
| `PATCH` | `/api/recipes/{id}` | 部分更新（分量・手順の修正など） |
| `DELETE` | `/api/recipes/{id}` | 削除 |
| `POST` | `/api/recipes/{id}/image` | 写真アップロード |
| `PATCH` | `/api/recipes/{id}/favorite` | お気に入りトグル |
| `GET` | `/api/categories` | カテゴリ一覧 |
| `POST` | `/api/recipes/{id}/ai-assist` | レシピへのAI質問（RAG） |
| `POST` | `/api/ai/suggest-menu` | 保存レシピを元にした献立提案 |

<br>

---

## 🗺️ 今後の実装予定（ロードマップ）

### 📋 Phase 1 — 調理・買い物サポート
> 日常のキッチンとスーパーで、より使いやすく

- **買い物リスト自動生成** — 選択したレシピ・人数から材料を一覧化。冷蔵庫にあるものを除外できる
- **複数レシピのまとめ買い** — 「今週の献立」を選択すると同じ食材を自動で合算
- **食材の消費期限タグ** — 「今週中に使い切りたい」フラグを立てると、その食材を使うレシピを優先サジェスト

### 🌐 Phase 2 — オンライン化・ソーシャル機能
> レシピをIDで管理し、友人と共有

- **レシピIDによる公開・共有** — `myrecipebook.app/r/00142` 形式でURLシェア
- **ID検索で他人のレシピを閲覧** — 友人のレシピIDを入力して閲覧・自分のブックに追加
- **レシピのフォーク** — 追加したレシピを「自分版」としてコピーして自由に編集
- **PWA化** — オフラインでもレシピ・買い物リストを閲覧・操作可能

### 🤖 Phase 3 — 本格AI連携（RAG）
> 保存レシピを学習した、個人専用の料理アシスタント

- **冷蔵庫の食材から献立を自動提案** — 「今日使いたい食材」を入力すると保存レシピから最適な組み合わせを提案
- **時刻・季節を考慮したサジェスト** — 夕方になると「今夜はどうですか」と自然にサジェスト
- **代替食材・アレルゲン対応** — 「みりんがない」「卵アレルギー対応にしたい」に自動対応
- **料理ログ** — 「今日作った」を記録 → AIが食の偏りをフィードバック

<br>

---

## 💡 活用シーン

| シーン | 活用方法 |
|---|---|
| **夕食の準備中** | 詳細画面のステップをタップしながら進捗管理。手が離せないときはAIに手順を確認 |
| **スーパーでの買い物** | 作りたい料理を選んで人数を設定 → 買い物リスト（Phase 1）で食材を確認しながらショッピング |
| **週末の献立計画** | 複数レシピを選んで材料をまとめて確認。冷蔵庫の余り食材で作れるレシピをAIが提案（Phase 3） |
| **家族・友人との共有** | レシピIDを送るだけで相手のブックに追加。アレンジして自分流にカスタマイズも可能（Phase 2） |

<br>

---

## 🧑‍💻 開発者について

個人開発プロジェクトとして、フルスタック開発・AI連携・UXデザインの実践的な学習を目的に制作しています。

技術的な質問・フィードバック・コラボレーションのご提案はIssueまたはDiscussionsからどうぞ。

<br>

---

## 📄 ライセンス

MIT License — 詳細は [LICENSE](LICENSE) をご覧ください。
