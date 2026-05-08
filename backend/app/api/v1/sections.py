"""Эндпоинты разделов (внутри проекта)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_qa_or_higher
from app.core.database import get_db
from app.crud import project as project_crud
from app.crud import section as section_crud
from app.models.user import User
from app.schemas.section import (
    SectionCreateRequest,
    SectionResponse,
    SectionUpdateRequest,
)

router = APIRouter(tags=["sections"])


async def _validate_parent_section(
    db: AsyncSession,
    *,
    project_id: int,
    parent_id: int | None,
    section_id: int | None = None,
) -> None:
    if parent_id is None:
        return
    parent = await section_crud.get_by_id(db, parent_id)
    if parent is None or parent.project_id != project_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Родительский раздел не найден в этом проекте",
        )
    if section_id is not None and parent.id == section_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Раздел не может быть родителем самого себя",
        )


@router.get(
    "/projects/{project_id}/sections",
    response_model=list[SectionResponse],
)
async def list_sections(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[SectionResponse]:
    project = await project_crud.get_by_id(db, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Проект не найден")
    items = await section_crud.list_for_project(db, project_id)
    return [SectionResponse.model_validate(s) for s in items]


@router.post(
    "/projects/{project_id}/sections",
    response_model=SectionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_section(
    project_id: int,
    payload: SectionCreateRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_qa_or_higher()),
) -> SectionResponse:
    project = await project_crud.get_by_id(db, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Проект не найден")

    await _validate_parent_section(
        db, project_id=project_id, parent_id=payload.parent_id
    )

    section = await section_crud.create(
        db,
        project_id=project_id,
        name=payload.name.strip(),
        description=payload.description,
        parent_id=payload.parent_id,
    )
    return SectionResponse.model_validate(section)


@router.patch("/sections/{section_id}", response_model=SectionResponse)
async def update_section(
    section_id: int,
    payload: SectionUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_qa_or_higher()),
) -> SectionResponse:
    section = await section_crud.get_by_id(db, section_id)
    if section is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Раздел не найден")

    patch = payload.model_dump(exclude_unset=True)
    if "parent_id" in patch:
        await _validate_parent_section(
            db,
            project_id=section.project_id,
            parent_id=patch["parent_id"],
            section_id=section.id,
        )

    section = await section_crud.apply_patch(db, section, patch)
    return SectionResponse.model_validate(section)


@router.delete("/sections/{section_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_section(
    section_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_qa_or_higher()),
) -> None:
    section = await section_crud.get_by_id(db, section_id)
    if section is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Раздел не найден")
    await section_crud.delete(db, section)
