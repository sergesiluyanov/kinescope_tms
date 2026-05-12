"""Pydantic-схемы пользователя для API."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import UserRole


class UserPublic(BaseModel):
    """То, что мы готовы показать наружу."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str | None = None
    role: UserRole
    is_active: bool
    created_at: datetime


class UserRegisterRequest(BaseModel):
    """Регистрация нового пользователя."""

    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)


class UserLoginRequest(BaseModel):
    """Логин."""

    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class PasswordChangeRequest(BaseModel):
    """Смена пароля для текущего пользователя."""

    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=10, max_length=128)


class UserAdminUpdateRequest(BaseModel):
    """Изменение роли/активности пользователя из админки."""

    role: UserRole | None = None
    is_active: bool | None = None
