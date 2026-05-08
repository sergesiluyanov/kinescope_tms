"""Общие FastAPI-dependencies (current_user, ролевые гарды)."""

from __future__ import annotations

from collections.abc import Iterable

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import TokenType, decode_token
from app.crud import user as user_crud
from app.models.user import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login",
    auto_error=False,
)


def _credentials_exception(detail: str = "Не авторизован") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not token:
        raise _credentials_exception()

    try:
        payload = decode_token(token, expected_type=TokenType.access)
    except jwt.ExpiredSignatureError as exc:
        raise _credentials_exception("Токен истёк") from exc
    except jwt.PyJWTError as exc:
        raise _credentials_exception("Невалидный токен") from exc

    user_id_raw = payload.get("sub")
    if not user_id_raw:
        raise _credentials_exception("Невалидный токен (нет sub)")

    try:
        user_id = int(user_id_raw)
    except (TypeError, ValueError) as exc:
        raise _credentials_exception("Невалидный токен (битый sub)") from exc

    user = await user_crud.get_by_id(db, user_id)
    if user is None or not user.is_active:
        raise _credentials_exception("Пользователь не найден или деактивирован")

    return user


def require_roles(*roles: UserRole):
    """Зависимость-декоратор: пускать только пользователей с указанными ролями."""

    allowed: set[str] = {role.value for role in roles}

    async def _checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Недостаточно прав",
            )
        return user

    _checker.__name__ = f"require_roles_{'_'.join(sorted(allowed)) or 'any'}"
    return _checker


def require_admin():
    return require_roles(UserRole.admin)


def require_qa_or_higher():
    """Базовая запись/редактирование: qa, qa_lead, admin (но не viewer)."""
    return require_roles(UserRole.qa, UserRole.qa_lead, UserRole.admin)


def has_any_role(user: User, roles: Iterable[UserRole]) -> bool:
    """Утилита для ручных проверок внутри хэндлеров."""
    return user.role in {role.value for role in roles}
