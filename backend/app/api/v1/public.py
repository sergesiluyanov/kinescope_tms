"""Публичные эндпоинты, доступные без авторизации.

Единственный кейс сейчас — HTML-отчёт по тест-прогону по share-токену.
Токен опционален и генерируется владельцем прогона через
`POST /test-runs/{id}/share`. Пока токена нет — публичного доступа
нет.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.crud import test_run as run_crud
from app.services.run_report import render_run_report_html

router = APIRouter(prefix="/public", tags=["public"])


@router.get(
    "/test-runs/{share_token}/report.html",
    response_class=Response,
    responses={200: {"content": {"text/html": {}}}},
)
async def public_test_run_report(
    share_token: str,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Отчёт по прогону по публичному share-токену.

    Токен длинный (256 бит энтропии), но в остальном URL — единственный
    защитный барьер. Не индексируем страницу, попросив об этом ботов
    через `X-Robots-Tag`.
    """
    run = await run_crud.get_by_share_token(db, share_token)
    if run is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail="Ссылка недействительна или отозвана",
        )
    html_body = render_run_report_html(run)
    return Response(
        content=html_body,
        media_type="text/html; charset=utf-8",
        headers={"X-Robots-Tag": "noindex, nofollow"},
    )
