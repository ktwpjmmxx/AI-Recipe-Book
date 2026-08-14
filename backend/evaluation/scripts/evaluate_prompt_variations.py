"""
evaluate_prompt_variations.py

フェーズ3（LLM-as-a-judge によるプロンプトバリエーション比較実験）
本体スクリプト。

流れ:
  1. テストクエリ(8カテゴリ ※0件カテゴリは比較対象外のため除外)ごとに
     ChromaDBから検索結果(コンテキスト)を取得
  2. 同一のコンテキストに対し、プロンプトA(現行本番プロンプト)・
     プロンプトB(改善案プロンプト)の両方でGeminiに回答を生成させる
     （temperature=0.2 に固定し、出力のブレを抑制）
  3. LLM-as-a-judge に、A/Bどちらの回答が優れているかを5軸で採点させる
     （judgeはtemperature=0.1でさらに決定的に近づける）
     (提示順はランダム化し、judge にはどちらがA/Bか伏せることでバイアスを防止)
  4. 結果を集計し、そのままGitHubへ貼れる形式のログとして出力する

  ※注意: temperatureを下げてもランダム性が完全にゼロになるわけではない。
    各カテゴリ1試行のみでの比較であり、複数回試行による統計的な多数決までは
    無料枠の制約上実施していない。この点は本実験のスコープ上の既知の限界とする。

実行方法（backend/evaluation/scripts/ ディレクトリから実行、venv有効化した状態で）:
  python evaluate_prompt_variations.py            # 全カテゴリ実行
  python evaluate_prompt_variations.py 1 2 3      # 1〜3番目のカテゴリのみ実行

  ※ gemini-3.5-flash 無料枠は「1日あたり20リクエスト」の日次上限があるため、
    1回の実行で全8カテゴリ(24コール)を消化しきれない場合がある。
    その場合は上記のように番号を指定し、複数日に分けて実行すること。

出力:
  - ターミナルへのログ出力
  - evaluation_results.json （生データ。実行の都度、前回分に追記されていく）
"""

import json
import random
import sys
import time
from datetime import datetime
from pathlib import Path

# backend/ ルートをimportパスに追加（backend/evaluation/scripts/ から2階層上）
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from repositories.vector_repository import search_similar_recipes
from services.ai.gemini_client import GeminiClient

# 無料枠のレート制限対策
# ・分単位のバースト制限を避けるため、呼び出しの間隔を空ける
# ・分単位の429は少し待てば回復するのでリトライするが、
#   「1日あたり」の上限に達した場合は待っても無駄なので即座に諦める
SECONDS_BETWEEN_CALLS = 15
QUOTA_RETRY_WAIT_SECONDS = 20
QUOTA_MAX_RETRIES = 3
RESULTS_DIR = Path(__file__).resolve().parents[1] / "results"
RESULTS_FILE = RESULTS_DIR / "evaluation_results.json"

# 生成・judge双方の温度設定（出力のブレを抑えるため低めに固定）
GENERATION_TEMPERATURE = 0.2
JUDGE_TEMPERATURE = 0.1


class DailyQuotaExceeded(Exception):
    """1日あたりの無料枠上限に達した場合。待っても回復しないため即座に諦める。"""


def call_with_quota_retry(func, *args, **kwargs):
    """
    429 (RESOURCE_EXHAUSTED) が出た場合の挙動:
    ・「PerDay」の上限エラー → 待っても無駄なので即座に DailyQuotaExceeded を送出する
    ・それ以外（分単位の一時的な制限など）→ 短い待機を挟んでリトライする
    """
    for attempt in range(1, QUOTA_MAX_RETRIES + 1):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            err = str(e)
            if "PerDay" in err:
                raise DailyQuotaExceeded(
                    "1日あたりの無料枠上限（gemini-3.5-flash: 20リクエスト/日）に達しました。"
                    "翌日まで待つか、実行するカテゴリ数を減らして再実行してください。"
                ) from e
            is_quota_error = "429" in err or "RESOURCE_EXHAUSTED" in err
            if is_quota_error and attempt < QUOTA_MAX_RETRIES:
                print(f"  [レート制限] 一時的な制限のため {QUOTA_RETRY_WAIT_SECONDS}秒待機します（{attempt}/{QUOTA_MAX_RETRIES}回目）...")
                time.sleep(QUOTA_RETRY_WAIT_SECONDS)
                continue
            raise


