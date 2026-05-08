"""create projects, sections, test_cases

Revision ID: 20260508_0002
Revises: 20260508_0001
Create Date: 2026-05-08

"""
from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260508_0002"
down_revision: Union[str, None] = "20260508_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "projects",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_by_id", sa.BigInteger(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            ondelete="SET NULL",
            name="fk_projects_created_by_id_users",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_projects"),
    )

    op.create_table(
        "sections",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("project_id", sa.BigInteger(), nullable=False),
        sa.Column("parent_id", sa.BigInteger(), nullable=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "position",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            ondelete="CASCADE",
            name="fk_sections_project_id_projects",
        ),
        sa.ForeignKeyConstraint(
            ["parent_id"],
            ["sections.id"],
            ondelete="CASCADE",
            name="fk_sections_parent_id_sections",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_sections"),
    )
    op.create_index("ix_sections_project_id", "sections", ["project_id"])
    op.create_index("ix_sections_parent_id", "sections", ["parent_id"])

    op.create_table(
        "test_cases",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("section_id", sa.BigInteger(), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("preconditions", sa.Text(), nullable=True),
        sa.Column(
            "steps",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "priority",
            sa.String(length=16),
            nullable=False,
            server_default=sa.text("'medium'"),
        ),
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default=sa.text("'active'"),
        ),
        sa.Column(
            "tags",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("created_by_id", sa.BigInteger(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["section_id"],
            ["sections.id"],
            ondelete="CASCADE",
            name="fk_test_cases_section_id_sections",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            ondelete="SET NULL",
            name="fk_test_cases_created_by_id_users",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_test_cases"),
    )
    op.create_index("ix_test_cases_section_id", "test_cases", ["section_id"])


def downgrade() -> None:
    op.drop_index("ix_test_cases_section_id", table_name="test_cases")
    op.drop_table("test_cases")
    op.drop_index("ix_sections_parent_id", table_name="sections")
    op.drop_index("ix_sections_project_id", table_name="sections")
    op.drop_table("sections")
    op.drop_table("projects")
