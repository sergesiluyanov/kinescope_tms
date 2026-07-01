"""Эндпоинты тест-ранов."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_current_user,
    require_qa_lead_or_admin,
    require_qa_or_higher,
)
from app.core.database import get_db
from app.crud import bug as bug_crud
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
    TestRunShareResponse,
    TestRunStats,
    TestRunSummary,
    TestRunUpdateRequest,
)
from app.services.run_report import render_run_report_html

router = APIRouter(tags=["test-runs"])


def _ascii_slug(text: str) -> str:
    """ASCII-safe slug для fallback `filename=` в Content-Disposition.

    HTTP-заголовки в starlette кодируются в latin-1, поэтому в
    «обычной» части `filename="..."` не должно быть не-ASCII символов
    (в частности, кириллицы). Для оригинального имени с юникодом мы
    используем `filename*=UTF-8''...`, а тут — просто транслит через
    отбрасывание не-ASCII.
    """
    parts: list[str] = []
    for ch in text:
        if ch.isascii() and (ch.isalnum() or ch in ("-", "_")):
            parts.append(ch)
        elif ch.isspace() or ch in (".", ",", "/", "\\", ":", ";"):
            parts.append("-")
        # прочее (в т.ч. кириллица, эмодзи) — просто выкидываем
    joined = "".join(parts)
    # схлопываем повторяющиеся дефисы и обрезаем по краям
    while "--" in joined:
        joined = joined.replace("--", "-")
    return joined.strip("-")[:80]


async def _report_response(
    db: AsyncSession,
    run: TestRun,
    *,
    as_download: bool,
) -> Response:
    # На «своей» странице владельца (и в download-версии) отдаём отчёт
    # с деталями по failed / blocked / skipped. Public share-эндпоинт
    # использует `render_run_report_html` напрямую без этого флага.
    #
    # Подтягиваем баги по всем linked_bug_id, чтобы в карточке проблемного
    # кейса развернуть описание и шаги воспроизведения. Одним IN-запросом,
    # без N+1.
    bug_ids = sorted(
        {it.linked_bug_id for it in run.items if it.linked_bug_id}
    )
    bugs_by_id: dict[int, object] = {}
    if bug_ids:
        bugs = await bug_crud.list_by_ids(db, bug_ids)
        bugs_by_id = {b.id: b for b in bugs}

    html_body = render_run_report_html(
        run,
        include_case_details=True,
        bugs_by_id=bugs_by_id,  # type: ignore[arg-type]
    )
    headers: dict[str, str] = {}
    if as_download:
        # ASCII-safe fallback имя для старых клиентов и на случай, если
        # `filename*` не поймётся. Всегда содержит id, чтобы файлы разных
        # прогонов не сливались.
        slug = _ascii_slug(run.name)
        fallback_name = f"{slug}-{run.id}.html" if slug else f"test-run-{run.id}.html"
        # RFC 5987: filename* поддерживает произвольный юникод через
        # percent-encoding. Так браузер получит красивое кириллическое имя,
        # а latin-1-заголовок при этом не сломается.
        from urllib.parse import quote

        utf8_name = quote(f"{run.name}.html", safe="")
        headers["Content-Disposition"] = (
            f'attachment; filename="{fallback_name}"; '
            f"filename*=UTF-8''{utf8_name}"
        )
    return Response(
        content=html_body,
        media_type="text/html; charset=utf-8",
        headers=headers,
    )


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
        share_token=run.share_token,
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


# ---------------------------------------------------------------------------
# HTML-отчёт по прогону
# ---------------------------------------------------------------------------


@router.get(
    "/test-runs/{run_id}/report.html",
    response_class=Response,
    responses={200: {"content": {"text/html": {}}}},
)
async def get_test_run_report(
    run_id: int,
    download: bool = False,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Response:
    """HTML-отчёт по прогону для авторизованных пользователей.

    `download=1` — прицепит `Content-Disposition: attachment` и файл
    сохранится с именем прогона (`test-run-<slug>-<id>.html`), иначе
    отображается прямо в браузере (полезно для «Открыть в новой вкладке»
    и для превью перед пересылкой).
    """
    run = await run_crud.get_by_id(db, run_id)
    if run is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Прогон не найден")
    return await _report_response(db, run, as_download=download)


@router.post(
    "/test-runs/{run_id}/share",
    response_model=TestRunShareResponse,
)
async def create_test_run_share_link(
    run_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_qa_or_higher()),
) -> TestRunShareResponse:
    """Создать или вернуть публичную share-ссылку на HTML-отчёт.

    Токен один на прогон и не меняется, пока его явно не удалили
    (`DELETE /test-runs/{id}/share`). Так уже разосланные ссылки
    не «отваливаются» при повторных нажатиях кнопки.
    """
    run = await run_crud.get_by_id(db, run_id)
    if run is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Прогон не найден")
    run = await run_crud.ensure_share_token(db, run)
    assert run.share_token is not None

    # `url_for` разрешает name роут-функции обратно в URL с учётом всех
    # префиксов приложения (/api, /v1, /public), поэтому ссылка будет
    # корректной и после переезда на другой домен/порт.
    share_url = str(
        request.url_for(
            "public_test_run_report", share_token=run.share_token
        )
    )
    return TestRunShareResponse(share_token=run.share_token, share_url=share_url)


@router.delete(
    "/test-runs/{run_id}/share",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def revoke_test_run_share_link(
    run_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_qa_or_higher()),
) -> None:
    """Отозвать публичную ссылку — прежний токен перестанет работать."""
    run = await run_crud.get_by_id(db, run_id)
    if run is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Прогон не найден")
    await run_crud.clear_share_token(db, run)
