"""
errors.py — 統一エラーレスポンス形式のヘルパー

フェーズ3で導入。既存の各router内の `raise HTTPException(status_code, "message")`
は一切変更せず、main.py側の例外ハンドラでこのモジュールを使って
レスポンスボディを統一形式 {"error": {"code": ..., "message": ...}} に変換する。
"""
from __future__ import annotations

_STATUS_CODE_MAP: dict[int, str] = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    413: "PAYLOAD_TOO_LARGE",
    422: "UNPROCESSABLE_ENTITY",
    429: "TOO_MANY_REQUESTS",
    500: "INTERNAL_ERROR",
}


def code_for_status(status_code: int) -> str:
    """HTTPステータスコードから統一エラーコード文字列を求める。"""
    return _STATUS_CODE_MAP.get(status_code, f"HTTP_{status_code}")


def build_error_body(code: str, message: str, details: object | None = None) -> dict:
    """統一エラーレスポンスのボディを組み立てる。"""
    body = {"error": {"code": code, "message": message}}
    if details is not None:
        body["error"]["details"] = details
    return body
