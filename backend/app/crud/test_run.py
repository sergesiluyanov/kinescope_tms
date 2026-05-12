"""CRUD-операции для тест-ранов и их пунктов."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.section import Section
from app.models.test_case import TestCase, TestCaseStatus
from app.models.test_run import TestRun, TestRunItem


def _run_with_relations() -> list[Any]:
    return [
        selectinload(TestRun.created_by),
        selectinload(TestRun.items).selectinload(TestRunItem.assignee),
        selectinload(TestRun.items).selectinload(TestRunItem.executed_by),
    ]


async def list_for_project(db: AsyncSession, project_id: int) -> list[TestRun]:
    stmt = (
        select(TestRun)
        .where(TestRun.project_id == project_id)
        .options(*_run_with_relations())
        .order_by(TestRun.created_at.desc(), TestRun.id.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().unique().all())


async def get_by_id(db: AsyncSession, run_id: int) -> TestRun | None:
    stmt = select(TestRun).where(TestRun.id == run_id).options(*_run_with_relations())
    result = await db.execute(stmt)
    return result.unique().scalar_one_or_none()


async def _collect_descendant_section_ids(
    db: AsyncSession,
    project_id: int,
    root_ids: list[int],
) -> set[int]:
    """Возвращает root_ids + все вложенные разделы того же проекта.

    Сделано в Python в один проход по всем секциям проекта (их обычно
    немного). Для огромных проектов можно переписать на рекурсивный CTE.
    """
    if not root_ids:
        return set()
    stmt = select(Section.id, Section.parent_id).where(Section.project_id == project_id)
    result = await db.execute(stmt)
    rows = list(result.all())
    children: dict[int | None, list[int]] = {}
    for sid, pid in rows:
        children.setdefault(pid, []).append(sid)
    collected: set[int] = set()
    stack = list(root_ids)
    while stack:
        sid = stack.pop()
        if sid in collected:
            continue
        collected.add(sid)
        stack.extend(children.get(sid, []))
    return collected


async def collect_cases_for_run(
    db: AsyncSession,
    *,
    project_id: int,
    section_ids: list[int],
    include_subsections: bool,
    extra_case_ids: list[int],
) -> list[TestCase]:
    target_section_ids: set[int] = set()
    if section_ids:
        if include_subsections:
            target_section_ids = await _collect_descendant_section_ids(
                db, project_id, section_ids
            )
        else:
            target_section_ids = set(section_ids)

    cases: dict[int, TestCase] = {}

    if target_section_ids:
        # Ограничиваем активные кейсы и проверяем принадлежность проекту через
        # join секций.
        stmt = (
            select(TestCase)
            .join(Section, TestCase.section_id == Section.id)
            .where(
                Section.project_id == project_id,
                TestCase.section_id.in_(target_section_ids),
                TestCase.status == TestCaseStatus.active.value,
            )
            .order_by(TestCase.section_id, TestCase.id)
        )
        result = await db.execute(stmt)
        for case in result.scalars().all():
            cases[case.id] = case

    if extra_case_ids:
        stmt = (
            select(TestCase)
            .join(Section, TestCase.section_id == Section.id)
            .where(
                Section.project_id == project_id,
                TestCase.id.in_(extra_case_ids),
            )
        )
        result = await db.execute(stmt)
        for case in result.scalars().all():
            cases[case.id] = case

    return sorted(cases.values(), key=lambda c: (c.section_id, c.id))


async def create_run(
    db: AsyncSession,
    *,
    project_id: int,
    name: str,
    description: str | None,
    environment: str | None,
    created_by_id: int | None,
    cases: list[TestCase],
) -> TestRun:
    run = TestRun(
        project_id=project_id,
        name=name,
        description=description,
        environment=environment,
        created_by_id=created_by_id,
    )
    db.add(run)
    await db.flush()  # получаем run.id, но не коммитим — наполним пункты

    for position, case in enumerate(cases):
        item = TestRunItem(
            test_run_id=run.id,
            test_case_id=case.id,
            title=case.title,
            preconditions=case.preconditions,
            steps=case.steps or [],
            priority=case.priority,
            tags=list(case.tags or []),
            position=position,
        )
        db.add(item)

    await db.commit()
    refreshed = await get_by_id(db, run.id)
    assert refreshed is not None
    return refreshed


async def apply_patch(db: AsyncSession, run: TestRun, patch: dict[str, Any]) -> TestRun:
    for field, value in patch.items():
        setattr(run, field, value)
    await db.commit()
    refreshed = await get_by_id(db, run.id)
    assert refreshed is not None
    return refreshed


async def delete(db: AsyncSession, run: TestRun) -> None:
    await db.delete(run)
    await db.commit()


# ----- Пункты прогона -----


def _item_relations() -> list[Any]:
    return [
        selectinload(TestRunItem.assignee),
        selectinload(TestRunItem.executed_by),
    ]


async def get_item_by_id(db: AsyncSession, item_id: int) -> TestRunItem | None:
    stmt = select(TestRunItem).where(TestRunItem.id == item_id).options(*_item_relations())
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def apply_item_patch(
    db: AsyncSession,
    item: TestRunItem,
    patch: dict[str, Any],
) -> TestRunItem:
    for field, value in patch.items():
        setattr(item, field, value)
    await db.commit()
    refreshed = await get_item_by_id(db, item.id)
    assert refreshed is not None
    return refreshed
