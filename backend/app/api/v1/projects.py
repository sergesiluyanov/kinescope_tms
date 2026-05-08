"""Эндпоинты проектов."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_admin, require_qa_or_higher
from app.core.database import get_db
from app.crud import project as project_crud
from app.models.user import User
from app.schemas.project import (
    ProjectCreateRequest,
    ProjectResponse,
    ProjectUpdateRequest,
)

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectResponse])
async def list_projects(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[ProjectResponse]:
    items = await project_crud.list_all(db)
    return [ProjectResponse.model_validate(p) for p in items]


@router.post(
    "",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_project(
    payload: ProjectCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_qa_or_higher()),
) -> ProjectResponse:
    project = await project_crud.create(
        db,
        name=payload.name.strip(),
        description=payload.description,
        created_by_id=user.id,
    )
    return ProjectResponse.model_validate(project)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ProjectResponse:
    project = await project_crud.get_by_id(db, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Проект не найден")
    return ProjectResponse.model_validate(project)


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    payload: ProjectUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_qa_or_higher()),
) -> ProjectResponse:
    project = await project_crud.get_by_id(db, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Проект не найден")
    patch = payload.model_dump(exclude_unset=True)
    project = await project_crud.apply_patch(db, project, patch)
    return ProjectResponse.model_validate(project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin()),
) -> None:
    project = await project_crud.get_by_id(db, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Проект не найден")
    await project_crud.delete(db, project)
