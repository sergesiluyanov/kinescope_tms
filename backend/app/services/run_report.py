"""Генерация HTML-отчёта по прогону.

Формат отчёта: одиночный self-contained HTML-файл (все стили инлайном),
без внешних ресурсов и JS. Так его можно:

* открыть в браузере при клике по share-ссылке;
* скачать и переслать по почте/мессенджеру — файл откроется как есть;
* распечатать (заложены `@media print` стили).

Уровень детализации задаётся флагом `include_case_details`:

* публичная share-версия (без auth) рендерится с `False` — только шапка
  и сводка, чтобы не проливать наружу комментарии QA и связи с багами;
* «скачать HTML» и внутренний просмотр (`?download=1` или явно
  `include_case_details=True`) добавляют секцию «Проблемные кейсы»
  с деталями по каждому failed/blocked-айтему.
"""

from __future__ import annotations

import html
from collections.abc import Mapping
from datetime import datetime
from typing import TYPE_CHECKING

from app.models.test_run import (
    TestRun,
    TestRunItem,
    TestRunItemStatus,
    TestRunStatus,
)

if TYPE_CHECKING:
    # Bug импортируется только для аннотаций типов, чтобы не тянуть модель
    # в public-эндпоинт, где детали не рендерятся вообще.
    from app.models.bug import Bug

# Порядок и человеческие названия для отображения в сводке/прогресс-баре.
_STATUS_ORDER: list[tuple[TestRunItemStatus, str, str]] = [
    (TestRunItemStatus.passed, "Пройдены", "#10b981"),
    (TestRunItemStatus.failed, "Упали", "#ef4444"),
    (TestRunItemStatus.blocked, "Заблокированы", "#f97316"),
    (TestRunItemStatus.skipped, "Пропущены", "#94a3b8"),
    (TestRunItemStatus.untested, "Не проверены", "#cbd5f5"),
]

_RUN_STATUS_LABELS: dict[str, str] = {
    TestRunStatus.draft.value: "Черновик",
    TestRunStatus.in_progress.value: "В процессе",
    TestRunStatus.completed.value: "Завершён",
    TestRunStatus.aborted.value: "Прерван",
}

_RUN_STATUS_COLORS: dict[str, str] = {
    TestRunStatus.draft.value: "#94a3b8",
    TestRunStatus.in_progress.value: "#3b82f6",
    TestRunStatus.completed.value: "#10b981",
    TestRunStatus.aborted.value: "#ef4444",
}


def _fmt_datetime(dt: datetime | None) -> str:
    if dt is None:
        return "—"
    # Отображаем в местной таймзоне сервера пользователя: у нас в БД TZ-aware,
    # так что это `dt` в UTC. Конвертируем в наив для чтения без Z.
    local = dt.astimezone()
    return local.strftime("%Y-%m-%d %H:%M")


def _fmt_duration(start: datetime | None, end: datetime | None) -> str:
    if start is None:
        return "—"
    finish = end if end is not None else datetime.now(start.tzinfo)
    delta = finish - start
    total_seconds = int(delta.total_seconds())
    if total_seconds < 0:
        return "—"
    hours, remainder = divmod(total_seconds, 3600)
    minutes, _ = divmod(remainder, 60)
    if hours >= 24:
        days, hours = divmod(hours, 24)
        return f"{days} д {hours} ч"
    if hours:
        return f"{hours} ч {minutes} мин"
    return f"{minutes} мин"


def _run_status_badge(status_value: str) -> str:
    label = _RUN_STATUS_LABELS.get(status_value, status_value)
    color = _RUN_STATUS_COLORS.get(status_value, "#64748b")
    return (
        f'<span class="badge" style="background:{color};">'
        f"{html.escape(label)}</span>"
    )


# Приоритеты кейса — визуально маркируем полосой сбоку карточки.
_PRIORITY_LABELS: dict[str, str] = {
    "critical": "Critical",
    "high": "High",
    "medium": "Medium",
    "low": "Low",
}
_PRIORITY_COLORS: dict[str, str] = {
    "critical": "#dc2626",
    "high": "#ea580c",
    "medium": "#ca8a04",
    "low": "#64748b",
}


