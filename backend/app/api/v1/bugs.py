"""Эндпоинты баг-репортов."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_current_user,
    require_qa_lead_or_admin,
    require_qa_or_higher,
)
from app.core.database import get_db
from app.crud import bug as bug_crud
from app.crud import project as project_crud
from app.crud import test_case as test_case_crud
from app.crud import user as user_crud
from app.models.bug import BugPriority, BugSeverity, BugStatus
from app.models.user import User
from app.schemas.bug import (
    BugCreateRequest,
    BugResponse,
    BugSummary,
    BugUpdateRequest,
)

router = APIRouter(tags=["bugs"])


async def _ensure_assignee(db: AsyncSession, assignee_id: int | None) -> None:
    if assignee_id is None:
        return
    assignee = await user_crud.get_by_id(db, assignee_id)
    if assignee is None or not assignee.is_active:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Указанный исполнитель не найден",
        )


async def _ensure_test_case(
    db: AsyncSession, project_id: int, test_case_id: int | None
) -> None:
    if test_case_id is None:
        return
    case = await test_case_crud.get_by_id(db, test_case_id)
    if case is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Связанный тест-кейс не найден",
        )
    # Кейс должен принадлежать тому же проекту, что и баг.
    # У TestCase нет прямого project_id — идём через секцию.
    from app.crud import section as section_crud

    section = await section_crud.get_by_id(db, case.section_id)
    if section is None or section.project_id != project_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Тест-кейс принадлежит другому проекту",
        )


@router.get("/projects/{project_id}/bugs", response_model=list[BugSummary])
async def list_bugs(
    project_id: int,
    status_filter: BugStatus | None = Query(default=None, alias="status"),
    severity: BugSeverity | None = None,
    priority: BugPriority | None = None,
    assignee_id: int | None = None,
    reporter_id: int | None = None,
    search: str | None = None,
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[BugSummary]:
    project = await project_crud.get_by_id(db, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Проект не найден")

    items = await bug_crud.list_for_project(
        db,
        project_id,
        status=status_filter.value if status_filter else None,
        severity=severity.value if severity else None,
        priority=priority.value if priority else None,
        assignee_id=assignee_id,
        reporter_id=reporter_id,
        search=search,
        limit=limit,
        offset=offset,
    )
    return [BugSummary.model_validate(b) for b in items]


@router.post(
    "/projects/{project_id}/bugs",
    response_model=BugResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_bug(
    project_id: int,
    payload: BugCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_qa_or_higher()),
) -> BugResponse:
    project = await project_crud.get_by_id(db, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Проект не найден")

    await _ensure_assignee(db, payload.assignee_id)
    await _ensure_test_case(db, project_id, payload.test_case_id)

    bug = await bug_crud.create(
        db,
        project_id=project_id,
        title=payload.title.strip(),
        description=payload.description,
        steps_to_reproduce=payload.steps_to_reproduce,
        actual_result=payload.actual_result,
        expected_result=payload.expected_result,
        environment=payload.environment,
        severity=payload.severity.value,
        priority=payload.priority.value,
        status=payload.status.value,
        tags=[t.strip() for t in payload.tags if t.strip()],
        reporter_id=user.id,
        assignee_id=payload.assignee_id,
        test_case_id=payload.test_case_id,
    )
    return BugResponse.model_validate(bug)


@router.get("/bugs/{bug_id}", response_model=BugResponse)
async def get_bug(
    bug_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> BugResponse:
    bug = await bug_crud.get_by_id(db, bug_id)
    if bug is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Баг не найден")
    return BugResponse.model_validate(bug)


@router.patch("/bugs/{bug_id}", response_model=BugResponse)
async def update_bug(
    bug_id: int,
    payload: BugUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_qa_or_higher()),
) -> BugResponse:
    bug = await bug_crud.get_by_id(db, bug_id)
    if bug is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Баг не найден")

    patch_raw = payload.model_dump(exclude_unset=True)
    patch: dict[str, object] = {}

    if "assignee_id" in patch_raw:
        await _ensure_assignee(db, patch_raw["assignee_id"])
        patch["assignee_id"] = patch_raw["assignee_id"]

    if "test_case_id" in patch_raw:
        await _ensure_test_case(db, bug.project_id, patch_raw["test_case_id"])
        patch["test_case_id"] = patch_raw["test_case_id"]

    for key in (
        "title",
        "description",
        "steps_to_reproduce",
        "actual_result",
        "expected_result",
        "environment",
        "tags",
    ):
        if key in patch_raw:
            patch[key] = patch_raw[key]

    for key in ("severity", "priority", "status"):
        if key in patch_raw and patch_raw[key] is not None:
            patch[key] = patch_raw[key].value

    if "title" in patch and isinstance(patch["title"], str):
        patch["title"] = patch["title"].strip()

    bug = await bug_crud.apply_patch(db, bug, patch)
    return BugResponse.model_validate(bug)


@router.delete("/bugs/{bug_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bug(
    bug_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_qa_lead_or_admin()),
) -> None:
    bug = await bug_crud.get_by_id(db, bug_id)
    if bug is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Баг не найден")
    await bug_crud.delete(db, bug)
