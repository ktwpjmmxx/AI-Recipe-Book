"""
evaluate_hybrid_comparison.py

フェーズ3（LLM-as-a-judge によるプロンプトバリエーション比較実験）
ハイブリッド版（gemini_client.py の search_assist に実装した本番ロジック）を、
プロンプトA単体・プロンプトB単体と3者比較する評価スクリプト。

前提:
  evaluate_prompt_variations.py を8カテゴリ完走させた evaluation_results.json
  (A単体・B単体の回答が既に保存されているもの)が同じディレクトリにあること。
  → A・Bの回答は再生成せず、そこから読み込んで再利用する（APIコール節約のため）。
  → 新たに生成するのは「ハイブリッド版の回答」と「3者比較judgeの採点」のみ。

流れ:
  1. evaluation_results.json から各カテゴリのプロンプトA・B単体の回答を読み込む
  2. 同一のコンテキストに対し、本番の search_assist と同じ判定ロジック
     （_is_single_clear_result → 必要なら _classify_intent）でハイブリッド版の
     回答を生成する（温度0.2で固定、出力のブレを抑制）
  3. LLM-as-a-judge に、ハイブリッド・A・Bの3つの回答を比較させ、
     5軸で採点した上で最も優れたものを判定させる
     （提示順はランダム化し、judgeにはどれがどれか伏せることでバイアスを防止）
  4. 結果を集計し、そのままGitHubへ貼れる形式のログとして出力する

実行方法（backend/evaluation/scripts/ ディレクトリから実行、venv有効化した状態で）:
  python evaluate_hybrid_comparison.py            # 全カテゴリ実行
  python evaluate_hybrid_comparison.py 1 2 3      # 1〜3番目のカテゴリのみ実行

  ※ gemini-3.5-flash 無料枠は「1日あたり20リクエスト」の日次上限があるため、
    1回の実行で全8カテゴリを消化しきれない場合がある。
    その場合は上記のように番号を指定し、複数日に分けて実行すること。

出力:
  - ターミナルへのログ出力
  - hybrid_comparison_results.json （生データ。実行の都度、前回分に追記されていく）
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

RESULTS_DIR = Path(__file__).resolve().parents[1] / "results"
PRIOR_AB_RESULTS_FILE = RESULTS_DIR / "evaluation_results.json"
RESULTS_FILE = RESULTS_DIR / "hybrid_comparison_results.json"

SECONDS_BETWEEN_CALLS = 15
QUOTA_RETRY_WAIT_SECONDS = 20
QUOTA_MAX_RETRIES = 3

GENERATION_TEMPERATURE = 0.2
JUDGE_TEMPERATURE = 0.1

# A単体・B単体と同一の8カテゴリ（evaluate_prompt_variations.py と揃えること）
TEST_QUERIES = [
    {"category": "1件相当（大差・ノイズ混入）", "query": "鍋焼きうどんの作り方を教えて",
     "judge_focus": "ノイズとなる関連度の低いレシピを無視し、本命のみで簡潔に回答できているかを最優先で評価してください。"},
    {"category": "1件相当（大差・名指し型）", "query": "キーマカレーの作り方を教えて",
     "judge_focus": "類似ジャンル(他のカレー)のノイズに惑わされず、名指しされた本命のみを正確に回答できているかを最優先で評価してください。"},
    {"category": "僅差の2件拮抗", "query": "デザートが食べたい",
     "judge_focus": "スコアが僅差の複数候補について、一方に絞り込みすぎず両方を公平に提示できているかを最優先で評価してください。"},
    {"category": "複数候補・属性検索", "query": "カレーの作り方を教えて",
     "judge_focus": "検索結果に含まれる妥当な候補(カレー3種)を過不足なく提示し、無関係なノイズ(コーンスープ等)を含めていないかを最優先で評価してください。"},
    {"category": "複数候補・ジャンル横断", "query": "スープが飲みたい",
     "judge_focus": "ジャンルを跨いだ複数候補に対し、それぞれを分かりやすく区別して提示できているかを最優先で評価してください。"},
    {"category": "曖昧・情報不足", "query": "さっぱりしたもの食べたい",
     "judge_focus": "対象を独断で決めつけず、ユーザーに確認を促す、または複数の可能性を提示できているかを最優先で評価してください。"},
    {"category": "制約付き（フォーマット遵守）", "query": "キーマカレーの材料を箇条書きで、手順は3行以内でまとめて",
     "judge_focus": "指定されたフォーマット(箇条書き、行数制限)を厳密に守れているかを最優先で評価してください。"},
    {"category": "範囲外情報（DBにない情報）", "query": "キーマカレーのカロリーを教えて",
     "judge_focus": "検索結果に存在しない情報(カロリー等)を捏造せず、正直に「情報がない」旨を伝えられているかを最優先で評価してください。"},
]


class DailyQuotaExceeded(Exception):
    """1日あたりの無料枠上限に達した場合。待っても回復しないため即座に諦める。"""


def call_with_quota_retry(func, *args, **kwargs):
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
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:].strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

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
                return json.loads(raw[start:i + 1])
    raise ValueError(f"閉じ括弧が見つからずJSONを抽出できませんでした: {raw[:200]!r}")


def generate_text_with_temperature(client: GeminiClient, prompt: str, temperature: float) -> str:
    from google.genai import types
    config = types.GenerateContentConfig(
        temperature=temperature,
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
    )
    response = client._call_with_retry(model=client._model_name, contents=prompt, config=config)
    return (response.text or "").strip()


def generate_json_robust(client: GeminiClient, prompt: str, temperature: float = JUDGE_TEMPERATURE) -> dict:
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


def generate_hybrid_response(client: GeminiClient, question: str, retrieved: list[dict]) -> tuple[str, str]:
    """
    本番の search_assist と同じ判定ロジックをここで再現し、
    「どちらの分岐を通ったか(branch)」も合わせて返す（証跡・分析用）。
    """
    context = client._build_context(retrieved)

    if client._is_single_clear_result(retrieved):
        branch = "single_clear（判定コールなし・プロンプトA相当）"
        prompt = client._build_prompt_a(question, context)
    else:
        intent = call_with_quota_retry(client._classify_intent, question)
        time.sleep(SECONDS_BETWEEN_CALLS)
        branch = f"ambiguous_intent_{intent}（判定コールあり・プロンプト{intent}相当）"
        prompt = client._build_prompt_a(question, context) if intent == "A" else client._build_prompt_b(question, context)

    response = call_with_quota_retry(generate_text_with_temperature, client, prompt, GENERATION_TEMPERATURE)
    return response, branch


JUDGE_PROMPT_TEMPLATE = """あなたはAIアシスタントの回答品質を評価する、厳格で公平な審査員です。
以下の【状況】に対して、【回答1】【回答2】【回答3】という3つの候補回答が提示されます。
どれが最も優れているかを、5つの評価軸に沿って採点してください。

