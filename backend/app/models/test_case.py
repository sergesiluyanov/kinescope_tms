"""ORM-модель тест-кейса."""

from __future__ import annotations

import enum
from typing import Any

from sqlalchemy import BigInteger, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IntPkMixin, TimestampMixin


class TestCasePriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class TestCaseStatus(str, enum.Enum):
    active = "active"
    archived = "archived"


class TestCase(IntPkMixin, TimestampMixin, Base):
    __tablename__ = "test_cases"

    section_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("sections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    preconditions: Mapped[str | None] = mapped_column(Text)
    # steps хранится как массив JSONB-объектов вида {"action": "...", "expected": "..."}
    steps: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
        server_default="[]",
    )
    priority: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=TestCasePriority.medium.value,
        server_default=TestCasePriority.medium.value,
    )
    status: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=TestCaseStatus.active.value,
        server_default=TestCaseStatus.active.value,
    )
    tags: Mapped[list[str]] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
        server_default="[]",
    )
    created_by_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    def __repr__(self) -> str:
        return f"<TestCase id={self.id} section_id={self.section_id} title={self.title!r}>"
