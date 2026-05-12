"""Эндпоинт импорта тест-кейсов из xlsx-экспортов (Test IT и совместимые)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_qa_or_higher
from app.core.database import get_db
from app.crud import project as project_crud
from app.models.user import User
from app.services import import_xlsx as importer

router = APIRouter(tags=["imports"])

MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 МБ — на 1000+ кейсов хватит с запасом


class ImportCasePreview(BaseModel):
    external_id: str | None
    section_path: list[str]
    title: str
    steps_count: int
    has_preconditions: bool
    priority: str
    tags: list[str]


class ImportPreviewResponse(BaseModel):
    total_cases: int
    section_paths: list[list[str]]
    issues: list[str]
    sample: list[ImportCasePreview]


class ImportCommitResponse(BaseModel):
    cases_created: int
    sections_created: int


async def _read_upload(file: UploadFile) -> bytes:
    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Файл пустой"
        )
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Файл больше {MAX_UPLOAD_BYTES // (1024 * 1024)} МБ",
        )
    return content


@router.post(
    "/projects/{project_id}/import/xlsx/preview",
    response_model=ImportPreviewResponse,
)
async def preview_xlsx(
    project_id: int,
    file: UploadFile = File(...),
    drop_root_section: bool = Form(False),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_qa_or_higher()),
) -> ImportPreviewResponse:
    project = await project_crud.get_by_id(db, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Проект не найден")

    content = await _read_upload(file)

    try:
        plan = importer.parse_xlsx_bytes(content, drop_root_section=drop_root_section)
    except Exception as exc:  # noqa: BLE001 — пробрасываем причину пользователю
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Не удалось разобрать файл: {exc}",
        ) from exc

    sample = [
        ImportCasePreview(
            external_id=c.external_id,
            section_path=c.section_path,
            title=c.title,
            steps_count=len(c.steps),
            has_preconditions=bool(c.preconditions),
            priority=c.priority.value,
            tags=c.tags,
        )
        for c in plan.cases[:20]
    ]
    return ImportPreviewResponse(
        total_cases=plan.total_cases,
        section_paths=plan.section_paths,
        issues=plan.issues,
        sample=sample,
    )


@router.post(
    "/projects/{project_id}/import/xlsx",
    response_model=ImportCommitResponse,
)
async def commit_xlsx(
    project_id: int,
    file: UploadFile = File(...),
    drop_root_section: bool = Form(False),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_qa_or_higher()),
) -> ImportCommitResponse:
    project = await project_crud.get_by_id(db, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Проект не найден")

    content = await _read_upload(file)
    try:
        plan = importer.parse_xlsx_bytes(content, drop_root_section=drop_root_section)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Не удалось разобрать файл: {exc}",
        ) from exc

    if plan.issues:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="; ".join(plan.issues),
        )
    if not plan.cases:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="В файле не найдено тест-кейсов",
        )

    result = await importer.commit_import(
        db,
        project_id=project_id,
        plan=plan,
        created_by_id=user.id,
    )
    return ImportCommitResponse(**result)