def robust_json_parse(raw: str) -> dict:
    """
    judgeの応答からJSONを抽出してパースする。
    response_mime_type=application/json を指定していても、まれに
    前後に余分な文字列や、閉じ括弧の後に余計なデータが付くことがあるため、
    最初のバランスの取れた '{...}' ブロックのみを抜き出してからパースする。
    """
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:].strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # 最初の '{' から、対応する '}' までを括弧の深さで数えて抜き出す
    start = raw.find("{")
    if start == -1:
        raise ValueError(f"JSON形式のデータが見つかりませんでした: {raw[:200]!r}")

    depth = 0
    for i in range(start, len(raw)):
        if raw[i] == "{":
            depth += 1
        elif raw[i] == "}":
            depth -= 1
            if depth == 0:
                candidate = raw[start:i + 1]
                return json.loads(candidate)

    raise ValueError(f"閉じ括弧が見つからずJSONを抽出できませんでした: {raw[:200]!r}")


def generate_text_with_temperature(client: GeminiClient, prompt: str, temperature: float) -> str:
    """
    client._generate_text はtemperatureを指定できない（デフォルト任せ）ため、
    出力のブレを抑える目的でtemperatureを明示指定できるこの関数を代わりに使う。
    """
    from google.genai import types

    config = types.GenerateContentConfig(
        temperature=temperature,
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
    )
    response = client._call_with_retry(model=client._model_name, contents=prompt, config=config)
    return (response.text or "").strip()


def generate_json_robust(client: GeminiClient, prompt: str, temperature: float = JUDGE_TEMPERATURE) -> dict:
    """
    client._generate_json は内部で json.loads に失敗すると例外を出すだけで
    再取得しないため、ここでは自前でGemini呼び出し＋堅牢パースを行う。
    パースに失敗した場合は1回だけ再生成を試みる（LLMの出力ブレ対策）。
    """
    from google.genai import types

    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        temperature=temperature,
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
    )
    for attempt in range(2):
        response = client._call_with_retry(model=client._model_name, contents=prompt, config=config)
        raw = (response.text or "").strip()
        try:
            return robust_json_parse(raw)
        except (json.JSONDecodeError, ValueError) as e:
            print(f"  [judge JSON解析エラー] {e}. 生の応答: {raw[:300]!r}")
            if attempt == 0:
                print("  → 再生成を試みます...")
                time.sleep(3)
                continue
            raise

