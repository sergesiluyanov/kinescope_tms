"""Эндпоинты для работы со списком пользователей."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.crud import user as user_crud
from app.models.user import User
from app.schemas.user import UserPublic

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserPublic])
async def list_users(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[UserPublic]:
    """Возвращает всех пользователей системы — нужен для выпадашек
    (assignee, фильтры). Доступен любому залогиненному."""

    users = await user_crud.list_all(db, active_only=active_only)
    return [UserPublic.model_validate(u) for u in users]
