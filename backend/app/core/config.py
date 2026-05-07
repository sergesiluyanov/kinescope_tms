"""Конфигурация приложения. Все значения — из переменных окружения."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn, field_validator
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
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:5173"], alias="CORS_ORIGINS"
    )

    allowed_email_domain: str = Field(default="kinescope.io", alias="ALLOWED_EMAIL_DOMAIN")
    jwt_secret: str = Field(default="dev-secret-change-me", alias="JWT_SECRET")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(default=60, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    refresh_token_expire_days: int = Field(default=14, alias="REFRESH_TOKEN_EXPIRE_DAYS")

    database_url: PostgresDsn = Field(
        default="postgresql+asyncpg://tms:tms@localhost:5432/kinescope_tms",
        alias="DATABASE_URL",
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_cors(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
