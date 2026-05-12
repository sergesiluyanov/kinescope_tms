"""Pydantic-схемы для баг-репортов."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.bug import BugPriority, BugSeverity, BugStatus


class BugCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str | None = Field(default=None, max_length=20_000)
    steps_to_reproduce: str | None = Field(default=None, max_length=10_000)
    actual_result: str | None = Field(default=None, max_length=10_000)
    expected_result: str | None = Field(default=None, max_length=10_000)
    environment: str | None = Field(default=None, max_length=500)
    severity: BugSeverity = BugSeverity.major
    priority: BugPriority = BugPriority.medium
    status: BugStatus = BugStatus.new
    tags: list[str] = Field(default_factory=list)
    assignee_id: int | None = None
    test_case_id: int | None = None


class BugUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    description: str | None = Field(default=None, max_length=20_000)
    steps_to_reproduce: str | None = Field(default=None, max_length=10_000)
    actual_result: str | None = Field(default=None, max_length=10_000)
    expected_result: str | None = Field(default=None, max_length=10_000)
    environment: str | None = Field(default=None, max_length=500)
    severity: BugSeverity | None = None
    priority: BugPriority | None = None
    status: BugStatus | None = None
    tags: list[str] | None = None
    assignee_id: int | None = None
    test_case_id: int | None = None


class BugUserRef(BaseModel):
    """Краткие данные пользователя для отображения в карточке бага."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str | None = None


class BugSummary(BaseModel):
    """Сокращённое представление бага для табличных списков."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    title: str
    severity: BugSeverity
    priority: BugPriority
    status: BugStatus
    tags: list[str]
    reporter: BugUserRef | None = None
    assignee: BugUserRef | None = None
    test_case_id: int | None = None
    updated_at: datetime
    created_at: datetime


class BugResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    title: str
    description: str | None
    steps_to_reproduce: str | None
    actual_result: str | None
    expected_result: str | None
    environment: str | None
    severity: BugSeverity
    priority: BugPriority
    status: BugStatus
    tags: list[str]
    reporter: BugUserRef | None = None
    assignee: BugUserRef | None = None
    test_case_id: int | None
    kaiten_card_id: str | None
    kaiten_card_url: str | None
    created_at: datetime
    updated_at: datetime
