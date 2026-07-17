# RAG検索 0件問題 技術調査ログ

調査日：2026-07-16
調査対象：`POST /api/ai/search-assist` が特定の質問で `hits=0` を返す事象
調査環境：ローカル開発環境（PowerShell / Python REPL、`backend`ディレクトリ内）

---

## 発端：アプリログでの異常検知

通常の動作確認中、以下のログが記録された。

```
2026-07-16 09:37:48,461 INFO services.ai_service: RAG search_assist: query='ナシゴレンのレシピを教えて', hits=0
INFO:     127.0.0.1:64182 - "POST /api/ai/search-assist HTTP/1.1" 200 OK
...
2026-07-16 09:38:49,212 INFO services.ai_service: RAG search_assist: query='玉ねぎを使った料理を教えて', hits=0
INFO:     127.0.0.1:55406 - "POST /api/ai/search-assist HTTP/1.1" 200 OK
```

**着目点**：HTTPステータスは`200 OK`（アプリケーションエラーではない）。しかし`hits=0`となっており、`ai_service.py`のログ出力（`logger.info(f"RAG search_assist: query='{question}', hits={len(retrieved)}")`）から、`search_similar_recipes()`が空リストを返したことが分かる。

「ナシゴレン」はアプリ内に実在するレシピ名であり、「玉ねぎ」もそのレシピの材料に含まれる単語であるため、0件になるのは不自然と判断し、調査を開始した。

---

## Step 1：ChromaDBコレクションへの登録状況を確認する

### 実行コマンド

```powershell
cd backend
venv\Scripts\Activate.ps1
python
```

```python
from repositories.vector_repository import get_collection
c = get_collection()
print(c.count())
```

### 目的
`vector_repository.py`の`search_similar_recipes()`には以下の分岐がある。

```python
if collection.count() == 0:
    return []
```

もしChromaDB側にレシピが1件も登録されていなければ、類似度計算をするまでもなく`hits=0`になる。まずこの「そもそもデータが入っているか」という一番手前の可能性を排除するために実行した。

### 実際の出力

```
>>> from repositories.vector_repository import get_collection
>>> c = get_collection()
>>> print(c.count())
5
```

### 解説
`5`という値が返り、SQLite側に登録されている5件のレシピと一致した。**この時点で「ChromaDBに何も登録されていない」という仮説（仮説1）は否定された。**

---

## Step 2：登録されている中身を確認する

### 実行コマンド

```python
result = c.get(limit=5)
print(result["metadatas"])
```

### 目的
件数が5件あることは分かったが、実際に「どのレシピが」登録されているかを確認し、疑わしいクエリ対象（ナシゴレン）が本当に含まれているかを検証するために実行した。

### 実際の出力

```
Failed to send telemetry event CollectionGetEvent: capture() takes 1 positional argument but 3 were given
>>> print(result["metadatas"])
[{'category': 'アジアン', 'cook_time': 15, 'recipe_id': 12, 'title': 'ナシゴレン'}, {'category': 'イタリアン', 'cook_time': 13, 'recipe_id': 11, 'title': 'ボンゴレビアンコ'}, {'category': '洋食', 'cook_time': 10, 'recipe_id': 10, 'title': 'ガスパチョ'}, {'category': '和食', 'cook_time': 15, 'recipe_id': 9, 'title': '鍋焼きうどん'}, {'category': 'その他', 'cook_time': 40, 'recipe_id': 8, 'title': 'ガトーショコラ'}]
```

### 解説
- `Failed to send telemetry event...` は、ChromaDBが匿名の使用状況をローカルネットワーク経由で外部送信しようとして失敗しているだけの警告であり、検索結果やデータの正しさには影響しない。無視して問題ない。
- 肝心の中身については、`recipe_id: 12, title: 'ナシゴレン'`が確かに含まれていることを確認。**「対象レシピが登録されていない」という可能性も排除された。**

この時点で、残る可能性は「距離(distance)がフィルター閾値を超えて除外されている」こと、すなわち**埋め込みモデルによる類似度計算そのものの精度**に絞られた。

---

## Step 3：フィルター適用前の生の距離を確認する

### 実行コマンド

```python
results = c.query(
    query_texts=["ナシゴレンのレシピを教えて"],
    n_results=5,
    include=["metadatas", "distances"],
)
for meta, dist in zip(results["metadatas"][0], results["distances"][0]):
    print(meta["title"], dist)
```

