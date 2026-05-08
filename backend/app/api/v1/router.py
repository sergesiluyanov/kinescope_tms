"""Агрегатор всех v1-роутеров."""

from fastapi import APIRouter

from app.api.v1 import auth, health

api_router = APIRouter(prefix="/v1")
api_router.include_router(health.router)
api_router.include_router(auth.router)
