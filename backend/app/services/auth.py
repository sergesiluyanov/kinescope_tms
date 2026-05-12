"""Бизнес-логика аутентификации.

Здесь живут проверки домена, политики паролей и решение, кого делать админом.
Тонкий слой между HTTP-роутами и БД-операциями.
"""

from __future__ import annotations

import re

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import hash_password, verify_password
from app.crud import user as user_crud
from app.models.user import User, UserRole

_settings = get_settings()


class AuthError(HTTPException):
    """Базовое 4xx-исключение для проблем аутентификации."""


def _validate_email_domain(email: str) -> None:
    domain = email.rsplit("@", 1)[-1].lower()
    expected = _settings.allowed_email_domain.lower()
    if domain != expected:
        raise AuthError(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Регистрация разрешена только для @{expected}",
        )


def _validate_password_strength(password: str) -> None:
    """Минимальная политика: ≥10 символов, есть буква и цифра.

    Специально не требуем спецсимволов и mixed-case — это раздражает и
    в современных рекомендациях NIST уже не считается must-have.
    """
    if len(password) < 10:
        raise AuthError(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пароль должен быть не короче 10 символов",
        )
    if not re.search(r"[A-Za-zА-Яа-яЁё]", password):
        raise AuthError(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пароль должен содержать хотя бы одну букву",
        )
    if not re.search(r"\d", password):
        raise AuthError(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пароль должен содержать хотя бы одну цифру",
        )


def _resolve_role_for_email(email: str) -> UserRole:
    if email.lower() in _settings.admin_emails:
        return UserRole.admin
    return UserRole.qa


async def register_user(
    db: AsyncSession,
    *,
    email: str,
    password: str,
    full_name: str | None,
) -> User:
    email = email.strip().lower()
    _validate_email_domain(email)
    _validate_password_strength(password)

    existing = await user_crud.get_by_email(db, email)
    if existing is not None:
        raise AuthError(
            status_code=status.HTTP_409_CONFLICT,
            detail="Пользователь с таким email уже существует",
        )

    role = _resolve_role_for_email(email)
    return await user_crud.create(
        db,
        email=email,
        password_hash=hash_password(password),
        role=role.value,
        full_name=full_name.strip() if full_name else None,
    )


async def change_password(
    db: AsyncSession,
    *,
    user: User,
    current_password: str,
    new_password: str,
) -> None:
    """Меняет пароль текущего пользователя. Бросает 400 при ошибках."""

    if not verify_password(current_password, user.password_hash):
        raise AuthError(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Текущий пароль введён неверно",
        )
    if current_password == new_password:
        raise AuthError(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Новый пароль должен отличаться от текущего",
        )
    _validate_password_strength(new_password)

    user.password_hash = hash_password(new_password)
    await db.commit()


async def authenticate(db: AsyncSession, *, email: str, password: str) -> User:
    """Успешный логин или AuthError 401.

    Сообщение специально одинаковое и для несуществующего email, и для
    неверного пароля — чтобы не раскрывать, какие email'ы есть в системе.
    """
    invalid = AuthError(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Неверный email или пароль",
    )

    user = await user_crud.get_by_email(db, email.strip().lower())
    if user is None or not user.is_active:
        # Всё равно вызовем verify_password с фейковым хэшем, чтобы время
        # ответа не отличалось — мелкая защита от user-enumeration по таймингам.
        verify_password(password, "$2b$12$" + "a" * 53)
        raise invalid

    if not verify_password(password, user.password_hash):
        raise invalid

    return user
