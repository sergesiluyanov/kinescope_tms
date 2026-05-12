"""CRUD-операции для баг-репортов."""

from __future__ import annotations

from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.bug import Bug


def _with_relations() -> Any:
    return [selectinload(Bug.reporter), selectinload(Bug.assignee)]


async def list_for_project(
    db: AsyncSession,
    project_id: int,
    *,
    status: str | None = None,
    severity: str | None = None,
    priority: str | None = None,
    assignee_id: int | None = None,
    reporter_id: int | None = None,
    search: str | None = None,
    limit: int = 200,
    offset: int = 0,
) -> list[Bug]:
    stmt = (
        select(Bug)
        .where(Bug.project_id == project_id)
        .options(*_with_relations())
        .order_by(Bug.updated_at.desc(), Bug.id.desc())
    )
    if status:
        stmt = stmt.where(Bug.status == status)
    if severity:
        stmt = stmt.where(Bug.severity == severity)
    if priority:
        stmt = stmt.where(Bug.priority == priority)
    if assignee_id is not None:
        stmt = stmt.where(Bug.assignee_id == assignee_id)
    if reporter_id is not None:
        stmt = stmt.where(Bug.reporter_id == reporter_id)
    if search:
        like = f"%{search.strip()}%"
        stmt = stmt.where(or_(Bug.title.ilike(like), Bug.description.ilike(like)))
    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_by_id(db: AsyncSession, bug_id: int) -> Bug | None:
    stmt = select(Bug).where(Bug.id == bug_id).options(*_with_relations())
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create(
    db: AsyncSession,
    *,
    project_id: int,
    title: str,
    description: str | None,
    steps_to_reproduce: str | None,
    actual_result: str | None,
    expected_result: str | None,
    environment: str | None,
    severity: str,
    priority: str,
    status: str,
    tags: list[str],
    reporter_id: int | None,
    assignee_id: int | None,
    test_case_id: int | None,
) -> Bug:
    bug = Bug(
        project_id=project_id,
        title=title,
        description=description,
        steps_to_reproduce=steps_to_reproduce,
        actual_result=actual_result,
        expected_result=expected_result,
        environment=environment,
        severity=severity,
        priority=priority,
        status=status,
        tags=tags,
        reporter_id=reporter_id,
        assignee_id=assignee_id,
        test_case_id=test_case_id,
    )
    db.add(bug)
    await db.commit()
    return await get_by_id(db, bug.id)  # type: ignore[return-value]


async def apply_patch(db: AsyncSession, bug: Bug, patch: dict[str, Any]) -> Bug:
    for field, value in patch.items():
        setattr(bug, field, value)
    await db.commit()
    refreshed = await get_by_id(db, bug.id)
    assert refreshed is not None
    return refreshed


async def delete(db: AsyncSession, bug: Bug) -> None:
    await db.delete(bug)
    await db.commit()
