# Kinescope TMS

Внутренняя система управления тестированием Kinescope: тестовая документация
по разделам, баг-репорты, прогоны, интеграция с Kaiten. Разворачивается
на собственном сервере.

## Стек

- **Backend** — Python 3.12, FastAPI, SQLAlchemy 2.x (async), Alembic, Pydantic v2
- **DB** — PostgreSQL 16
- **Frontend** — React 18, TypeScript, Vite, TanStack Query, Tailwind CSS
- **Auth** — email + пароль с проверкой корпоративного домена `@kinescope.io`,
  JWT (access + refresh)
- **Деплой** — Docker Compose (postgres + api + web)

## Структура репозитория

```
.
├── backend/                # FastAPI-приложение
│   ├── app/
│   │   ├── api/v1/         # роутеры v1 (health, далее: auth, projects, ...)
│   │   ├── core/           # config, database
│   │   ├── models/         # SQLAlchemy-модели + Base
│   │   └── main.py         # точка входа
│   ├── alembic/            # миграции
│   ├── scripts/entrypoint.sh
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend/               # Vite + React + TS
│   ├── src/
│   ├── Dockerfile          # multi-stage: dev / build / prod (nginx)
│   └── nginx.conf
├── docker-compose.yml
├── Makefile
├── .env.example
└── README.md
```

## Быстрый старт

Нужны Docker и Docker Compose v2.

```bash
make init      # создаст .env из .env.example
make up        # поднимет postgres + api + web
```

После старта:

- API: http://localhost:8000
- OpenAPI / Swagger: http://localhost:8000/docs
- Healthcheck: http://localhost:8000/api/v1/health/ready
- Frontend (dev, Vite): http://localhost:5173

Перед продакшен-деплоем обязательно сгенерируйте свой `JWT_SECRET`:

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

и подставьте в `.env`. Также поменяйте пароль `POSTGRES_PASSWORD`.

## Миграции БД

Миграции прогоняются автоматически в энтрипоинте бэкенда (`alembic upgrade head`).
Вручную:

```bash
make migrate                          # применить все миграции
make revision m="add users table"     # создать миграцию из изменений моделей
```

## Полезные команды

```bash
make logs        # логи всех сервисов
make api-logs    # логи бэкенда
make api-shell   # shell внутри контейнера api
make psql        # psql в контейнере postgres
make rebuild     # пересобрать образы без кеша
make down        # остановить стек
```

## Дорожная карта (MVP)

- [x] Скелет проекта: FastAPI + Postgres + Alembic + React/Vite + docker-compose
- [ ] Авторизация: регистрация по `@kinescope.io`, логин, JWT, роли
- [ ] Проекты и разделы (древовидная навигация)
- [ ] Тест-кейсы (шаги, ожидаемый результат, приоритет, теги, версии)
- [ ] Тест-раны и прогоны
- [ ] Баг-репорты (severity/priority/статус, вложения, связи с кейсами)
- [ ] Интеграция с Kaiten (создание карточек из багов, далее — двусторонний sync)
- [ ] Загрузка вложений (скриншоты к кейсам/багам)
- [ ] Аудит-лог изменений

## Разработка без Docker

Бэкенд:

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
export DATABASE_URL=postgresql+asyncpg://tms:tms@localhost:5432/kinescope_tms
alembic upgrade head
uvicorn app.main:app --reload
```

Фронт:

```bash
cd frontend
npm install
npm run dev
```

## Лицензия

Внутренний проект Kinescope.
