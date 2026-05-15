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

## Быстрый старт (dev)

Нужны Docker и Docker Compose v2.

```bash
make init      # создаст .env из .env.example
make up        # поднимет postgres + api + web (Vite dev)
```

После старта:

- API: http://localhost:8000
- OpenAPI / Swagger: http://localhost:8000/docs
- Healthcheck: http://localhost:8000/api/v1/health/ready
- Frontend (Vite dev): http://localhost:5173

В dev-режиме фронт работает через Vite-dev-сервер с горячей перезагрузкой,
проксируя `/api/*` на сервис `api` в той же docker-сети.

## Запуск на сервере (prod)

В prod-режиме фронт собирается в статику и отдаётся через **nginx**,
запросы `/api/*` проксируются на бэкенд через ту же nginx-инстанцию.
Postgres и API наружу **не публикуются** — наружу торчит только порт 80.

```bash
make init                                            # один раз
nano .env                                            # обязательно поменять пароль и секреты
docker compose -f docker-compose.prod.yml up -d --build
# или короче:
make prod-up
```

Дальше:

- TMS на сервере: `http://<публичный_ip_или_домен>/`
- API: `http://<публичный_ip_или_домен>/api/v1/...`
- Healthcheck: `http://<публичный_ip_или_домен>/api/v1/health/ready`

После деплоя обязательно открой в firewall/Security Group только TCP 80
(и 443, когда подключим HTTPS). Порты 5173 и 8000 в проде не нужны.

Обновление кода на сервере:

```bash
git pull
make prod-restart      # пересоберёт изменённые образы и перезапустит контейнеры
```

### Перед боевым запуском обязательно

1. Сгенерируйте `JWT_SECRET`:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(64))"
```

и подставьте в `.env`.

2. Поменяйте `POSTGRES_PASSWORD` (и не забудьте обновить тот же пароль
в `DATABASE_URL` той же строкой).

3. В `.env` выставьте `ENV=production`.

4. На сервере не оставляйте открытыми наружу порты 5432, 5173, 8000.

## Миграции БД

Миграции прогоняются автоматически в энтрипоинте бэкенда (`alembic upgrade head`).
Вручную:

```bash
make migrate                          # применить все миграции
make revision m="add users table"     # создать миграцию из изменений моделей
```

## Полезные команды

Полный список — `make help`.

```bash
# DEV
make up           # поднять dev-стек
make down         # остановить
make logs         # логи всех сервисов
make api-logs     # логи бэкенда
make rebuild      # пересобрать dev-образы

# PROD
make prod-up      # поднять prod-стек (nginx на :80, api/postgres внутри)
make prod-down    # остановить prod
make prod-logs    # логи prod
make prod-restart # обновить и перезапустить (после git pull)

# БД и миграции (одинаково для dev/prod)
make api-shell                  # shell внутри api
make migrate                    # alembic upgrade head
make revision m="описание"      # создать миграцию (autogenerate)
make psql                       # psql в контейнере postgres
```

## Дорожная карта (MVP)

- [x] Скелет проекта: FastAPI + Postgres + Alembic + React/Vite + docker-compose
- [x] Prod-конфиг: фронт за nginx, API/Postgres во внутренней сети
- [x] Авторизация: регистрация по `@kinescope.io`, логин (JWT access + refresh), роли (admin/qa_lead/qa/viewer)
- [x] Проекты и разделы (древовидная навигация)
- [x] Тест-кейсы (шаги, предусловия, приоритет, теги, статусы)
- [x] Баг-репорты (severity/priority/статус, теги, исполнитель, связь с кейсами)
- [x] Тест-раны и прогоны (snapshot кейсов, Pass/Fail/Block/Skip, прогресс, баг из проваленного)
- [x] Импорт тест-кейсов из XLSX (формат Test IT: ID, Расположение, Шаги, Ожидаемое, Приоритет, Тег)
- [x] Прямые ссылки на тест-кейсы: `/projects/{id}/cases/{caseId}` и короткие `/c/{caseId}` (для автотестов)
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
