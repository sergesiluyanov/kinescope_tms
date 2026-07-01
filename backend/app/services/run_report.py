"""Генерация HTML-отчёта по прогону.

Формат отчёта: одиночный self-contained HTML-файл (все стили инлайном),
без внешних ресурсов и JS. Так его можно:

* открыть в браузере при клике по share-ссылке;
* скачать и переслать по почте/мессенджеру — файл откроется как есть;
* распечатать (заложены `@media print` стили).
"""

from __future__ import annotations

import html
from datetime import datetime

from app.models.test_run import TestRun, TestRunItemStatus, TestRunStatus

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


def render_run_report_html(run: TestRun) -> str:
    """Возвращает готовый HTML-отчёт по прогону как строку."""
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

    <footer class="foot">
      <span>Kinescope TMS</span>
      <span>Прогон #{run.id}</span>
    </footer>
  </div>
</body>
</html>
"""

