"""ORM-модель баг-репорта."""

from __future__ import annotations

import enum
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, IntPkMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


class BugSeverity(str, enum.Enum):
    blocker = "blocker"
    critical = "critical"
    major = "major"
    minor = "minor"
    trivial = "trivial"


class BugPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class BugStatus(str, enum.Enum):
    new = "new"
    in_progress = "in_progress"
    resolved = "resolved"
    closed = "closed"
    reopened = "reopened"
    wont_fix = "wont_fix"


class Bug(IntPkMixin, TimestampMixin, Base):
    __tablename__ = "bugs"

    project_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    steps_to_reproduce: Mapped[str | None] = mapped_column(Text)
    actual_result: Mapped[str | None] = mapped_column(Text)
    expected_result: Mapped[str | None] = mapped_column(Text)
    environment: Mapped[str | None] = mapped_column(String(500))

    severity: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=BugSeverity.major.value,
        server_default=BugSeverity.major.value,
    )
    priority: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=BugPriority.medium.value,
        server_default=BugPriority.medium.value,
    )
    status: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=BugStatus.new.value,
        server_default=BugStatus.new.value,
        index=True,
    )

    tags: Mapped[list[str]] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
        server_default="[]",
    )

    reporter_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    assignee_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    test_case_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("test_cases.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Поля под будущую интеграцию с Kaiten — пока не используем, но заведём место
    # сразу, чтобы потом обойтись без новой миграции.
    kaiten_card_id: Mapped[str | None] = mapped_column(String(64))
    kaiten_card_url: Mapped[str | None] = mapped_column(String(500))

    reporter: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[reporter_id],
        lazy="raise",
    )
    assignee: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[assignee_id],
        lazy="raise",
    )

    def __repr__(self) -> str:
        return f"<Bug id={self.id} title={self.title!r} status={self.status!r}>"
