"""ORM-модели. Импортируйте новые модели здесь, чтобы Alembic их видел."""

from app.models.base import Base
from app.models.bug import Bug, BugPriority, BugSeverity, BugStatus
from app.models.project import Project
from app.models.section import Section
from app.models.test_case import TestCase, TestCasePriority, TestCaseStatus
from app.models.user import User, UserRole

__all__ = [
    "Base",
    "Bug",
    "BugPriority",
    "BugSeverity",
    "BugStatus",
    "Project",
    "Section",
    "TestCase",
    "TestCasePriority",
    "TestCaseStatus",
    "User",
    "UserRole",
]