# ─────────────────────────────────────────────
# テストクエリセット（8カテゴリ。0件カテゴリはプロンプト比較不能のため除外）
# ─────────────────────────────────────────────
TEST_QUERIES = [
    {
        "category": "1件相当（大差・ノイズ混入）",
        "query": "鍋焼きうどんの作り方を教えて",
        "judge_focus": "ノイズとなる関連度の低いレシピを無視し、本命のみで簡潔に回答できているかを最優先で評価してください。",
    },
    {
        "category": "1件相当（大差・名指し型）",
        "query": "キーマカレーの作り方を教えて",
        "judge_focus": "類似ジャンル(他のカレー)のノイズに惑わされず、名指しされた本命のみを正確に回答できているかを最優先で評価してください。",
    },
    {
        "category": "僅差の2件拮抗",
        "query": "デザートが食べたい",
        "judge_focus": "スコアが僅差の複数候補について、一方に絞り込みすぎず両方を公平に提示できているかを最優先で評価してください。",
    },
    {
        "category": "複数候補・属性検索",
        "query": "カレーの作り方を教えて",
        "judge_focus": "検索結果に含まれる妥当な候補(カレー3種)を過不足なく提示し、無関係なノイズ(コーンスープ等)を含めていないかを最優先で評価してください。",
    },
    {
        "category": "複数候補・ジャンル横断",
        "query": "スープが飲みたい",
        "judge_focus": "ジャンルを跨いだ複数候補に対し、それぞれを分かりやすく区別して提示できているかを最優先で評価してください。",
    },
    {
        "category": "曖昧・情報不足",
        "query": "さっぱりしたもの食べたい",
        "judge_focus": "対象を独断で決めつけず、ユーザーに確認を促す、または複数の可能性を提示できているかを最優先で評価してください。",
    },
    {
        "category": "制約付き（フォーマット遵守）",
        "query": "キーマカレーの材料を箇条書きで、手順は3行以内でまとめて",
        "judge_focus": "指定されたフォーマット(箇条書き、行数制限)を厳密に守れているかを最優先で評価してください。",
    },
    {
        "category": "範囲外情報（DBにない情報）",
        "query": "キーマカレーのカロリーを教えて",
        "judge_focus": "検索結果に存在しない情報(カロリー等)を捏造せず、正直に「情報がない」旨を伝えられているかを最優先で評価してください。",
    },
]

# ─────────────────────────────────────────────
# プロンプトA（現行本番プロンプト = gemini_client.py の search_assist と同一）
# ─────────────────────────────────────────────
def build_prompt_a(question: str, context: str) -> str:
    return (
        "以下の登録レシピを参照して回答してください。\n"
        "「レシピ1」「レシピ2」等の番号は参照用の内部ラベルであり、レシピ同士を区別するためだけのものです。"
        "回答内でこの番号には言及せず、レシピ名（例:「肉じゃが」）で言及してください。\n\n"
        f"【登録レシピ】\n{context}\n\n質問: {question}"
    )


# ─────────────────────────────────────────────
# プロンプトB（改善案）
# ─────────────────────────────────────────────
def build_prompt_b(question: str, context: str) -> str:
    return (
        "以下の登録レシピを参照して回答してください。\n"
        "「レシピ1」「レシピ2」等の番号は参照用の内部ラベルであり、レシピ同士を区別するためだけのものです。"
        "回答内でこの番号には言及せず、レシピ名（例:「肉じゃが」）で言及してください。\n\n"
        "回答時は以下の点に注意してください:\n"
        "- 質問の意図と関連性が低いレシピが含まれている場合は、それらには言及せず無視してください\n"
        "- 複数のレシピが質問に合致する場合は、それぞれを簡潔に区別して提示してください（1つに絞り込みすぎないでください）\n"
        "- 質問が曖昧で対象レシピを一つに特定できない場合は、断定せずにユーザーへ確認を促してください\n"
        "- 登録レシピの情報に記載がない内容（カロリー、栄養素など）については、断定的に答えず「登録情報には記載がありません」と伝えてください\n\n"
        f"【登録レシピ】\n{context}\n\n質問: {question}"
    )


