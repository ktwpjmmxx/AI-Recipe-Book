# 公開デモ環境 構築手順

## 全体方針

- **バックエンド**: Render(Web Service, 無料枠)
- **フロントエンド**: Vercel
- **AI課金事故防止**: 新規の使用回数カウンタ等は実装せず、**既存の`LLM_PROVIDER`フォールバック機構をそのまま安全装置として使う**方針とする(下記「課金事故防止の設計」参照)。

## 事前に必要な1行修正(フェーズ2で対応済み)

`backend/main.py`:
```diff
- app.mount("/uploads", StaticFiles(directory=settings.upload_dir_str), name="uploads")
+ app.mount("/uploads", StaticFiles(directory=str(settings.upload_dir)), name="uploads")
```

`backend/uploads/`は`.gitignore`対象のためリポジトリに含まれない。Renderのようなクリーンな環境に毎回デプロイする場合、ローカルの`mkdir uploads`のような手動操作はできないため、アプリ起動時に自動生成される必要がある。`config.py`の`upload_dir`プロパティ(`p.mkdir(exist_ok=True)`を内包)を`main.py`のマウント処理で使うことで解消する。

## バックエンド(Render)デプロイ手順

1. Renderで新規Web Serviceを作成し、GitHubリポジトリを連携
2. Root Directoryを`backend`に設定
3. Build Command: `pip install -r requirements.txt`
4. Start Command: `alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port $PORT`
5. 環境変数を設定(下記「環境変数一覧」参照)
6. SQLiteファイルは永続ディスクが必要な場合、RenderのPersistent Diskを追加(無料枠では再デプロイ時にリセットされる点に注意。ポートフォリオ用途であれば許容範囲)

### 環境変数一覧

| 変数名 | デモ環境での値 | 備考 |
|---|---|---|
| `LLM_PROVIDER` | `mock` (推奨) または `gemini` | 下記「課金事故防止」参照 |
| `GEMINI_API_KEY` | 設定する場合のみ | 未設定なら自動でmockにフォールバック(`factory.py`の既存挙動) |
| `SECRET_KEY` | ランダムな文字列を発行して設定 | デフォルト値のままだと起動時に警告ログが出る仕様(`config.py`) |
| `DATABASE_URL` | `sqlite:///./recipes.db` | Renderの永続化方針に応じて変更 |
| `UPLOAD_DIR_STR` | `./uploads` | 変更不要（上記修正で自動生成される） |

## フロントエンド(Vercel)デプロイ手順

1. Vercelで新規プロジェクトを作成し、Root Directoryを`frontend`に設定
2. Build Command: `npm run build` / Output Directory: `dist`
3. 環境変数`VITE_API_BASE_URL`にRenderのバックエンドURLを設定

### 要修正: `recipeApi.js`のbaseURLが相対パス固定になっている

**現状:** `axios.create({ baseURL: '/api' })`と相対パスで固定されており、ローカル開発時のみ`vite.config.js`の`server.proxy`（`/api` → `http://localhost:8000`）で機能する。Vercel(フロント)とRender(バックエンド)を別ドメインで運用する構成では、このproxyはビルド後に存在せず、`/api`宛のリクエストがVercel自身に飛んで失敗する。

**提案する修正:**
```diff
+ const baseURL = import.meta.env.VITE_API_BASE_URL || '/api'
  const api = axios.create({
-   baseURL: '/api',
+   baseURL,
    timeout: 30000,
  })
```
ローカル開発時は環境変数未設定なら従来通り`/api`+proxyが機能し、Vercel本番では`VITE_API_BASE_URL`にRenderのURLを設定することで動作する。

## 課金事故防止の設計

新しくカウンタや上限管理の仕組みをゼロから作るのではなく、**すでに実装されている`services/ai/factory.py`のフォールバック機構をそのまま活用する**方針とする。

- `LLM_PROVIDER=mock`(デフォルト値)のまま公開デモを運用すれば、Gemini APIは一切呼ばれず課金は発生しない
- 採用担当に「実際のAI生成」を見せたい場合のみ、一時的に`GEMINI_API_KEY`を設定して`LLM_PROVIDER=gemini`に切り替える運用とする
- Gemini APIキー自体もGoogle Cloud Console側で日次のクォータ上限を設定できるため、アプリ側での重複実装は避ける(既存コードの責務を尊重し、無関係な機能追加を増やさない、というv4.9までの設計判断と一貫させる)
- 障害時・クォータ超過時は`ai_service.py`の`try/except`により自動的にmock回答へフォールバックする(新規実装不要、既存コードで担保済み)

この方針であれば、フェーズ2で新規に複雑なレート制限ロジックを追加する必要がなく、既存の設計思想（外部リソースへの依存を安全に切り離す）に沿った形で公開デモが成立する。

## 既知の制約(README「既知の課題」との整合)

- 無料枠のRenderはコールドスタート(数十秒の起動遅延)が発生する。デモ利用時にその旨を明記しておくとよい
- SQLiteの永続化は無料枠の制約を受けるため、デモデータが定期的にリセットされる可能性がある。README側に「デモ環境のデータは予告なくリセットされることがあります」旨の注記を推奨
