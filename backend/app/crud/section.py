"""CRUD-операции для разделов."""

from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.section import Section


async def list_for_project(db: AsyncSession, project_id: int) -> list[Section]:
    stmt = (
        select(Section)
        .where(Section.project_id == project_id)
        .order_by(Section.parent_id.nullsfirst(), Section.position, Section.id)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_by_id(db: AsyncSession, section_id: int) -> Section | None:
    return await db.get(Section, section_id)


async def _next_position(
    db: AsyncSession, project_id: int, parent_id: int | None
) -> int:
    stmt = select(func.coalesce(func.max(Section.position), -1)).where(
        Section.project_id == project_id,
        Section.parent_id.is_(None) if parent_id is None else Section.parent_id == parent_id,
    )
    result = await db.execute(stmt)
    last = result.scalar_one()
    return int(last) + 1


async def next_position(
    db: AsyncSession, project_id: int, parent_id: int | None
) -> int:
    """Публичная обёртка над `_next_position` — нужна вызывающему коду
    (например, при перемещении раздела между родителями)."""
    return await _next_position(db, project_id, parent_id)


async def create(
    db: AsyncSession,
    *,
    project_id: int,
    name: str,
    description: str | None,
    parent_id: int | None,
) -> Section:
    position = await _next_position(db, project_id, parent_id)
    section = Section(
        project_id=project_id,
        parent_id=parent_id,
        name=name,
        description=description,
        position=position,
    )
    db.add(section)
    await db.commit()
    await db.refresh(section)
    return section


async def apply_patch(
    db: AsyncSession,
    section: Section,
    patch: dict[str, Any],
) -> Section:
    """Применить только переданные клиентом поля (см. exclude_unset=True)."""
    for field, value in patch.items():
        setattr(section, field, value)
    await db.commit()
    await db.refresh(section)
    return section


async def delete(db: AsyncSession, section: Section) -> None:
    await db.delete(section)
    await db.commit()
