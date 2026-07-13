# フェーズ3 対応まとめ（v5.0 → v5.1想定）

対象リポジトリ: `ktwpjmmxx/AI-Recipe-Book`
対応期間: フェーズ2完了後の6項目対応
本ドキュメントの目的: 各対応の「なぜそう直したか」を簡潔に記録し、次回のREADME統合・面接説明の材料とする。

---

## 1. lint既存違反の解消

**内容**
`backend/pyproject.toml` の `ignore` リストを `E701 / E702 / E712 / E401` から `E501` のみに縮小。`per-file-ignores`（未使用importの個別許容）は撤廃。

**対応した違反（計20件、動作に影響しない純粋なスタイル修正）**
- E701（`if x: y` の1行複数ステートメント）16件 → 2行に分割
- E712（`== True` の比較）2件 → 真偽値の直接評価に変更
- E702（`;` 区切りの複数ステートメント）2件 → 2行に分割
- F401（未使用import）2件 → `routers/recipes.py` の `RecipeORM`、`services/ai/gemini_client.py` の `Optional` を削除

**あえて対応しなかったもの**
- E501（行長）25件：日本語のAIプロンプトテンプレート文字列が意図的に長いため、無理に折り返すとかえって可読性が落ちる。ignoreとして明示的に残す判断とした。

**検証**：`ruff check .`（ignore=E501のみ）で全件パス。pytest 29件も影響なし。

---

## 2. Gemini API認証エラーの調査・修正

**発見した根本原因は2つ**

1. **パッケージの不整合**：`requirements.txt` は旧SDK `google-generativeai==0.8.3` を固定していたが、実際のコード（`gemini_client.py`）は新SDK `google.genai` を`import`していた。旧SDKでは`google.genai`名前空間は提供されないため、`requirements.txt`通りに再インストールすると本来動かないはずの状態だった（実際に検証環境で再現：`ModuleNotFoundError`）。
2. **Vertex AIモードへの自動切り替え**：`google-genai` SDKのソースを直接確認したところ、`vertexai`引数を明示しない場合、環境変数 `GOOGLE_GENAI_USE_VERTEXAI` / `GOOGLE_GENAI_USE_ENTERPRISE` を見て自動的にVertex AIモードに切り替わる仕様だった。この場合、Gemini Developer APIキーを渡しても認証形式が合わず `401 ACCESS_TOKEN_TYPE_UNSUPPORTED` になる。

**修正内容**
- `requirements.txt`：`google-generativeai==0.8.3` → `google-genai==2.11.0`
- `services/ai/gemini_client.py`：`Client(api_key=..., vertexai=False)` を明示指定し、環境変数による自動判定の影響を受けないようにした

**追加調査で判明した本当の原因（当初の運用判断は誤りだった）**
上記修正後、実際に無料枠APIキーで動作検証したところ `429 RESOURCE_EXHAUSTED`（`limit: 0`）が発生。当初は「請求先アカウントが紐付いていないGoogle Cloudプロジェクトは無料利用枠が実質0に制限される」というGoogle側の仕様と判断し、mockフォールバックを正式仕様として採用する方針としていた。

しかし、別端末での最終検証時にあらためて調査したところ、設定していた`gemini-2.0-flash`が**2026年6月1日付で正式に廃止（shutdown）されていた**ことが判明。`gemini-2.5-flash`（新規ユーザー利用不可、404）→`gemini-3.5-flash`の順に切り替えて検証し、`gemini-3.5-flash`で実際にAIが生成した回答（`is_mock: false`）を確認できた。**請求先アカウントの紐付けは不要だった。** `config.py`の`gemini_model`のデフォルト値を`gemini-3.5-flash`に更新し、mockフォールバックは「LLM呼び出し失敗時の保険」という本来の位置付けに戻した。

教訓：「動かない」エラーに対してもっともらしい仮説（billingの問題）を先に立ててしまうと、そこで調査が止まりやすい。外部サービスのバージョン・ライフサイクル情報は一次情報（公式ドキュメントの変更履歴）で確認してから結論を出すべきだった。

---

## 3-a. バックエンドの統一エラーレスポンス

**設計方針**：既存の全routerの `raise HTTPException(status_code, "message")` の呼び出し箇所は**1つも変更せず**、`main.py`側の共通例外ハンドラだけで `{"error": {"code": ..., "message": ...}}` 形式に統一した。

**理由**：既存pytest 29件を確認したところ、エラーレスポンスの中身（`detail`キー等）を検証しているテストが1件もなく、`status_code`のみの検証だったため、router側を触らずに安全に移行できると判断した。

