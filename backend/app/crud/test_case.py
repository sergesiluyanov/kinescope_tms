"""CRUD-операции для тест-кейсов."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.section import Section
from app.models.test_case import TestCase, TestCaseStatus


async def list_for_project(
    db: AsyncSession,
    project_id: int,
    *,
    include_archived: bool = False,
) -> list[tuple[TestCase, Section]]:
    """Все кейсы проекта одним запросом — вместе с разделом каждого кейса.

    Нужен для полной выгрузки: обходить разделы по одному и дёргать
    `/test-cases/{id}` за деталями слишком дорого.
    """
    stmt = (
        select(TestCase, Section)
        .join(Section, Section.id == TestCase.section_id)
        .where(Section.project_id == project_id)
        .order_by(Section.position, Section.id, TestCase.id)
    )
    if not include_archived:
        stmt = stmt.where(TestCase.status == TestCaseStatus.active.value)
    result = await db.execute(stmt)
    return [(case, section) for case, section in result.all()]


async def list_for_section(
    db: AsyncSession,
    section_id: int,
    *,
    include_archived: bool = False,
) -> list[TestCase]:
    stmt = (
        select(TestCase)
        .where(TestCase.section_id == section_id)
        .order_by(TestCase.id.desc())
    )
    if not include_archived:
        stmt = stmt.where(TestCase.status == TestCaseStatus.active.value)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_by_id(db: AsyncSession, test_case_id: int) -> TestCase | None:
    return await db.get(TestCase, test_case_id)


async def create(
    db: AsyncSession,
    *,
    section_id: int,
    title: str,
    preconditions: str | None,
    steps: list[dict[str, Any]],
    priority: str,
    tags: list[str],
    created_by_id: int | None,
) -> TestCase:
    case = TestCase(
        section_id=section_id,
        title=title,
        preconditions=preconditions,
        steps=steps,
        priority=priority,
        tags=tags,
        created_by_id=created_by_id,
    )
    db.add(case)
    await db.commit()
    await db.refresh(case)
    return case


async def apply_patch(
    db: AsyncSession,
    case: TestCase,
    patch: dict[str, Any],
) -> TestCase:
    for field, value in patch.items():
        setattr(case, field, value)
    await db.commit()
    await db.refresh(case)
    return case


async def delete(db: AsyncSession, case: TestCase) -> None:
    await db.delete(case)
    await db.commit()
