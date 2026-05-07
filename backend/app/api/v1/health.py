"""Healthcheck-эндпоинты: liveness и readiness (с проверкой Postgres)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app import __version__
from app.core.database import get_db

router = APIRouter(tags=["health"])


@router.get("/health/live", status_code=status.HTTP_200_OK)
async def liveness() -> dict[str, str]:
    """Простой live-чек: процесс жив и отвечает."""
    return {"status": "ok", "version": __version__}


@router.get("/health/ready", status_code=status.HTTP_200_OK)
async def readiness(db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    """Ready-чек: дополнительно проверяем доступность БД."""
    await db.execute(text("SELECT 1"))
    return {"status": "ok", "db": "ok", "version": __version__}