**追加内容**
- 新規 `backend/errors.py`：エラーコード変換ヘルパー
- `main.py`：`StarletteHTTPException` / `RequestValidationError` / 想定外の`Exception`（500）用の3つのハンドラを追加
- 想定外の例外は詳細をログにのみ出力し、クライアントには`INTERNAL_ERROR`のみ返すことで内部情報の漏洩を防止

---

## 4. OpenAPI/Swaggerドキュメント整備

全22エンドポイントに`summary`と、エラーが起こりうるエンドポイントには`responses`（統一エラー形式のレスポンス例）を付与。`openapi_tags`でタグごとの説明も追加。

`POST /api/recipes/{recipe_id}/ai-assist` と `POST /api/ai/search-assist` には、「LLM呼び出し失敗時も例外を投げず常に200 OK＋`is_mock`で判別する」という設計意図を`description`に明記した（Swagger UIを見ただけでAPI利用者がこの設計を理解できるようにするため）。

---

## 3-b. フロントエンドのtoast通知・フォールバック表示

**前提の整理**：AI呼び出し（discover/generate-recipe/ai-assist/search-assist）はバックエンド側で常に例外を捕捉しmockにフォールバックする設計のため、「AI呼び出し失敗時の通知」は実際には**HTTPエラーの捕捉ではなく`is_mock`フラグの検知**として実装した。

**実装内容**
- 外部ライブラリを追加せず、`ToastContext` + `Toast`コンポーネントを自前実装
- `recipeApi.js` に `getApiErrorMessage()` を追加し、3-aで統一したエラー形式からメッセージを取り出せるようにした
- レシピ詳細のAIチャット（`useAIPanel`）：今まで`is_mock`を一切見ておらずモック応答でも無表示だった箇所に、toast通知を新規追加
- `useDiscover.js`：呼び出し失敗時にtoastを追加。ただし`is_mock`時の固定バナー（既存実装）は変更せず維持（toastとの二重通知による煩雑さを避けるため）

---

## 5. search-assist（RAGライブラリ横断検索）UI実装

**配置の設計判断**：当初はHomePageへのバナー追加（既存ページへの影響が少ない）も案として提示したが、「本リポジトリのAI活用のメイン機能」という位置づけであるとの方針を受け、**BottomNavの5番目のタブとして常時アクセス可能な形**を採用。ホームの次（2番目）に配置し、視認性を優先した。

**ネーミングの整理**：既存の「検索」（レシピタイトルの単純フィルタ）と、新規のAI検索（RAGによる意味検索＋回答生成）が混同されないよう、既存機能側の表記を「レシピ内を検索…」に変更し、新機能を「AI検索」として明確に区別した（3言語対応：ja/en/tr）。

**スコア表示の設計判断**：バックエンドの`score`フィールドは「コサイン距離（小さいほど類似）」であり、そのまま`%`表示すると誤解を招くため、フロントエンド側で `関連度% = (1 - score) × 100` に変換して表示する設計とした（バックエンドのAPI仕様は変更していない）。

---

## 実機に近い検証（Playwright + Chromiumによる統合テスト）

サンドボックス内でバックエンド・フロントエンドを実際に起動し、ブラウザ経由で以下を確認した。

- 新規登録 → ログイン → ホーム表示（コンソールエラーなし）
- BottomNav 5タブのレイアウト（390px幅で崩れなし）
- AI検索ページ（空状態／モック回答＋参照なし状態）
- レシピ詳細のAIチャットでのtoast通知表示
- Discoverページの既存動作に回帰がないこと

**環境起因と判断した1件**：`search-assist`の参照レシピが常に空で返った件を調査したところ、ChromaDBの埋め込みモデル（ONNXファイル）のダウンロードがサンドボックスのネットワーク制限により失敗していたことが原因と判明（SHA256不一致、ダウンロードサイズが本来数十MBのところ122バイトしか取得できていなかった）。コードの問題ではなくサンドボックス環境の制約と判断した。

**その後、実際に別端末・実データでの最終検証を実施し、以下を発見・修正した：**

