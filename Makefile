.DEFAULT_GOAL := help
SHELL := /usr/bin/env bash

COMPOSE ?= docker compose
PROD := $(COMPOSE) -f docker-compose.prod.yml

.PHONY: help
help:
	@echo "DEV (фронт через Vite на :5173, API на :8000):"
	@echo "  make init           — скопировать .env.example в .env"
	@echo "  make up             — поднять dev-стек"
	@echo "  make down           — остановить dev-стек"
	@echo "  make logs           — хвост логов всех сервисов"
	@echo "  make api-logs       — логи бэкенда"
	@echo "  make api-shell      — shell внутри контейнера api"
	@echo "  make rebuild        — пересобрать dev-образы без кеша"
	@echo
	@echo "PROD (фронт собран в nginx на :80, api/postgres внутри docker-сети):"
	@echo "  make prod-up        — поднять prod-стек"
	@echo "  make prod-down      — остановить prod-стек"
	@echo "  make prod-logs      — логи prod-сервисов"
	@echo "  make prod-rebuild   — пересобрать prod-образы без кеша"
	@echo "  make prod-restart   — перезапустить (полезно после git pull)"
	@echo
	@echo "БД и миграции (работают в обоих режимах):"
	@echo "  make migrate        — alembic upgrade head в контейнере api"
	@echo "  make revision m=... — создать миграцию (autogenerate)"
	@echo "  make psql           — psql внутри контейнера postgres"

.PHONY: init
init:
	@if [ ! -f .env ]; then cp .env.example .env && echo "Создан .env из .env.example"; else echo ".env уже существует"; fi

.PHONY: up
up:
	$(COMPOSE) up -d --build

.PHONY: down
down:
	$(COMPOSE) down

.PHONY: rebuild
rebuild:
	$(COMPOSE) build --no-cache

.PHONY: prod-up
prod-up:
	$(PROD) up -d --build

.PHONY: prod-down
prod-down:
	$(PROD) down

.PHONY: prod-logs
prod-logs:
	$(PROD) logs -f --tail=200

.PHONY: prod-rebuild
prod-rebuild:
	$(PROD) build --no-cache

.PHONY: prod-restart
prod-restart:
	$(PROD) up -d --build
	$(PROD) ps

.PHONY: logs
logs:
	$(COMPOSE) logs -f --tail=200

.PHONY: api-logs
api-logs:
	$(COMPOSE) logs -f --tail=200 api

.PHONY: api-shell
api-shell:
	docker exec -it tms-api bash

.PHONY: migrate
migrate:
	docker exec tms-api alembic upgrade head

.PHONY: revision
revision:
	@test -n "$(m)" || (echo "usage: make revision m=\"описание\"" && exit 1)
	docker exec tms-api alembic revision --autogenerate -m "$(m)"

.PHONY: psql
psql:
	docker exec -it tms-postgres psql -U $${POSTGRES_USER:-tms} -d $${POSTGRES_DB:-kinescope_tms}
