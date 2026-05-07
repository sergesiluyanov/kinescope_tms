.DEFAULT_GOAL := help
SHELL := /usr/bin/env bash

COMPOSE ?= docker compose

.PHONY: help
help:
	@echo "Available targets:"
	@echo "  make init           — скопировать .env.example в .env"
	@echo "  make up             — поднять весь стек (postgres + api + web)"
	@echo "  make down           — остановить стек"
	@echo "  make logs           — хвост логов всех сервисов"
	@echo "  make api-logs       — логи бэкенда"
	@echo "  make api-shell      — shell внутри контейнера api"
	@echo "  make migrate        — alembic upgrade head"
	@echo "  make revision m=... — создать миграцию (autogenerate)"
	@echo "  make psql           — psql внутри контейнера postgres"
	@echo "  make rebuild        — пересобрать образы"

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

.PHONY: logs
logs:
	$(COMPOSE) logs -f --tail=200

.PHONY: api-logs
api-logs:
	$(COMPOSE) logs -f --tail=200 api

.PHONY: api-shell
api-shell:
	$(COMPOSE) exec api bash

.PHONY: migrate
migrate:
	$(COMPOSE) exec api alembic upgrade head

.PHONY: revision
revision:
	@test -n "$(m)" || (echo "usage: make revision m=\"описание\"" && exit 1)
	$(COMPOSE) exec api alembic revision --autogenerate -m "$(m)"

.PHONY: psql
psql:
	$(COMPOSE) exec postgres psql -U $${POSTGRES_USER:-tms} -d $${POSTGRES_DB:-kinescope_tms}
