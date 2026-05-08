"""Хеширование паролей и JWT-токены."""

from __future__ import annotations

import enum
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt

from app.core.config import get_settings

_settings = get_settings()


class TokenType(str, enum.Enum):
    access = "access"
    refresh = "refresh"


def hash_password(plain_password: str) -> str:
    """Захэшировать пароль bcrypt'ом (работает в обе стороны через verify_password)."""
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("ascii")


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Проверить, что plain соответствует ранее сохранённому хэшу."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def _create_token(subject: str, token_type: TokenType, expires_in: timedelta) -> str:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type.value,
        "iat": int(now.timestamp()),
        "exp": int((now + expires_in).timestamp()),
    }
    return jwt.encode(payload, _settings.jwt_secret, algorithm=_settings.jwt_algorithm)


def create_access_token(subject: str | int) -> str:
    return _create_token(
        subject=str(subject),
        token_type=TokenType.access,
        expires_in=timedelta(minutes=_settings.access_token_expire_minutes),
    )


def create_refresh_token(subject: str | int) -> str:
    return _create_token(
        subject=str(subject),
        token_type=TokenType.refresh,
        expires_in=timedelta(days=_settings.refresh_token_expire_days),
    )


def decode_token(token: str, expected_type: TokenType | None = None) -> dict[str, Any]:
    """Декодировать JWT. Кидает jwt.PyJWTError при невалидном/истёкшем токене."""
    payload = jwt.decode(
        token,
        _settings.jwt_secret,
        algorithms=[_settings.jwt_algorithm],
    )
    if expected_type is not None and payload.get("type") != expected_type.value:
        raise jwt.InvalidTokenError(
            f"expected token type {expected_type.value}, got {payload.get('type')!r}"
        )
    return payload
