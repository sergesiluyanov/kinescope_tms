#!/usr/bin/env bash
set -euo pipefail

# Прогоняем миграции до старта приложения. Если миграций пока нет —
# Alembic просто ничего не сделает (текущая ревизия совпадёт с head).
echo "[entrypoint] running alembic upgrade head"
alembic upgrade head

echo "[entrypoint] starting: $*"
exec "$@"
