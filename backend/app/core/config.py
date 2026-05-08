"""Конфигурация приложения. Все значения — из переменных окружения."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    project_name: str = Field(default="Kinescope TMS", alias="PROJECT_NAME")
    env: Literal["development", "staging", "production"] = Field(
        default="development", alias="ENV"
    )
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    api_host: str = Field(default="0.0.0.0", alias="API_HOST")
    api_port: int = Field(default=8000, alias="API_PORT")
    # Храним как строку: "*" или CSV ("http://a, http://b").
    # pydantic-settings v2 парсит list[...] как JSON, поэтому забираем сырое значение
    # и собственноручно разбиваем в свойстве cors_origins.
    cors_origins_raw: str = Field(default="http://localhost:5173", alias="CORS_ORIGINS")

    allowed_email_domain: str = Field(default="kinescope.io", alias="ALLOWED_EMAIL_DOMAIN")
    jwt_secret: str = Field(default="dev-secret-change-me", alias="JWT_SECRET")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(default=60, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    refresh_token_expire_days: int = Field(default=14, alias="REFRESH_TOKEN_EXPIRE_DAYS")
    # Email-адреса (через запятую), которые при регистрации сразу получают роль admin.
    admin_emails_raw: str = Field(default="", alias="ADMIN_EMAILS")
    refresh_cookie_name: str = Field(default="tms_refresh", alias="REFRESH_COOKIE_NAME")
    # Включать ТОЛЬКО когда сайт реально отдаётся по HTTPS, иначе браузер не
    # сохранит cookie и refresh перестанет работать. По умолчанию выключено.
    cookie_secure: bool = Field(default=False, alias="COOKIE_SECURE")

    database_url: PostgresDsn = Field(
        default="postgresql+asyncpg://tms:tms@localhost:5432/kinescope_tms",
        alias="DATABASE_URL",
    )

    @property
    def cors_origins(self) -> list[str]:
        """CORS_ORIGINS из env: либо "*", либо список через запятую."""
        raw = self.cors_origins_raw.strip()
        if raw == "*":
            return ["*"]
        return [item.strip() for item in raw.split(",") if item.strip()]

    @property
    def admin_emails(self) -> set[str]:
        """ADMIN_EMAILS из env: список email'ов через запятую, нормализованный."""
        return {
            item.strip().lower()
            for item in self.admin_emails_raw.split(",")
            if item.strip()
        }

    @property
    def is_production(self) -> bool:
        return self.env == "production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
