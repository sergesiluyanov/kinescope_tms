"""ORM-модели. Импортируйте новые модели здесь, чтобы Alembic их видел."""

from app.models.base import Base
from app.models.user import User, UserRole

__all__ = ["Base", "User", "UserRole"]
