"""create bugs table

Revision ID: 20260512_0003
Revises: 20260508_0002
Create Date: 2026-05-12

"""
from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260512_0003"
down_revision: Union[str, None] = "20260508_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "bugs",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("project_id", sa.BigInteger(), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("steps_to_reproduce", sa.Text(), nullable=True),
        sa.Column("actual_result", sa.Text(), nullable=True),
        sa.Column("expected_result", sa.Text(), nullable=True),
        sa.Column("environment", sa.String(length=500), nullable=True),
        sa.Column(
            "severity",
            sa.String(length=16),
            nullable=False,
            server_default=sa.text("'major'"),
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
            server_default=sa.text("'new'"),
        ),
        sa.Column(
            "tags",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("reporter_id", sa.BigInteger(), nullable=True),
        sa.Column("assignee_id", sa.BigInteger(), nullable=True),
        sa.Column("test_case_id", sa.BigInteger(), nullable=True),
        sa.Column("kaiten_card_id", sa.String(length=64), nullable=True),
        sa.Column("kaiten_card_url", sa.String(length=500), nullable=True),
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
            name="fk_bugs_project_id_projects",
        ),
        sa.ForeignKeyConstraint(
            ["reporter_id"],
            ["users.id"],
            ondelete="SET NULL",
            name="fk_bugs_reporter_id_users",
        ),
        sa.ForeignKeyConstraint(
            ["assignee_id"],
            ["users.id"],
            ondelete="SET NULL",
            name="fk_bugs_assignee_id_users",
        ),
        sa.ForeignKeyConstraint(
            ["test_case_id"],
            ["test_cases.id"],
            ondelete="SET NULL",
            name="fk_bugs_test_case_id_test_cases",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_bugs"),
    )
    op.create_index("ix_bugs_project_id", "bugs", ["project_id"])
    op.create_index("ix_bugs_status", "bugs", ["status"])
    op.create_index("ix_bugs_assignee_id", "bugs", ["assignee_id"])
    op.create_index("ix_bugs_test_case_id", "bugs", ["test_case_id"])


def downgrade() -> None:
    op.drop_index("ix_bugs_test_case_id", table_name="bugs")
    op.drop_index("ix_bugs_assignee_id", table_name="bugs")
    op.drop_index("ix_bugs_status", table_name="bugs")
    op.drop_index("ix_bugs_project_id", table_name="bugs")
    op.drop_table("bugs")