【状況】
ユーザーからの質問: {question}
検索されたレシピ情報（コンテキスト）: {context}
このケースで特に重視すべき観点: {judge_focus}

【回答1】
{response_1}

【回答2】
{response_2}

【回答3】
{response_3}

【評価軸（各軸を1〜5点で採点。5が最高）】
1. 関連性 (relevance)
2. 忠実性 (faithfulness)
3. 網羅性 (completeness)
4. フォーマット遵守 (format_compliance)
5. 有用性 (usefulness)

【厳守事項】
- 採点は上記の【このケースで特に重視すべき観点】を最優先の判断材料とすること
- 出力は以下のJSON形式のみとし、前置き・説明文・Markdownのコードブロック記号は一切付けないこと

【出力形式】
{{
  "scores_1": {{"relevance": 整数1-5, "faithfulness": 整数1-5, "completeness": 整数1-5, "format_compliance": 整数1-5, "usefulness": 整数1-5}},
  "scores_2": {{"relevance": 整数1-5, "faithfulness": 整数1-5, "completeness": 整数1-5, "format_compliance": 整数1-5, "usefulness": 整数1-5}},
  "scores_3": {{"relevance": 整数1-5, "faithfulness": 整数1-5, "completeness": 整数1-5, "format_compliance": 整数1-5, "usefulness": 整数1-5}},
  "winner": "1" または "2" または "3" または "tie",
  "reasoning": "どれが優れているか、および理由を2-3文で説明"
}}"""


def run_three_way_judge(client: GeminiClient, question: str, context: str, judge_focus: str,
                         response_hybrid: str, response_a: str, response_b: str) -> dict:
    """3候補の提示順をランダム化し、judgeにはラベルを伏せてバイアスを防ぐ"""
    candidates = [("hybrid", response_hybrid), ("prompt_A", response_a), ("prompt_B", response_b)]
    random.shuffle(candidates)
    label_by_slot = {str(i + 1): candidates[i][0] for i in range(3)}

    prompt = JUDGE_PROMPT_TEMPLATE.format(
        question=question, context=context, judge_focus=judge_focus,
        response_1=candidates[0][1], response_2=candidates[1][1], response_3=candidates[2][1],
    )
    result = call_with_quota_retry(generate_json_robust, client, prompt)

    winner_raw = str(result.get("winner", "tie"))
    winner = label_by_slot.get(winner_raw, "tie")

    scores_by_label = {
        label_by_slot["1"]: result.get("scores_1"),
        label_by_slot["2"]: result.get("scores_2"),
        label_by_slot["3"]: result.get("scores_3"),
    }
    return {"winner": winner, "scores": scores_by_label, "reasoning": result.get("reasoning")}


def load_prior_ab_results() -> dict:
    """A単体・B単体の回答を、既存の evaluation_results.json から読み込む（再生成しない）"""
    path = Path(PRIOR_AB_RESULTS_FILE)
    if not path.exists():
        raise FileNotFoundError(
            f"{PRIOR_AB_RESULTS_FILE} が見つかりません。"
            "先に evaluate_prompt_variations.py を8カテゴリ完走させてから実行してください。"
        )
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return {r["category"]: r for r in data["results"]}


def load_existing_results() -> dict:
    path = Path(RESULTS_FILE)
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"win_counts": {"hybrid": 0, "prompt_A": 0, "prompt_B": 0, "tie": 0}, "results": []}


def save_results(win_counts: dict, all_results: list) -> None:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    with open(RESULTS_FILE, "w", encoding="utf-8") as f:
        json.dump({
            "last_updated": datetime.now().isoformat(),
            "win_counts": win_counts,
            "results": all_results,
        }, f, ensure_ascii=False, indent=2)


def main() -> None:
    if len(sys.argv) > 1:
        selected_indices = [int(a) for a in sys.argv[1:]]
        queries_to_run = [(i, TEST_QUERIES[i - 1]) for i in selected_indices]
    else:
        queries_to_run = list(enumerate(TEST_QUERIES, start=1))

    prior_ab = load_prior_ab_results()
    existing = load_existing_results()
    win_counts = existing["win_counts"]
    all_results = existing["results"]
    already_done_categories = {r["category"] for r in all_results}

    client = GeminiClient()

    print("=" * 70)
    print("フェーズ3 ハイブリッド版 vs プロンプトA単体 vs プロンプトB単体 比較ログ")
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

        if category not in prior_ab:
            print(f"\n[{i}/{len(TEST_QUERIES)}] カテゴリ「{category}」は {PRIOR_AB_RESULTS_FILE} に見つからないためスキップします。")
            continue

        try:
            prior = prior_ab[category]
            response_a = prior["response_prompt_a"]
            response_b = prior["response_prompt_b"]

            retrieved = search_similar_recipes(question, n_results=4)
            context = client._build_context(retrieved)

            response_hybrid, branch = generate_hybrid_response(client, question, retrieved)
            time.sleep(SECONDS_BETWEEN_CALLS)

            judge_result = run_three_way_judge(
                client, question, context, judge_focus,
                response_hybrid=response_hybrid, response_a=response_a, response_b=response_b,
            )
            time.sleep(SECONDS_BETWEEN_CALLS)

            winner = judge_result["winner"]
            win_counts[winner] += 1

            print(f"\n[{i}/{len(TEST_QUERIES)}] カテゴリ: {category}")
            print(f"クエリ: 「{question}」")
            print(f"検索ヒット件数: {len(retrieved)}件")
            print(f"ハイブリッド判定分岐: {branch}")
            print(f"--- ハイブリッド版の回答 ---\n{response_hybrid}")
            print(f"--- プロンプトA単体の回答（再利用） ---\n{response_a}")
            print(f"--- プロンプトB単体の回答（再利用） ---\n{response_b}")
            print(f"--- judge採点結果 ---")
            print(f"  ハイブリッド スコア: {judge_result['scores'].get('hybrid')}")
            print(f"  プロンプトA スコア: {judge_result['scores'].get('prompt_A')}")
            print(f"  プロンプトB スコア: {judge_result['scores'].get('prompt_B')}")
            print(f"  勝者: {winner}")
            print(f"  理由: {judge_result['reasoning']}")
            print("-" * 70)

            all_results.append({
                "category": category,
                "query": question,
                "hit_count": len(retrieved),
                "hybrid_branch": branch,
                "response_hybrid": response_hybrid,
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

    print("\n" + "=" * 70)
    print("集計結果（累計）")
    print("=" * 70)
    total_done = len(all_results)
    print(f"完了カテゴリ数: {total_done}/{len(TEST_QUERIES)}")
    print(f"ハイブリッド 勝利: {win_counts['hybrid']}/{total_done}")
    print(f"プロンプトA単体 勝利: {win_counts['prompt_A']}/{total_done}")
    print(f"プロンプトB単体 勝利: {win_counts['prompt_B']}/{total_done}")
    print(f"引き分け: {win_counts['tie']}/{total_done}")
    print(f"\n生データを {RESULTS_FILE} に保存しました。")


if __name__ == "__main__":
    main()
