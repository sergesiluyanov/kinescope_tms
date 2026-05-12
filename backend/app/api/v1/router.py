"""Агрегатор всех v1-роутеров."""

from fastapi import APIRouter

from app.api.v1 import (
    auth,
    bugs,
    health,
    imports,
    projects,
    sections,
    test_cases,
    test_runs,
    users,
)

api_router = APIRouter(prefix="/v1")
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(projects.router)
api_router.include_router(sections.router)
api_router.include_router(test_cases.router)
api_router.include_router(bugs.router)
api_router.include_router(test_runs.router)
api_router.include_router(imports.router)
