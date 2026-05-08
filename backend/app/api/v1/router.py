"""Агрегатор всех v1-роутеров."""

from fastapi import APIRouter

from app.api.v1 import auth, health, projects, sections, test_cases

api_router = APIRouter(prefix="/v1")
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(projects.router)
api_router.include_router(sections.router)
api_router.include_router(test_cases.router)
