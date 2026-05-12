"""ORM-модели тест-ранов и их пунктов."""

from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, IntPkMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


class TestRunStatus(str, enum.Enum):
    draft = "draft"
    in_progress = "in_progress"
    completed = "completed"
    aborted = "aborted"


class TestRunItemStatus(str, enum.Enum):
    untested = "untested"
    passed = "passed"
    failed = "failed"
    blocked = "blocked"
    skipped = "skipped"


class TestRun(IntPkMixin, TimestampMixin, Base):
    __tablename__ = "test_runs"

    project_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=TestRunStatus.draft.value,
        server_default=TestRunStatus.draft.value,
        index=True,
    )
    environment: Mapped[str | None] = mapped_column(String(200))
    created_by_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_by: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[created_by_id],
        lazy="raise",
    )
    items: Mapped[list["TestRunItem"]] = relationship(
        "TestRunItem",
        back_populates="run",
        cascade="all, delete-orphan",
        order_by="TestRunItem.position, TestRunItem.id",
        lazy="raise",
    )

    def __repr__(self) -> str:
        return f"<TestRun id={self.id} name={self.name!r} status={self.status!r}>"


class TestRunItem(IntPkMixin, TimestampMixin, Base):
    __tablename__ = "test_run_items"

    test_run_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("test_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    test_case_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("test_cases.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Снимок кейса на момент включения в ран. Нужен, чтобы изменения кейса
    # после старта не искажали историю прохождения.
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    preconditions: Mapped[str | None] = mapped_column(Text)
    steps: Mapped[list[dict]] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
        server_default="[]",
    )
    priority: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default="medium",
        server_default="medium",
    )
    tags: Mapped[list[str]] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
        server_default="[]",
    )

    status: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=TestRunItemStatus.untested.value,
        server_default=TestRunItemStatus.untested.value,
        index=True,
    )
    comment: Mapped[str | None] = mapped_column(Text)
    assignee_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    executed_by_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    executed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    linked_bug_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("bugs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    position: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )

    run: Mapped["TestRun"] = relationship("TestRun", back_populates="items")
    assignee: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[assignee_id],
        lazy="raise",
    )
    executed_by: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[executed_by_id],
        lazy="raise",
    )

    def __repr__(self) -> str:
        return (
            f"<TestRunItem id={self.id} run_id={self.test_run_id}"
            f" status={self.status!r} title={self.title!r}>"
        )