def _item_status_meta(status_value: str) -> tuple[str, str]:
    """Возвращает (label, color) для статуса конкретного айтема прогона."""
    for enum_val, label, color in _STATUS_ORDER:
        if enum_val.value == status_value:
            return label, color
    return status_value, "#64748b"


def _person_name(person: object | None) -> str:
    """Достаём человеческое имя пользователя из ORM-объекта. Работает и
    с ленивыми selectin-load, и с пропущенным relationship (None)."""
    if person is None:
        return ""
    full_name = getattr(person, "full_name", None)
    email = getattr(person, "email", None)
    return full_name or email or ""


# Статусы бага (BugStatus.*) → человеческие подписи + цвета. Дублируем
# здесь строковые значения, а не тянем enum, чтобы run_report.py оставался
# независимым от models.bug (public-эндпоинту он не нужен).
_BUG_STATUS_LABELS: dict[str, str] = {
    "new": "Новый",
    "in_progress": "В работе",
    "resolved": "Решён",
    "closed": "Закрыт",
    "reopened": "Переоткрыт",
    "wont_fix": "Won't fix",
}
_BUG_STATUS_COLORS: dict[str, str] = {
    "new": "#2563eb",
    "in_progress": "#f59e0b",
    "resolved": "#10b981",
    "closed": "#64748b",
    "reopened": "#dc2626",
    "wont_fix": "#94a3b8",
}
_BUG_SEVERITY_LABELS: dict[str, str] = {
    "blocker": "Blocker",
    "critical": "Critical",
    "major": "Major",
    "minor": "Minor",
    "trivial": "Trivial",
}


def _render_bug_field(label: str, value: str | None) -> str:
    """Аккуратный блок «Название поля + preformatted тело». Пустое —
    пропускаем, чтобы не захламлять отчёт «Actual result: —»."""
    if not value or not value.strip():
        return ""
    return (
        '<div class="bug-field">'
        f'<div class="bug-field-label">{html.escape(label)}</div>'
        f'<div class="bug-field-body">{html.escape(value)}</div>'
        "</div>"
    )


def _render_bug_block(bug: "Bug") -> str:
    """Развёрнутая карточка баг-репорта: заголовок, атрибуты, описание и
    шаги воспроизведения. Вставляется внутрь `.case` под комментарием QA.
    """
    bug_ref = f"BUG-{str(bug.id).zfill(4)}"
    status_label = _BUG_STATUS_LABELS.get(bug.status, bug.status)
    status_color = _BUG_STATUS_COLORS.get(bug.status, "#64748b")
    severity_label = _BUG_SEVERITY_LABELS.get(bug.severity, bug.severity)

    header_bits: list[str] = [
        f'<span class="bug-ref">{html.escape(bug_ref)}</span>',
        f'<span class="badge" style="background:{status_color};">'
        f"{html.escape(status_label)}</span>",
        f'<span class="badge badge-outline" '
        f'style="border-color:#334155;color:#334155;">'
        f"severity: {html.escape(severity_label)}</span>",
    ]
    if bug.environment:
        header_bits.append(
            '<span class="bug-env">'
            f"env: {html.escape(bug.environment)}"
            "</span>"
        )

    fields_html = "".join(
        [
            _render_bug_field("Описание", bug.description),
            _render_bug_field("Шаги воспроизведения", bug.steps_to_reproduce),
            _render_bug_field("Фактический результат", bug.actual_result),
            _render_bug_field("Ожидаемый результат", bug.expected_result),
        ]
    )

    return (
        '<div class="bug-card">'
        '<div class="bug-head">' + "".join(header_bits) + "</div>"
        f'<div class="bug-title">{html.escape(bug.title)}</div>'
        f"{fields_html}"
        "</div>"
    )


