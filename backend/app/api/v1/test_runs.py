"""Эндпоинты тест-ранов."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_current_user,
    require_qa_lead_or_admin,
    require_qa_or_higher,
)
from app.core.database import get_db
from app.crud import project as project_crud
from app.crud import test_run as run_crud
from app.crud import user as user_crud
from app.models.test_run import TestRun, TestRunItem, TestRunItemStatus, TestRunStatus
from app.models.user import User
from app.schemas.test_run import (
    TestRunCreateRequest,
    TestRunItemResponse,
    TestRunItemUpdateRequest,
    TestRunResponse,
    TestRunStats,
    TestRunSummary,
    TestRunUpdateRequest,
)

router = APIRouter(tags=["test-runs"])


def _stats_from_items(items: list[TestRunItem]) -> TestRunStats:
    counts = {s.value: 0 for s in TestRunItemStatus}
    for item in items:
        counts[item.status] = counts.get(item.status, 0) + 1
    return TestRunStats(
        total=len(items),
        untested=counts[TestRunItemStatus.untested.value],
        passed=counts[TestRunItemStatus.passed.value],
        failed=counts[TestRunItemStatus.failed.value],
        blocked=counts[TestRunItemStatus.blocked.value],
        skipped=counts[TestRunItemStatus.skipped.value],
    )


def _to_summary(run: TestRun) -> TestRunSummary:
    return TestRunSummary(
        id=run.id,
        project_id=run.project_id,
        name=run.name,
        description=run.description,
        status=TestRunStatus(run.status),
        environment=run.environment,
        created_by=run.created_by,  # type: ignore[arg-type]
        started_at=run.started_at,
        completed_at=run.completed_at,
        created_at=run.created_at,
        updated_at=run.updated_at,
        stats=_stats_from_items(list(run.items)),
    )


def _to_response(run: TestRun) -> TestRunResponse:
    items = list(run.items)
    return TestRunResponse(
        id=run.id,
        project_id=run.project_id,
        name=run.name,
        description=run.description,
        status=TestRunStatus(run.status),
        environment=run.environment,
        created_by=run.created_by,  # type: ignore[arg-type]
        started_at=run.started_at,
        completed_at=run.completed_at,
        created_at=run.created_at,
        updated_at=run.updated_at,
        items=[TestRunItemResponse.model_validate(it) for it in items],
        stats=_stats_from_items(items),
    )


@router.get("/projects/{project_id}/test-runs", response_model=list[TestRunSummary])
async def list_test_runs(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[TestRunSummary]:
    project = await project_crud.get_by_id(db, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Проект не найден")

    runs = await run_crud.list_for_project(db, project_id)
    return [_to_summary(r) for r in runs]


@router.post(
    "/projects/{project_id}/test-runs",
    response_model=TestRunResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_test_run(
    project_id: int,
    payload: TestRunCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_qa_or_higher()),
) -> TestRunResponse:
    project = await project_crud.get_by_id(db, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Проект не найден")

    if not payload.section_ids and not payload.case_ids:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Нужно выбрать хотя бы один раздел или тест-кейс",
        )

    cases = await run_crud.collect_cases_for_run(
        db,
        project_id=project_id,
        section_ids=payload.section_ids,
        include_subsections=payload.include_subsections,
        extra_case_ids=payload.case_ids,
    )

    if not cases:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="В выбранных разделах нет активных тест-кейсов",
        )

    run = await run_crud.create_run(
        db,
        project_id=project_id,
        name=payload.name.strip(),
        description=payload.description,
        environment=payload.environment,
        created_by_id=user.id,
        cases=cases,
    )
    return _to_response(run)


@router.get("/test-runs/{run_id}", response_model=TestRunResponse)
async def get_test_run(
    run_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> TestRunResponse:
    run = await run_crud.get_by_id(db, run_id)
    if run is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Прогон не найден")
    return _to_response(run)


@router.patch("/test-runs/{run_id}", response_model=TestRunResponse)
async def update_test_run(
    run_id: int,
    payload: TestRunUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_qa_or_higher()),
) -> TestRunResponse:
    run = await run_crud.get_by_id(db, run_id)
    if run is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Прогон не найден")

    patch_raw = payload.model_dump(exclude_unset=True)
    patch: dict[str, object] = {}

    for key in ("name", "description", "environment"):
        if key in patch_raw:
            value = patch_raw[key]
            patch[key] = value.strip() if isinstance(value, str) else value

    if "status" in patch_raw and patch_raw["status"] is not None:
        new_status: TestRunStatus = patch_raw["status"]
        patch["status"] = new_status.value
        # Авто-проставляем started_at / completed_at для удобства.
        now = datetime.now(UTC)
        if new_status == TestRunStatus.in_progress and run.started_at is None:
            patch["started_at"] = now
        if new_status in (TestRunStatus.completed, TestRunStatus.aborted):
            patch["completed_at"] = now
        if new_status == TestRunStatus.draft:
            patch["started_at"] = None
            patch["completed_at"] = None

    run = await run_crud.apply_patch(db, run, patch)
    return _to_response(run)


@router.delete("/test-runs/{run_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_test_run(
    run_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_qa_lead_or_admin()),
) -> None:
    run = await run_crud.get_by_id(db, run_id)
    if run is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Прогон не найден")
    await run_crud.delete(db, run)


@router.patch(
    "/test-run-items/{item_id}",
    response_model=TestRunItemResponse,
)
async def update_test_run_item(
    item_id: int,
    payload: TestRunItemUpdateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_qa_or_higher()),
) -> TestRunItemResponse:
    item = await run_crud.get_item_by_id(db, item_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Пункт прогона не найден")

    patch_raw = payload.model_dump(exclude_unset=True)
    patch: dict[str, object] = {}

    if "status" in patch_raw and patch_raw["status"] is not None:
        new_status: TestRunItemStatus = patch_raw["status"]
        patch["status"] = new_status.value
        if new_status != TestRunItemStatus.untested:
            patch["executed_by_id"] = user.id
            patch["executed_at"] = datetime.now(UTC)
        else:
            patch["executed_by_id"] = None
            patch["executed_at"] = None

    if "comment" in patch_raw:
        patch["comment"] = patch_raw["comment"]

    if "assignee_id" in patch_raw:
        new_assignee_id = patch_raw["assignee_id"]
        if new_assignee_id is not None:
            assignee = await user_crud.get_by_id(db, new_assignee_id)
            if assignee is None or not assignee.is_active:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    detail="Указанный исполнитель не найден",
                )
        patch["assignee_id"] = new_assignee_id

    if "linked_bug_id" in patch_raw:
        patch["linked_bug_id"] = patch_raw["linked_bug_id"]

    item = await run_crud.apply_item_patch(db, item, patch)

    # Если прогон ещё в draft и появилось первое прохождение — авто-переводим
    # его в in_progress, чтобы пользователю не нужно было делать это вручную.
    run = await run_crud.get_by_id(db, item.test_run_id)
    if (
        run is not None
        and run.status == TestRunStatus.draft.value
        and any(it.status != TestRunItemStatus.untested.value for it in run.items)
    ):
        await run_crud.apply_patch(
            db,
            run,
            {
                "status": TestRunStatus.in_progress.value,
                "started_at": datetime.now(UTC),
            },
        )

    return TestRunItemResponse.model_validate(item)
