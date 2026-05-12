"""Операции работы с пользователями в БД."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


async def get_by_id(db: AsyncSession, user_id: int) -> User | None:
    return await db.get(User, user_id)


async def get_by_email(db: AsyncSession, email: str) -> User | None:
    """Email сравниваем регистронезависимо: храним всегда в lower-case,
    но на всякий случай нормализуем входной."""
    stmt = select(User).where(User.email == email.lower())
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def list_all(
    db: AsyncSession,
    *,
    active_only: bool = True,
) -> list[User]:
    stmt = select(User).order_by(User.full_name.is_(None), User.full_name, User.email)
    if active_only:
        stmt = stmt.where(User.is_active.is_(True))
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def count_admins(db: AsyncSession, *, active_only: bool = True) -> int:
    """Считает админов, чтобы не оставить систему без них."""
    from sqlalchemy import func

    stmt = select(func.count()).select_from(User).where(User.role == "admin")
    if active_only:
        stmt = stmt.where(User.is_active.is_(True))
    result = await db.execute(stmt)
    return int(result.scalar() or 0)


async def apply_patch(db: AsyncSession, user: User, patch: dict[str, object]) -> User:
    for field, value in patch.items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return user


async def create(
    db: AsyncSession,
    *,
    email: str,
    password_hash: str,
    role: str,
    full_name: str | None = None,
) -> User:
    user = User(
        email=email.lower(),
        password_hash=password_hash,
        full_name=full_name,
        role=role,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