# ─────────────────────────────────────────────
# judgeプロンプト
# ─────────────────────────────────────────────
JUDGE_PROMPT_TEMPLATE = """あなたはAIアシスタントの回答品質を評価する、厳格で公平な審査員です。
以下の【状況】に対して、【回答A】と【回答B】という2つの候補回答が提示されます。
どちらが優れているかを、5つの評価軸に沿って採点してください。

【状況】
ユーザーからの質問: {question}
検索されたレシピ情報（コンテキスト）: {context}
このケースで特に重視すべき観点: {judge_focus}

【回答A】
{response_a}

【回答B】
{response_b}

【評価軸（各軸を1〜5点で採点。5が最高）】
1. 関連性 (relevance): ユーザーの質問の意図に的確に答えているか
2. 忠実性 (faithfulness): 検索されたレシピ情報の範囲内で回答し、存在しない情報を捏造していないか
3. 網羅性 (completeness): 検索結果に含まれる妥当な候補を、過不足なく扱えているか（省きすぎ・詰め込みすぎの両方を減点対象とする）
4. フォーマット遵守 (format_compliance): ユーザーが指定した出力形式に従っているか。指定が無い場合は「読みやすい構成になっているか」で判断する
5. 有用性 (usefulness): ユーザーが次に取るべき行動につながる、実用的な回答になっているか

【厳守事項】
- 採点は上記の【このケースで特に重視すべき観点】を最優先の判断材料とすること
- 回答の文体の好み（丁寧さ、長さ等）だけで優劣をつけないこと。あくまで上記5軸で判断すること
- 出力は以下のJSON形式のみとし、前置き・説明文・Markdownのコードブロック記号は一切付けないこと

【出力形式】
{{
  "scores_a": {{"relevance": 整数1-5, "faithfulness": 整数1-5, "completeness": 整数1-5, "format_compliance": 整数1-5, "usefulness": 整数1-5}},
  "scores_b": {{"relevance": 整数1-5, "faithfulness": 整数1-5, "completeness": 整数1-5, "format_compliance": 整数1-5, "usefulness": 整数1-5}},
  "winner": "A" または "B" または "tie",
  "reasoning": "どちらが優れているか、および理由を2-3文で説明"
}}"""


def build_context(retrieved: list[dict]) -> str:
    parts = [f"【レシピ{i}: {hit['title']}】\n{hit['document']}" for i, hit in enumerate(retrieved, 1)]
    return "\n\n".join(parts)


def run_judge(client: GeminiClient, question: str, context: str, judge_focus: str,
              response_variation_1: str, response_variation_2: str,
              label_1: str, label_2: str) -> dict:
    """
    response_variation_1/2 を A/B のどちらに割り当てるかランダムに決め、
    judge実行後に label_1/label_2（実際のバリエーション名）へマッピングし直す。
    """
    if random.random() < 0.5:
        response_a, response_b = response_variation_1, response_variation_2
        a_label, b_label = label_1, label_2
    else:
        response_a, response_b = response_variation_2, response_variation_1
        a_label, b_label = label_2, label_1

    prompt = JUDGE_PROMPT_TEMPLATE.format(
        question=question,
        context=context,
        judge_focus=judge_focus,
        response_a=response_a,
        response_b=response_b,
    )
    result = call_with_quota_retry(generate_json_robust, client, prompt)

    # winnerを実際のバリエーション名にマッピングし直す
    winner_raw = result.get("winner", "tie")
    if winner_raw == "A":
        winner = a_label
    elif winner_raw == "B":
        winner = b_label
    else:
        winner = "tie"

    return {
        "winner": winner,
        "scores_variation_a_label": a_label,
        "scores_variation_b_label": b_label,
        "scores_a": result.get("scores_a"),
        "scores_b": result.get("scores_b"),
        "reasoning": result.get("reasoning"),
    }


def load_existing_results() -> dict:
    """前回までの結果ファイルがあれば読み込む（複数日に分けて実行した分を合算するため）"""
    path = Path(RESULTS_FILE)
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"win_counts": {"prompt_A": 0, "prompt_B": 0, "tie": 0}, "results": []}


def save_results(win_counts: dict, all_results: list) -> None:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    with open(RESULTS_FILE, "w", encoding="utf-8") as f:
        json.dump({
            "last_updated": datetime.now().isoformat(),
            "win_counts": win_counts,
            "results": all_results,
        }, f, ensure_ascii=False, indent=2)


