"""Pydantic-схемы тест-кейса."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.test_case import TestCasePriority, TestCaseStatus


class TestStep(BaseModel):
    """Шаг тест-кейса. Хранится внутри JSONB-поля steps."""

    action: str = Field(min_length=1, max_length=2_000)
    expected: str = Field(min_length=1, max_length=2_000)


class TestCaseCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    preconditions: str | None = Field(default=None, max_length=10_000)
    steps: list[TestStep] = Field(default_factory=list)
    priority: TestCasePriority = TestCasePriority.medium
    tags: list[str] = Field(default_factory=list)


class TestCaseUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    preconditions: str | None = Field(default=None, max_length=10_000)
    steps: list[TestStep] | None = None
    priority: TestCasePriority | None = None
    status: TestCaseStatus | None = None
    tags: list[str] | None = None
    section_id: int | None = None


class TestCaseSummary(BaseModel):
    """Урезанный вид для списочных эндпоинтов."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    section_id: int
    title: str
    priority: TestCasePriority
    status: TestCaseStatus
    tags: list[str]
    updated_at: datetime


class TestCaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    section_id: int
    title: str
    preconditions: str | None
    steps: list[TestStep]
    priority: TestCasePriority
    status: TestCaseStatus
    tags: list[str]
    created_by_id: int | None
    created_at: datetime
    updated_at: datetime


class TestCaseLocator(BaseModel):
    """Координаты тест-кейса в иерархии — для коротких deep-link URL."""

    case_id: int
    section_id: int
    project_id: int
