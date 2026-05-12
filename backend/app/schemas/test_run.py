"""Pydantic-схемы тест-ранов и их пунктов."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.test_case import TestCasePriority
from app.models.test_run import TestRunItemStatus, TestRunStatus
from app.schemas.bug import BugUserRef
from app.schemas.test_case import TestStep


class TestRunCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=10_000)
    environment: str | None = Field(default=None, max_length=200)
    section_ids: list[int] = Field(default_factory=list)
    include_subsections: bool = True
    case_ids: list[int] = Field(
        default_factory=list,
        description="Можно явно указать тест-кейсы вдобавок (или вместо) разделов.",
    )


class TestRunUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=10_000)
    environment: str | None = Field(default=None, max_length=200)
    status: TestRunStatus | None = None


class TestRunItemUpdateRequest(BaseModel):
    status: TestRunItemStatus | None = None
    comment: str | None = Field(default=None, max_length=10_000)
    assignee_id: int | None = None
    linked_bug_id: int | None = None


class TestRunItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    test_run_id: int
    test_case_id: int | None
    title: str
    preconditions: str | None
    steps: list[TestStep]
    priority: TestCasePriority
    tags: list[str]
    status: TestRunItemStatus
    comment: str | None
    assignee: BugUserRef | None = None
    executed_by: BugUserRef | None = None
    executed_at: datetime | None
    linked_bug_id: int | None
    position: int
    created_at: datetime
    updated_at: datetime


class TestRunStats(BaseModel):
    total: int
    untested: int
    passed: int
    failed: int
    blocked: int
    skipped: int

    @property
    def progress_pct(self) -> int:
        if self.total == 0:
            return 0
        done = self.total - self.untested
        return int(round(done * 100 / self.total))


class TestRunSummary(BaseModel):
    """Сокращённый вид для списков."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    name: str
    description: str | None
    status: TestRunStatus
    environment: str | None
    created_by: BugUserRef | None = None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    stats: TestRunStats


class TestRunResponse(BaseModel):
    """Полный ответ с пунктами прогона."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    name: str
    description: str | None
    status: TestRunStatus
    environment: str | None
    created_by: BugUserRef | None = None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    items: list[TestRunItemResponse]
    stats: TestRunStats
