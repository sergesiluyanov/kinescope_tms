"""create test_runs and test_run_items tables

Revision ID: 20260512_0004
Revises: 20260512_0003
Create Date: 2026-05-12

"""
from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260512_0004"
down_revision: Union[str, None] = "20260512_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "test_runs",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("project_id", sa.BigInteger(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default=sa.text("'draft'"),
        ),
        sa.Column("environment", sa.String(length=200), nullable=True),
        sa.Column("created_by_id", sa.BigInteger(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
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
            name="fk_test_runs_project_id_projects",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            ondelete="SET NULL",
            name="fk_test_runs_created_by_id_users",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_test_runs"),
    )
    op.create_index("ix_test_runs_project_id", "test_runs", ["project_id"])
    op.create_index("ix_test_runs_status", "test_runs", ["status"])

    op.create_table(
        "test_run_items",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("test_run_id", sa.BigInteger(), nullable=False),
        sa.Column("test_case_id", sa.BigInteger(), nullable=True),
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
            "tags",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default=sa.text("'untested'"),
        ),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("assignee_id", sa.BigInteger(), nullable=True),
        sa.Column("executed_by_id", sa.BigInteger(), nullable=True),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("linked_bug_id", sa.BigInteger(), nullable=True),
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
            ["test_run_id"],
            ["test_runs.id"],
            ondelete="CASCADE",
            name="fk_test_run_items_test_run_id_test_runs",
        ),
        sa.ForeignKeyConstraint(
            ["test_case_id"],
            ["test_cases.id"],
            ondelete="SET NULL",
            name="fk_test_run_items_test_case_id_test_cases",
        ),
        sa.ForeignKeyConstraint(
            ["assignee_id"],
            ["users.id"],
            ondelete="SET NULL",
            name="fk_test_run_items_assignee_id_users",
        ),
        sa.ForeignKeyConstraint(
            ["executed_by_id"],
            ["users.id"],
            ondelete="SET NULL",
            name="fk_test_run_items_executed_by_id_users",
        ),
        sa.ForeignKeyConstraint(
            ["linked_bug_id"],
            ["bugs.id"],
            ondelete="SET NULL",
            name="fk_test_run_items_linked_bug_id_bugs",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_test_run_items"),
    )
    op.create_index("ix_test_run_items_test_run_id", "test_run_items", ["test_run_id"])
    op.create_index("ix_test_run_items_test_case_id", "test_run_items", ["test_case_id"])
    op.create_index("ix_test_run_items_status", "test_run_items", ["status"])
    op.create_index("ix_test_run_items_assignee_id", "test_run_items", ["assignee_id"])
    op.create_index("ix_test_run_items_linked_bug_id", "test_run_items", ["linked_bug_id"])


def downgrade() -> None:
    op.drop_index("ix_test_run_items_linked_bug_id", table_name="test_run_items")
    op.drop_index("ix_test_run_items_assignee_id", table_name="test_run_items")
    op.drop_index("ix_test_run_items_status", table_name="test_run_items")
    op.drop_index("ix_test_run_items_test_case_id", table_name="test_run_items")
    op.drop_index("ix_test_run_items_test_run_id", table_name="test_run_items")
    op.drop_table("test_run_items")
    op.drop_index("ix_test_runs_status", table_name="test_runs")
    op.drop_index("ix_test_runs_project_id", table_name="test_runs")
    op.drop_table("test_runs")
