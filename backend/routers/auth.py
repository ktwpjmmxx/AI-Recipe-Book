"""
routers/auth.py — 認証・アカウント管理エンドポイント

v4.3.1 変更:
  - register() / change_password() の両方で validate_password_strength() を実行
  - これにより「8文字以上だが単調な文字列」のパスワードを弾く
"""
from __future__ import annotations
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from auth import (
    hash_password, verify_password,
    create_access_token, get_current_user,
    validate_password_strength,   # ← 追加
)
from database import get_db
from models import UserORM
from config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])

_ALLOWED_IMG = {".jpg", ".jpeg", ".png", ".webp"}
_BIO_MAX_LEN = 140


# ── スキーマ ──────────────────────────────────
class RegisterRequest(BaseModel):
    email:        EmailStr
    password:     str      = Field(..., min_length=8)
    display_name: str | None = None


class LoginRequest(BaseModel):
    email:    EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"


class UserResponse(BaseModel):
    id:           int
    email:        str
    display_name: str | None = None
    bio:          str | None = None
    avatar_url:   str | None = None

    model_config = {"from_attributes": True}


class ProfileUpdateRequest(BaseModel):
    display_name: str | None = Field(None, max_length=50)
    bio:           str | None = Field(None, max_length=_BIO_MAX_LEN)


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password:     str = Field(..., min_length=8)


# ── 登録 ──────────────────────────────────────
@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=201,
    summary="新規ユーザー登録",
    description="ユーザーを新規登録し、アクセストークンを発行する。パスワードは8文字以上かつ英大文字/英小文字/数字/記号のうち3種類以上を要求する。",
    responses={
        409: {"description": "メールアドレスが既に登録済み", "content": {"application/json": {"example": {"error": {"code": "CONFLICT", "message": "このメールアドレスはすでに登録されています。"}}}}},
        422: {"description": "パスワード強度不足", "content": {"application/json": {"example": {"error": {"code": "UNPROCESSABLE_ENTITY", "message": "パスワードは8文字以上で設定してください。"}}}}},
    },
)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    """
    新規ユーザーを登録してアクセストークンを返す。

    v4.3.1: パスワード強度ポリシーを適用（最低3種類の文字種を必須化）。
    """
    validate_password_strength(body.password)  # ← 追加

    existing = db.query(UserORM).filter(UserORM.email == body.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="このメールアドレスはすでに登録されています。",
        )

    user = UserORM(
        email=body.email,
        hashed_password=hash_password(body.password),
        display_name=body.display_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, user.email)
    return TokenResponse(access_token=token)


# ── ログイン ──────────────────────────────────
@router.post(
    "/login",
    response_model=TokenResponse,
    summary="ログイン",
    responses={
        401: {"description": "メールアドレスまたはパスワードが誤り", "content": {"application/json": {"example": {"error": {"code": "UNAUTHORIZED", "message": "メールアドレスまたはパスワードが正しくありません。"}}}}},
        403: {"description": "アカウントが無効化されている", "content": {"application/json": {"example": {"error": {"code": "FORBIDDEN", "message": "このアカウントは無効です。"}}}}},
    },
)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(UserORM).filter(UserORM.email == body.email).first()

    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="メールアドレスまたはパスワードが正しくありません。",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="このアカウントは無効です。",
        )

    token = create_access_token(user.id, user.email)
    return TokenResponse(access_token=token)


# ── 現在のユーザー情報 ────────────────────────
@router.get(
    "/me",
    response_model=UserResponse,
    summary="ログイン中ユーザー情報取得",
)
def me(current_user: UserORM = Depends(get_current_user)):
    return current_user


# ── プロフィール編集 ──────────────────────────
@router.patch(
    "/me",
    response_model=UserResponse,
    summary="プロフィール更新",
    description="表示名・自己紹介文（bio、140文字以内）を部分更新する。",
)
def update_profile(
    body:         ProfileUpdateRequest,
    db:           Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user),
):
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(current_user, k, v)
    db.commit()
    db.refresh(current_user)
    return current_user


# ── パスワード変更 ────────────────────────────
@router.patch(
    "/me/password",
    status_code=204,
    summary="パスワード変更",
    responses={
        401: {"description": "現在のパスワードが誤り", "content": {"application/json": {"example": {"error": {"code": "UNAUTHORIZED", "message": "現在のパスワードが正しくありません。"}}}}},
        422: {"description": "新パスワードが強度不足、または現在のパスワードと同一", "content": {"application/json": {"example": {"error": {"code": "UNPROCESSABLE_ENTITY", "message": "新しいパスワードは現在のパスワードと異なるものにしてください。"}}}}},
    },
)
def change_password(
    body:         PasswordChangeRequest,
    db:           Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user),
):
    """
    パスワードを変更する。

    v4.3.1: validate_password_strength() を追加。
    これにより「12345678」のような単調な8文字パスワードへの変更を拒否する。
    """
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="現在のパスワードが正しくありません。",
        )

    validate_password_strength(body.new_password)  # ← 追加

    if body.current_password == body.new_password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="新しいパスワードは現在のパスワードと異なるものにしてください。",
        )

    current_user.hashed_password = hash_password(body.new_password)
    db.commit()


# ── プロフィール画像アップロード ──────────────
@router.post(
    "/me/avatar",
    response_model=UserResponse,
    summary="プロフィール画像アップロード",
    description=f"対応形式: jpg/png/webp。最大サイズ: {settings.max_upload_mb}MB。",
    responses={
        422: {"description": "非対応のファイル形式", "content": {"application/json": {"example": {"error": {"code": "UNPROCESSABLE_ENTITY", "message": "jpg/png/webp のみ対応しています。"}}}}},
        413: {"description": "ファイルサイズ超過", "content": {"application/json": {"example": {"error": {"code": "PAYLOAD_TOO_LARGE", "message": "ファイルサイズが10MBを超えています。"}}}}},
    },
)
async def upload_avatar(
    file:         UploadFile = File(...),
    db:           Session    = Depends(get_db),
    current_user: UserORM    = Depends(get_current_user),
):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in _ALLOWED_IMG:
        raise HTTPException(422, "jpg/png/webp のみ対応しています。")

    max_bytes = settings.max_upload_mb * 1024 * 1024
    path = settings.upload_dir / f"avatar_{uuid.uuid4()}{suffix}"

    size = 0
    with path.open("wb") as buf:
        while chunk := await file.read(65536):
            size += len(chunk)
            if size > max_bytes:
                buf.close()
                path.unlink(missing_ok=True)
                raise HTTPException(413, f"ファイルサイズが {settings.max_upload_mb}MB を超えています。")
            buf.write(chunk)

    current_user.avatar_url = f"/uploads/{path.name}"
    db.commit()
    db.refresh(current_user)
    return current_user
