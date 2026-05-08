"""CRUD-операции для проектов."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project


async def list_all(db: AsyncSession) -> list[Project]:
    stmt = select(Project).order_by(Project.name)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_by_id(db: AsyncSession, project_id: int) -> Project | None:
    return await db.get(Project, project_id)


async def create(
    db: AsyncSession,
    *,
    name: str,
    description: str | None,
    created_by_id: int | None,
) -> Project:
    project = Project(
        name=name,
        description=description,
        created_by_id=created_by_id,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


async def apply_patch(
    db: AsyncSession,
    project: Project,
    patch: dict[str, object],
) -> Project:
    """Применить только переданные клиентом поля (см. exclude_unset=True)."""
    for field, value in patch.items():
        setattr(project, field, value)
    await db.commit()
    await db.refresh(project)
    return project


async def delete(db: AsyncSession, project: Project) -> None:
    await db.delete(project)
    await db.commit()
