"""Эндпоинты тест-кейсов."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_qa_or_higher
from app.core.database import get_db
from app.crud import section as section_crud
from app.crud import test_case as test_case_crud
from app.models.user import User
from app.schemas.test_case import (
    TestCaseCreateRequest,
    TestCaseResponse,
    TestCaseSummary,
    TestCaseUpdateRequest,
)

router = APIRouter(tags=["test-cases"])


@router.get(
    "/sections/{section_id}/test-cases",
    response_model=list[TestCaseSummary],
)
async def list_test_cases(
    section_id: int,
    include_archived: bool = False,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[TestCaseSummary]:
    section = await section_crud.get_by_id(db, section_id)
    if section is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Раздел не найден")
    items = await test_case_crud.list_for_section(
        db, section_id, include_archived=include_archived
    )
    return [TestCaseSummary.model_validate(c) for c in items]


@router.post(
    "/sections/{section_id}/test-cases",
    response_model=TestCaseResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_test_case(
    section_id: int,
    payload: TestCaseCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_qa_or_higher()),
) -> TestCaseResponse:
    section = await section_crud.get_by_id(db, section_id)
    if section is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Раздел не найден")

    case = await test_case_crud.create(
        db,
        section_id=section_id,
        title=payload.title.strip(),
        preconditions=payload.preconditions,
        steps=[step.model_dump() for step in payload.steps],
        priority=payload.priority.value,
        tags=[tag.strip() for tag in payload.tags if tag.strip()],
        created_by_id=user.id,
    )
    return TestCaseResponse.model_validate(case)


@router.get("/test-cases/{case_id}", response_model=TestCaseResponse)
async def get_test_case(
    case_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> TestCaseResponse:
    case = await test_case_crud.get_by_id(db, case_id)
    if case is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Тест-кейс не найден")
    return TestCaseResponse.model_validate(case)


@router.patch("/test-cases/{case_id}", response_model=TestCaseResponse)
async def update_test_case(
    case_id: int,
    payload: TestCaseUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_qa_or_higher()),
) -> TestCaseResponse:
    case = await test_case_crud.get_by_id(db, case_id)
    if case is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Тест-кейс не найден")

    patch_raw = payload.model_dump(exclude_unset=True)
    patch: dict[str, object] = {}

    if "section_id" in patch_raw:
        new_section_id = patch_raw["section_id"]
        section = await section_crud.get_by_id(db, new_section_id)
        if section is None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail="Целевой раздел не найден",
            )
        patch["section_id"] = new_section_id

    for key in ("title", "preconditions", "tags"):
        if key in patch_raw:
            patch[key] = patch_raw[key]

    if "steps" in patch_raw:
        patch["steps"] = patch_raw["steps"]

    if "priority" in patch_raw:
        patch["priority"] = patch_raw["priority"].value
    if "status" in patch_raw:
        patch["status"] = patch_raw["status"].value

    case = await test_case_crud.apply_patch(db, case, patch)
    return TestCaseResponse.model_validate(case)


@router.delete("/test-cases/{case_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_test_case(
    case_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_qa_or_higher()),
) -> None:
    case = await test_case_crud.get_by_id(db, case_id)
    if case is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Тест-кейс не найден")
    await test_case_crud.delete(db, case)