### 目的
アプリの実装（`search_similar_recipes()`）では、`score_threshold=0.85`を超えた結果を`continue`で捨ててしまうため、アプリのログだけを見ていても「実際にはどのくらいの距離だったのか」という生の数値は分からない。ChromaDBのコレクションオブジェクトに対して、アプリのフィルターロジックを経由せず直接`query()`を呼び出すことで、**フィルター適用前の素の計算結果**を取得した。

### 実際の出力

```
Failed to send telemetry event CollectionQueryEvent: capture() takes 1 positional argument but 3 were given
>>> for meta, dist in zip(results["metadatas"][0], results["distances"][0]):
...     print(meta["title"], dist)
... 
ガトーショコラ 0.9221757118413653
ガスパチョ 0.9492985681176842
ボンゴレビアンコ 0.967387436940992
ナシゴレン 0.9851307276398786
鍋焼きうどん 1.0043406915557345
```

### 解説
ここで初めて核心的な事実が判明した。

1. 全件が`score_threshold=0.85`を上回っている（アプリの実装上、これは全て除外される）→ `hits=0`の直接的な原因を特定
2. 質問文に「ナシゴレン」という単語がそのまま含まれているにもかかわらず、ナシゴレン自体は5件中4位（0.9851）で、無関係なはずのガトーショコラ（0.9222）が最上位という逆転が発生している

この2点により、「単なる閾値設定のミス」ではなく「埋め込みモデルが日本語の意味的な近さを正しく計算できていない」という、より根深い問題が疑われる状態になった。

---

## Step 4：複数の質問パターンで再現性を確認する

### 実行コマンド

```python
test_queries = [
    "ナシゴレンのレシピを教えて",
    "玉ねぎを使った料理を教えて",
    "じゃがいもを使った料理",
    "ジャガイモを使った料理",
    "時短で作れる料理ある?",
    "30分以内で作れて卵を使わない料理",
    "牛肉の刺身のレシピは?",
    "あっさりした夕飯のメニュー",
]

for q in test_queries:
    print(f"\n--- 質問: {q} ---")
    results = c.query(query_texts=[q], n_results=5, include=["metadatas", "distances"])
    for meta, dist in zip(results["metadatas"][0], results["distances"][0]):
        print(f"  {meta['title']}: {round(dist, 4)}")
```

### 目的
Step 3で見つかった現象が「ナシゴレン」というクエリ固有の偶然なのか、それとも埋め込みモデル全体に共通する構造的な問題なのかを判断するため、質問のバリエーション（単純検索・食材指定・表記ゆれ・口語表現・複数条件・存在しない情報・曖昧な質問）を横断して同じ計測を行った。

### 実際の出力
（8問×5件、計40件のデータ。詳細は`Before_計測記録_デフォルト埋め込みモデル.md`に整理済みのため本資料では割愛。全件が0.8925〜1.0931の範囲に収まり、`score_threshold=0.85`を1件も下回らないことを確認した。）

### 解説
単一クエリで見つかった現象が、質問パターンを変えても一貫して再現されたことから、**「特定の質問での偶然」ではなく「この埋め込みモデル・この閾値設定の組み合わせでは構造的に検索が機能しない」という結論に至った。**

---

## 調査全体のまとめ（切り分けのロジック）

```
① ChromaDBにデータは登録されているか？
   → count()で確認 → 5件あり。仮説「未登録」を棄却

② 対象レシピ（ナシゴレン）は含まれているか？
   → get()で中身を確認 → 含まれている。仮説「データ欠落」を棄却

③ 距離はどのくらいだったのか？（フィルター適用前）
   → query()で生の距離を確認 → 全て0.85超。hits=0の直接原因を特定

④ これは特定の質問だけの現象か、構造的な問題か？
   → 質問パターンを変えて再計測 → 全パターンで再現。構造的な問題と結論
```

このように、「アプリのログでは見えない部分」までPython REPLで直接コレクションオブジェクトを操作して確認したことで、問題を段階的に切り分けられた。単に「閾値を緩めれば直るだろう」と対症療法的な変更を加えるのではなく、**根本原因（埋め込みモデルの精度不足）まで踏み込んで特定できた**ことが、この調査の技術的なポイントである。

---

## 次のステップへの接続

この調査ログと `Before_計測記録_デフォルト埋め込みモデル.md` の数値データは、以下の目的でそのまま再利用できる。

- README「既知の課題と対応状況」への追記材料
- GrepAI `06_evaluation_and_monitoring` チャプターの実例（「トラブルシューティングの型」の具体例として）
- 埋め込みモデル変更後の再計測時の比較対象（Before値）
