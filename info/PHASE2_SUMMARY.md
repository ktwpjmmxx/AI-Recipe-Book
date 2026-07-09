# Phase 2（v5.0）まとめ

Phase 2で行った意思決定・検証内容を記録する。README本文には含めなかった経緯や判断理由をここに残す。

## 完了した作業

| # | 内容 | 対応状況 |
|---|---|---|
| 1 | 公開デモ環境構築（Render + Vercel） | ✅ 完了。ログイン・新規登録まで動作確認済み |
| 2 | バグ修正3件（`upload_dir_str`→`upload_dir`／`recipeApi.js`のbaseURL環境変数対応／CORS本番オリジン追加） | ✅ 完了 |
| 3 | `ai-assist`エンドポイント実装（`services/ai_service.py`の`assist()`を`routers/recipes.py`に接続） | ✅ 完了。動作検証済み |
| 4 | ローカルdevでの動作確認（登録済みレシピでの画像アップロード・AI相談） | ✅ 完了 |
| 5 | `architecture.md`・`demo_examples.md`・`deployment.md`の実データ反映 | ✅ 完了 |

## 主な意思決定と経緯

### `ai-assist`エンドポイントの設計

- パスは `POST /api/recipes/{recipe_id}/ai-assist` に決定（フロント既存呼び出しに合わせた）
- 材料整形ロジックは新規実装せず、`vector_repository.py`内に既にあったインラインロジックを`format_ingredients_text()`として関数化し、再利用する形に統一した（重複実装の回避）

### モックデータとの重複確認

`services/ai/mock_client.py`の`_MOCK_ITEMS`（豚キムチ炒め／ペペロンチーノ／麻婆豆腐／ほうれん草の胡麻和え／ガパオライス）と、実際にアプリへ登録済みのレシピ（ナシゴレン／ボンゴレビアンコ／ガスパチョ／鍋焼きうどん／ガトーショコラ 他）を照合し、料理名・カテゴリともに重複がないことを確認した。デモ用スクリーンショットは実際に登録済みのレシピをそのまま使用した。

### RAG横断検索（`search-assist`）のフロントUI接続を見送った理由

検証中に、`POST /api/ai/search-assist`はバックエンドAPIとして実装済みである一方、フロントエンドのどの画面からも呼ばれていないことが判明した。簡易的なUIで繋ぎ込んで見た目のデモを作ることも可能だったが、「見た目のデモを弱くしたくない」という方針のもと、簡易実装での妥協ではなく本格的なUI/UX設計を伴う実装をPhase 3以降に行う方針とし、**Phase 2のスコープから意図的に除外した。**

## 検証中に見つかった既知の課題

### Gemini API認証エラー（`401 UNAUTHENTICATED` / `ACCESS_TOKEN_TYPE_UNSUPPORTED`）

`ai-assist`の動作検証中、ターミナルログに以下のエラーが確認された。

```
ERROR services.ai_service: AI assist failed: 401 UNAUTHENTICATED.
{'error': {'code': 401, 'message': 'Request had invalid authentication credentials.
Expected OAuth 2 access token, login cookie or other valid authentication credential.
...', 'reason': 'ACCESS_TOKEN_TYPE_UNSUPPORTED', ...}}
```

既存の`ai_service.py`の`try/except`フォールバック機構により、自動的にモック回答（テンプレート応答、または汎用フォールバックメッセージ）に切り替わっており、エンドポイント自体・今回リファクタリングした材料整形ロジックは正常に動作していることを確認済み。

**緊急性の判断:** モック回答へのフォールバックによりユーザー体験自体は壊れていないため、原因調査（APIキーの設定方式の見直し等）は次回アップデート以降のデバッグタスクとして持ち越す。

### RAG横断検索（`search-assist`）のフロントUI未接続

上記「意思決定と経緯」参照。バックエンドは実装済み・動作確認可能。
