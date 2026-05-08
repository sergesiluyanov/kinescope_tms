"""Pydantic-схемы для эндпоинтов аутентификации."""

from __future__ import annotations

from pydantic import BaseModel

from app.schemas.user import UserPublic


class TokenResponse(BaseModel):
    """Ответ /auth/login и /auth/refresh.

    Refresh-токен НЕ возвращается в теле ответа — он выставляется в httpOnly-cookie.
    """

    access_token: str
    token_type: str = "bearer"
    user: UserPublic