def _render_problem_case(
    item: TestRunItem,
    index: int,
    bug: "Bug | None" = None,
) -> str:
    """Одна карточка «проблемного» кейса — failed или blocked.

    Собираем максимально плотную информацию: заголовок, статус, приоритет,
    исполнителя и время, связанный баг, тэги, комментарий QA. Если для
    кейса передан подгруженный `bug` — под комментарием рендерим ещё и
    его описание с шагами. Всё HTML-escape'им, потому что этот текст
    пишут пользователи, и в нём легко могут оказаться `<`, `>`, `&`
    или ссылки.
    """
    status_label, status_color = _item_status_meta(item.status)
    priority_label = _PRIORITY_LABELS.get(item.priority, item.priority)
    priority_color = _PRIORITY_COLORS.get(item.priority, "#64748b")

    header_bits: list[str] = [
        f'<span class="case-num">#{index}</span>',
        f'<span class="badge" style="background:{status_color};">'
        f"{html.escape(status_label)}</span>",
        f'<span class="badge badge-outline" '
        f'style="border-color:{priority_color};color:{priority_color};">'
        f"{html.escape(priority_label)}</span>",
    ]
    if item.linked_bug_id:
        bug_ref = f"BUG-{str(item.linked_bug_id).zfill(4)}"
        header_bits.append(
            f'<span class="badge badge-outline" '
            f'style="border-color:#dc2626;color:#dc2626;">'
            f"{html.escape(bug_ref)}</span>"
        )

    meta_bits: list[str] = []
    executor = _person_name(getattr(item, "executed_by", None))
    if executor:
        meta_bits.append(
            f'<span class="case-meta-key">Выполнил:</span> '
            f"{html.escape(executor)}"
        )
    if item.executed_at:
        meta_bits.append(
            f'<span class="case-meta-key">Когда:</span> '
            f"{_fmt_datetime(item.executed_at)}"
        )
    assignee = _person_name(getattr(item, "assignee", None))
    if assignee:
        meta_bits.append(
            f'<span class="case-meta-key">Назначен:</span> '
            f"{html.escape(assignee)}"
        )
    if item.tags:
        tags_html = " ".join(
            f'<span class="case-tag">{html.escape(t)}</span>'
            for t in item.tags
        )
        meta_bits.append(f'<span class="case-tags">{tags_html}</span>')
    meta_html = (
        f'<div class="case-meta">{" · ".join(meta_bits)}</div>'
        if meta_bits
        else ""
    )

    comment_html = ""
    if item.comment and item.comment.strip():
        comment_html = (
            '<div class="case-comment">'
            '<div class="case-comment-label">Комментарий QA</div>'
            f'<div class="case-comment-body">{html.escape(item.comment)}</div>'
            "</div>"
        )
    else:
        comment_html = (
            '<div class="case-comment case-comment-empty">'
            "Комментария нет"
            "</div>"
        )

    bug_html = _render_bug_block(bug) if bug is not None else ""

    return (
        f'<article class="case" style="border-left-color:{status_color};">'
        f'<header class="case-head">{"".join(header_bits)}</header>'
        f'<h3 class="case-title">{html.escape(item.title)}</h3>'
        f"{meta_html}"
        f"{comment_html}"
        f"{bug_html}"
        "</article>"
    )


def _render_problem_cases_section(
    items: list[TestRunItem],
    bugs_by_id: Mapping[int, "Bug"] | None = None,
) -> str:
    """Секция с деталями failed + blocked. Пустая — не рендерится."""
    problem_items = [
        it
        for it in items
        if it.status
        in (TestRunItemStatus.failed.value, TestRunItemStatus.blocked.value)
    ]
    if not problem_items:
        return ""

    # Сортируем: сначала failed, потом blocked, внутри — по position.
    order = {
        TestRunItemStatus.failed.value: 0,
        TestRunItemStatus.blocked.value: 1,
    }
    problem_items.sort(key=lambda it: (order.get(it.status, 9), it.position))

    bugs_map = bugs_by_id or {}
    cases_html = "".join(
        _render_problem_case(
            it,
            index=it.position + 1,
            bug=bugs_map.get(it.linked_bug_id) if it.linked_bug_id else None,
        )
        for it in problem_items
    )

    failed_n = sum(
        1 for it in problem_items if it.status == TestRunItemStatus.failed.value
    )
    blocked_n = sum(
        1 for it in problem_items if it.status == TestRunItemStatus.blocked.value
    )
    subtitle_parts = []
    if failed_n:
        subtitle_parts.append(f"упавших — {failed_n}")
    if blocked_n:
        subtitle_parts.append(f"заблокированных — {blocked_n}")
    subtitle = " · ".join(subtitle_parts)

    return (
        '<section class="section">'
        '<h2 class="section-title">Проблемные кейсы</h2>'
        f'<div class="section-subtitle">{subtitle}</div>'
        f'<div class="cases">{cases_html}</div>'
        "</section>"
    )