1. **AI検索ページでFABが参照レシピカードに重なる不具合**：`BottomNav.jsx`が全ページ共通で「レシピを追加」FABを描画する設計だったため、参照レシピが複数件表示されるAI検索ページで、画面下部のカードとFABが重なり関連度%が読めなくなっていた。AI検索ページ（`/ai-search`）でのみFABを非表示にする条件分岐を追加して解消。
2. **`requirements.txt`のエンコーディング問題**：日本語Windows環境で`pip install -r requirements.txt`が`UnicodeDecodeError`で失敗。コメント中の装飾文字（box drawing文字）がロケール依存のエンコーディング（`cp932`）で誤読されたことが原因。ファイル先頭に`# -*- coding: utf-8 -*-`を追加して解消（`requirements-dev.txt`も同様の問題があり同じ対応）。
3. **`pydantic`のバージョン競合**：クリーンインストール環境で`google-genai==2.11.0`が要求する`pydantic>=2.12.5`と、固定していた`pydantic==2.9.2`が衝突。`pydantic==2.13.4`に引き上げて解消。
4. **`httpx`のバージョン競合**：同様に`requirements-dev.txt`の`httpx==0.27.2`固定が`google-genai`の要求する`httpx>=0.28.1`と衝突。`httpx==0.28.1`に引き上げて解消。

最終的に、実データ（食材を意図的に重複させた5レシピ）でAI検索の参照レシピが複数件返ることを実機で確認済み。

---

## ディレクトリ配置

```
AI-Recipe-Book/
├── backend/
│   ├── errors.py                          ← 新規（3-a: 統一エラーレスポンス）
│   ├── main.py                            ← 変更（3-a, 4: エラーハンドラ・OpenAPI設定）
│   ├── config.py                          ← 変更（2: gemini_modelを gemini-3.5-flash に更新）
│   ├── pyproject.toml                     ← 変更（1: lint ignore縮小）
│   ├── requirements.txt                   ← 変更（2: google-genai固定、pydantic引き上げ、UTF-8宣言追加）
│   ├── requirements-dev.txt               ← 変更（httpx引き上げ、UTF-8宣言追加）
│   ├── repositories/
│   │   └── recipe_repository.py           ← 変更（1: E712解消）
│   ├── routers/
│   │   ├── ai.py                          ← 変更（4: OpenAPI docs）
│   │   ├── auth.py                        ← 変更（1: E702解消, 4: OpenAPI docs）
│   │   ├── misc.py                        ← 変更（4: OpenAPI docs）
│   │   ├── public.py                      ← 変更（4: OpenAPI docs）
│   │   ├── recipes.py                     ← 変更（1: E701/F401/E702解消, 4: OpenAPI docs）
│   │   └── shopping_lists.py              ← 変更（1: E701解消, 4: OpenAPI docs）
│   └── services/ai/
│       ├── gemini_client.py               ← 変更（1: F401解消, 2: vertexai=False明示）
│       └── openai_client.py               ← 変更（1: E701解消）
│
├── frontend/src/
│   ├── App.jsx                            ← 変更（3-b: ToastProvider, 5: /ai-searchルート）
│   ├── api/
│   │   └── recipeApi.js                   ← 変更（3-b: getApiErrorMessage追加）
│   ├── components/
│   │   ├── BottomNav.jsx                  ← 変更（5: AI検索タブ追加、実機検証で発見したFAB重なりバグ修正）
│   │   └── Toast.jsx                      ← 新規（3-b）
│   ├── context/
│   │   └── ToastContext.jsx               ← 新規（3-b）
│   ├── hooks/
│   │   ├── useAISearch.js                 ← 新規（5）
│   │   ├── useDiscover.js                 ← 変更（3-b: toast追加）
│   │   └── useRecipeDetail.js             ← 変更（3-b: useAIPanelにtoast追加）
│   ├── i18n/locales/
│   │   ├── ja.json / en.json / tr.json    ← 変更（5: aiSearch名前空間追加、既存検索文言の整理）
│   │   └── nav.aiSearch                   ← 追加キー
│   └── pages/
│       └── AISearchPage.jsx               ← 新規（5）
│
├── screenshots/
│   └── 05〜08_*_v51.png                    ← 新規（実機で撮影したv5.1デモ画像4枚）
│
└── docs/
    ├── Version_5.0/README.md              ← 新規（v5.0時点のREADMEスナップショット）
    └── PHASE3_SUMMARY.md                  ← 新規（本ファイル）
```

## 次回への申し送り事項

1. **`docs/Version_4.9/phase1/` と `info/` のドキュメント重複**：今回は未整理のまま。次回のREADME統合時にあわせて整理する
2. **`score_threshold`（RAG検索の関連度足切り）の調整**：本物のAIが有効になったことで、無関係な参照レシピが並ぶ違和感が目立つようになった。現在`1.2`（コサイン距離）に設定されているが、実データでの検証を踏まえて`0.85`程度への引き下げを検討する
3. **AIの回答にMarkdown記法（`**太字**`等）がそのまま表示される**：フロント側でMarkdownレンダリングが未実装のため
4. **AIの回答に内部的な連番（「レシピ2」等）が混入することがある**：RAGのプロンプト設計を見直す余地あり