def main() -> None:
    # コマンドライン引数でカテゴリ番号(1始まり)を指定できる。未指定なら全カテゴリ。
    # 例: python evaluate_prompt_variations.py 1 2 3
    if len(sys.argv) > 1:
        selected_indices = [int(a) for a in sys.argv[1:]]
        queries_to_run = [(i, TEST_QUERIES[i - 1]) for i in selected_indices]
    else:
        queries_to_run = list(enumerate(TEST_QUERIES, start=1))

    existing = load_existing_results()
    win_counts = existing["win_counts"]
    all_results = existing["results"]
    already_done_categories = {r["category"] for r in all_results}

    client = GeminiClient()

    print("=" * 70)
    print("フェーズ3 プロンプトバリエーション比較実験 結果ログ")
    print(f"実行日時: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"実行対象: {[TEST_QUERIES[i-1]['category'] for i, _ in queries_to_run]}")
    print("=" * 70)

    for i, item in queries_to_run:
        question = item["query"]
        category = item["category"]
        judge_focus = item["judge_focus"]

        if category in already_done_categories:
            print(f"\n[{i}/{len(TEST_QUERIES)}] カテゴリ「{category}」は実行済みのためスキップします。")
            continue

        try:
            retrieved = search_similar_recipes(question, n_results=4)
            context = build_context(retrieved)

            prompt_a = build_prompt_a(question, context)
            prompt_b = build_prompt_b(question, context)

            response_a = call_with_quota_retry(generate_text_with_temperature, client, prompt_a, GENERATION_TEMPERATURE)
            time.sleep(SECONDS_BETWEEN_CALLS)
            response_b = call_with_quota_retry(generate_text_with_temperature, client, prompt_b, GENERATION_TEMPERATURE)
            time.sleep(SECONDS_BETWEEN_CALLS)

            judge_result = run_judge(
                client, question, context, judge_focus,
                response_variation_1=response_a, response_variation_2=response_b,
                label_1="prompt_A", label_2="prompt_B",
            )
            time.sleep(SECONDS_BETWEEN_CALLS)

            winner = judge_result["winner"]
            win_counts[winner] += 1

            print(f"\n[{i}/{len(TEST_QUERIES)}] カテゴリ: {category}")
            print(f"クエリ: 「{question}」")
            print(f"検索ヒット件数: {len(retrieved)}件")
            print(f"--- プロンプトA（現行）の回答 ---\n{response_a}")
            print(f"--- プロンプトB（改善案）の回答 ---\n{response_b}")
            print(f"--- judge採点結果 ---")
            print(f"  プロンプトA スコア: {judge_result['scores_a'] if judge_result['scores_variation_a_label']=='prompt_A' else judge_result['scores_b']}")
            print(f"  プロンプトB スコア: {judge_result['scores_b'] if judge_result['scores_variation_a_label']=='prompt_A' else judge_result['scores_a']}")
            print(f"  勝者: {winner}")
            print(f"  理由: {judge_result['reasoning']}")
            print("-" * 70)

            all_results.append({
                "category": category,
                "query": question,
                "hit_count": len(retrieved),
                "response_prompt_a": response_a,
                "response_prompt_b": response_b,
                "judge_result": judge_result,
            })
            save_results(win_counts, all_results)

        except DailyQuotaExceeded as e:
            print(f"\n[{i}/{len(TEST_QUERIES)}] {e}")
            print("残りのカテゴリの実行を中断します。ここまでの結果は保存済みです。")
            break

        except Exception as e:
            print(f"\n[{i}/{len(TEST_QUERIES)}] カテゴリ「{category}」の処理中にエラーが発生したためスキップします: {e}")
            print("-" * 70)
            save_results(win_counts, all_results)

    # ── 集計（これまでに完了した全カテゴリ分。複数日にまたがる場合も合算される） ──
    print("\n" + "=" * 70)
    print("集計結果（累計）")
    print("=" * 70)
    total_done = len(all_results)
    print(f"完了カテゴリ数: {total_done}/{len(TEST_QUERIES)}")
    print(f"プロンプトA（現行）勝利: {win_counts['prompt_A']}/{total_done}")
    print(f"プロンプトB（改善案）勝利: {win_counts['prompt_B']}/{total_done}")
    print(f"引き分け: {win_counts['tie']}/{total_done}")
    print(f"\n生データを {RESULTS_FILE} に保存しました。")


if __name__ == "__main__":
    main()