def render_run_report_html(
    run: TestRun,
    *,
    include_case_details: bool = False,
    bugs_by_id: Mapping[int, "Bug"] | None = None,
) -> str:
    """Возвращает готовый HTML-отчёт по прогону как строку.

    ``include_case_details`` управляет уровнем детализации: при `True`
    к сводке добавляется секция «Проблемные кейсы» (failed + blocked)
    с комментариями QA, исполнителями и ссылками на баги.

    ``bugs_by_id`` — карта ``bug_id -> Bug`` для развёрнутых карточек
    баг-репортов (описание, шаги воспроизведения, actual/expected). Если
    None или пусто — блок бага для кейса не показывается, только его
    номер в шапке. Загрузка багов остаётся на стороне вызывающего кода:
    рендерер не должен ходить в БД, чтобы не тянуть async-контекст.
    """
    items = list(run.items)
    total = len(items)

    counts: dict[str, int] = {s.value: 0 for s in TestRunItemStatus}
    for item in items:
        counts[item.status] = counts.get(item.status, 0) + 1

    done = total - counts[TestRunItemStatus.untested.value]
    progress_pct = int(round(done * 100 / total)) if total else 0
    pass_rate = (
        int(round(counts[TestRunItemStatus.passed.value] * 100 / total))
        if total
        else 0
    )

    # Прогресс-бар: горизонтальные сегменты пропорциональной ширины
    # (доля каждого статуса от общего числа) + текстовая легенда рядом.
    bar_segments: list[str] = []
    legend_rows: list[str] = []
    for status_enum, label, color in _STATUS_ORDER:
        n = counts[status_enum.value]
        if total and n:
            width_pct = n * 100 / total
            bar_segments.append(
                f'<div class="bar-seg" style="width:{width_pct:.4f}%;'
                f'background:{color};" '
                f'title="{html.escape(label)}: {n}"></div>'
            )
        legend_rows.append(
            f'<div class="legend-item">'
            f'<span class="legend-swatch" style="background:{color};"></span>'
            f'<span class="legend-label">{html.escape(label)}</span>'
            f'<span class="legend-value">{n}</span>'
            f"</div>"
        )
    bar_html = "".join(bar_segments) or (
        '<div class="bar-seg" style="width:100%;background:#e2e8f0;" '
        'title="Нет данных"></div>'
    )
    legend_html = "".join(legend_rows)

    author_name = ""
    if run.created_by is not None:
        author_name = run.created_by.full_name or run.created_by.email or ""

    meta_rows = [
        ("Проект ID", str(run.project_id)),
        ("Прогон ID", str(run.id)),
        ("Статус", _run_status_badge(run.status)),
        ("Окружение", html.escape(run.environment or "—")),
        ("Автор", html.escape(author_name or "—")),
        ("Создан", _fmt_datetime(run.created_at)),
        ("Начат", _fmt_datetime(run.started_at)),
        ("Завершён", _fmt_datetime(run.completed_at)),
        ("Длительность", _fmt_duration(run.started_at, run.completed_at)),
    ]
    meta_html = "".join(
        f'<div class="meta-row"><div class="meta-key">{key}</div>'
        f'<div class="meta-val">{value}</div></div>'
        for key, value in meta_rows
    )

    description_html = ""
    if run.description:
        description_html = (
            '<section class="section">'
            '<h2 class="section-title">Описание</h2>'
            f'<div class="description">{html.escape(run.description)}</div>'
            "</section>"
        )

    generated_at = datetime.now().astimezone().strftime("%Y-%m-%d %H:%M %Z").strip()
    safe_name = html.escape(run.name)

    problem_cases_html = (
        _render_problem_cases_section(items, bugs_by_id)
        if include_case_details
        else ""
    )

    return f"""<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Отчёт по прогону: {safe_name}</title>
<style>
  :root {{
    --fg: #0f172a;
    --fg-muted: #475569;
    --bg: #ffffff;
    --border: #e2e8f0;
    --panel: #f8fafc;
    --accent: #2563eb;
  }}
  * {{ box-sizing: border-box; }}
  html, body {{
    background: var(--bg);
    color: var(--fg);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      "Helvetica Neue", Arial, sans-serif;
    margin: 0;
    padding: 0;
    line-height: 1.5;
    font-size: 15px;
    -webkit-font-smoothing: antialiased;
  }}
  .wrap {{
    max-width: 960px;
    margin: 0 auto;
    padding: 32px 24px 64px;
  }}
  header.top {{
    border-bottom: 1px solid var(--border);
    padding-bottom: 20px;
    margin-bottom: 24px;
  }}
  h1 {{
    font-size: 26px;
    margin: 0 0 8px;
    line-height: 1.25;
    letter-spacing: -0.01em;
  }}
  .subtitle {{
    color: var(--fg-muted);
    font-size: 14px;
  }}
  .badge {{
    display: inline-block;
    color: #fff;
    padding: 2px 10px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.01em;
  }}
  section.section {{ margin-top: 28px; }}
  h2.section-title {{
    font-size: 18px;
    margin: 0 0 12px;
    letter-spacing: -0.005em;
  }}

  /* Meta grid */
  .meta {{
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px 24px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px 20px;
  }}
  .meta-row {{
    display: flex;
    align-items: baseline;
    gap: 12px;
    min-width: 0;
  }}
  .meta-key {{
    color: var(--fg-muted);
    font-size: 13px;
    min-width: 120px;
    flex-shrink: 0;
  }}
  .meta-val {{
    font-size: 14px;
    color: var(--fg);
    word-wrap: break-word;
    min-width: 0;
    overflow-wrap: anywhere;
  }}

  /* Big numbers */
  .kpis {{
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-top: 16px;
  }}
  .kpi {{
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 14px 18px;
  }}
  .kpi-label {{
    color: var(--fg-muted);
    font-size: 13px;
    margin-bottom: 6px;
  }}
  .kpi-value {{
    font-size: 24px;
    font-weight: 600;
    letter-spacing: -0.01em;
    line-height: 1;
  }}

  /* Progress bar */
  .bar {{
    display: flex;
    height: 14px;
    border-radius: 999px;
    overflow: hidden;
    background: #e2e8f0;
    margin-top: 8px;
  }}
  .bar-seg {{ height: 100%; }}

  .legend {{
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px 24px;
    margin-top: 16px;
  }}
  .legend-item {{
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
  }}
  .legend-swatch {{
    width: 12px;
    height: 12px;
    border-radius: 3px;
    flex-shrink: 0;
  }}
  .legend-label {{ color: var(--fg-muted); flex: 1; }}
  .legend-value {{
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }}

  .description {{
    white-space: pre-wrap;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 14px 18px;
    color: var(--fg);
  }}

  /* Проблемные кейсы */
  .section-subtitle {{
    color: var(--fg-muted);
    font-size: 13px;
    margin-bottom: 12px;
  }}
  .cases {{ display: flex; flex-direction: column; gap: 12px; }}
  .case {{
    border: 1px solid var(--border);
    border-left: 4px solid #ef4444;
    border-radius: 12px;
    padding: 14px 18px;
    background: var(--bg);
  }}
  .case-head {{
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 6px;
  }}
  .case-num {{
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    color: var(--fg-muted);
  }}
  .case-title {{
    font-size: 16px;
    margin: 0 0 6px;
    letter-spacing: -0.005em;
    line-height: 1.35;
  }}
  .case-meta {{
    color: var(--fg-muted);
    font-size: 13px;
    margin-top: 4px;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 6px;
    align-items: center;
  }}
  .case-meta-key {{ color: #94a3b8; }}
  .case-tags {{ display: inline-flex; flex-wrap: wrap; gap: 4px; }}
  .case-tag {{
    background: #f1f5f9;
    color: #475569;
    padding: 1px 8px;
    border-radius: 999px;
    font-size: 12px;
  }}
  .case-comment {{
    margin-top: 10px;
    padding: 10px 12px;
    background: #fff7ed;
    border: 1px solid #fed7aa;
    border-radius: 8px;
    color: #7c2d12;
  }}
  .case-comment-label {{
    font-size: 11px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #9a3412;
    margin-bottom: 4px;
    font-weight: 500;
  }}
  .case-comment-body {{
    white-space: pre-wrap;
    font-size: 14px;
    line-height: 1.5;
  }}
  .case-comment-empty {{
    background: #f8fafc;
    border-color: var(--border);
    color: var(--fg-muted);
    font-style: italic;
  }}
  .badge-outline {{
    background: transparent;
    border: 1px solid;
    padding: 1px 8px;
    font-size: 12px;
    font-weight: 500;
  }}

  /* Развёрнутый bug-репорт под кейсом */
  .bug-card {{
    margin-top: 10px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    padding: 12px 14px;
  }}
  .bug-head {{
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-bottom: 6px;
  }}
  .bug-ref {{
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    color: #991b1b;
    font-weight: 600;
  }}
  .bug-env {{
    font-size: 12px;
    color: #7f1d1d;
    background: rgba(220, 38, 38, 0.08);
    border-radius: 999px;
    padding: 1px 8px;
  }}
  .bug-title {{
    font-size: 14px;
    font-weight: 600;
    color: #7f1d1d;
    margin-bottom: 8px;
    line-height: 1.4;
  }}
  .bug-field {{ margin-top: 8px; }}
  .bug-field-label {{
    font-size: 11px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #991b1b;
    font-weight: 500;
    margin-bottom: 2px;
  }}
  .bug-field-body {{
    white-space: pre-wrap;
    font-size: 13px;
    line-height: 1.5;
    color: #4c0519;
  }}

  footer.foot {{
    margin-top: 40px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
    color: var(--fg-muted);
    font-size: 12px;
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
  }}
  footer.foot a {{ color: var(--fg-muted); text-decoration: none; }}
  footer.foot a:hover {{ text-decoration: underline; }}

  @media print {{
    .wrap {{ padding: 12px 20px; max-width: none; }}
    header.top {{ margin-bottom: 12px; }}
    .kpis {{ break-inside: avoid; }}
    section.section {{ break-inside: avoid; }}
    body {{ font-size: 12pt; }}
    h1 {{ font-size: 20pt; }}
    h2.section-title {{ font-size: 14pt; }}
  }}

  @media (max-width: 640px) {{
    .meta, .legend {{ grid-template-columns: 1fr; }}
    .kpis {{ grid-template-columns: 1fr; }}
  }}
</style>
</head>
<body>
  <div class="wrap">
    <header class="top">
      <h1>{safe_name}</h1>
      <div class="subtitle">Отчёт по тест-прогону — сгенерировано {html.escape(generated_at)}</div>
    </header>

    <section class="section">
      <h2 class="section-title">Информация о прогоне</h2>
      <div class="meta">{meta_html}</div>
    </section>

    {description_html}

    <section class="section">
      <h2 class="section-title">Сводка результатов</h2>
      <div class="kpis">
        <div class="kpi">
          <div class="kpi-label">Всего кейсов</div>
          <div class="kpi-value">{total}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Прогресс выполнения</div>
          <div class="kpi-value">{progress_pct}%</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Pass-rate от общего</div>
          <div class="kpi-value">{pass_rate}%</div>
        </div>
      </div>
      <div class="bar">{bar_html}</div>
      <div class="legend">{legend_html}</div>
    </section>

    {problem_cases_html}

    <footer class="foot">
      <span>Kinescope TMS</span>
      <span>Прогон #{run.id}</span>
    </footer>
  </div>
</body>
</html>
"""

