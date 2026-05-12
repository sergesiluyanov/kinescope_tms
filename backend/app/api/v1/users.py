"""Эндпоинты для работы со списком пользователей."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_admin
from app.core.database import get_db
from app.crud import user as user_crud
from app.models.user import User, UserRole
from app.schemas.user import UserAdminUpdateRequest, UserPublic

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserPublic])
async def list_users(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[UserPublic]:
    """Возвращает всех пользователей системы — нужен для выпадашек
    (assignee, фильтры) и для админки. Доступен любому залогиненному."""

    users = await user_crud.list_all(db, active_only=active_only)
    return [UserPublic.model_validate(u) for u in users]


@router.patch("/{user_id}", response_model=UserPublic)
async def update_user(
    user_id: int,
    payload: UserAdminUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin()),
) -> UserPublic:
    """Только для админов: меняем роль и/или активность.

    Защищаемся от случая «единственный админ снимает с себя права» —
    тогда система останется без админов и никто не сможет назначить новых.
    """

    target = await user_crud.get_by_id(db, user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    patch_raw = payload.model_dump(exclude_unset=True)
    patch: dict[str, object] = {}

    new_role = patch_raw.get("role")
    new_active = patch_raw.get("is_active")

    will_lose_admin = (
        target.role == UserRole.admin.value
        and (
            (new_role is not None and new_role != UserRole.admin)
            or (new_active is False)
        )
    )
    if will_lose_admin:
        active_admins = await user_crud.count_admins(db, active_only=True)
        if active_admins <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Нельзя оставить систему без активных администраторов",
            )

    if target.id == current_user.id and new_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя деактивировать самого себя",
        )

    if new_role is not None:
        patch["role"] = new_role.value if isinstance(new_role, UserRole) else new_role
    if new_active is not None:
        patch["is_active"] = new_active

    if not patch:
        return UserPublic.model_validate(target)

    target = await user_crud.apply_patch(db, target, patch)
    return UserPublic.model_validate(target)
