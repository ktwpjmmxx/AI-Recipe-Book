"""
auth.py — JWT 認証の中核ロジック

v4.3.1 追加:
  - validate_password_strength(): パスワード強度を強制するバリデーション関数
    最低3種類（英大文字・英小文字・数字・記号のうち3種類以上）を必須化する。
    register / change_password の両方からこの関数を呼ぶことで、
    ポリシーをバックエンドの1箇所に集約する（フロントのチェックはバイパス可能なため
    バックエンドでの強制が必須）。
"""
from __future__ import annotations
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from config import settings
from database import get_db

# ── パスワードハッシュ ────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── パスワード強度ポリシー（v4.3.1 追加） ──────
_MIN_LENGTH    = 8
_WEAK_PATTERNS = (
    re.compile(r"^(password|passw0rd|qwerty|12345678|11111111)$", re.IGNORECASE),
)

def validate_password_strength(password: str) -> None:
    """
    パスワード強度を検証する。条件を満たさない場合は HTTPException(422) を送出する。

    ポリシー:
      - 8文字以上
      - 英大文字 / 英小文字 / 数字 / 記号 のうち、最低3種類を含む
        （「12345678」のような数字のみ・「abcdefgh」のような英字のみを拒否する）
      - よくある弱いパスワード文字列を明示的に拒否
    """
    if len(password) < _MIN_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"パスワードは{_MIN_LENGTH}文字以上で設定してください。",
        )

    for pattern in _WEAK_PATTERNS:
        if pattern.match(password):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="このパスワードは推測されやすいため使用できません。",
            )

    has_lower  = bool(re.search(r"[a-z]", password))
    has_upper  = bool(re.search(r"[A-Z]", password))
    has_digit  = bool(re.search(r"[0-9]", password))
    has_symbol = bool(re.search(r"[^a-zA-Z0-9]", password))

    variety = sum([has_lower, has_upper, has_digit, has_symbol])

    if variety < 3:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "パスワードには英大文字・英小文字・数字・記号のうち"
                "最低3種類を含めてください。"
            ),
        )


# ── JWT 発行・デコード ────────────────────────
ALGORITHM = "HS256"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def create_access_token(user_id: int, email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        seconds=settings.jwt_lifetime_seconds
    )
    payload = {
        "sub":   str(user_id),
        "email": email,
        "exp":   expire,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])


# ── 現在のユーザーを取得する依存関数 ────────────
def get_current_user(
    token: str = Depends(oauth2_scheme),
    db:    Session = Depends(get_db),
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="認証情報が無効です。再度ログインしてください。",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        user_id: Optional[str] = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    from models import UserORM
    user = db.query(UserORM).filter(UserORM.id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    return user
