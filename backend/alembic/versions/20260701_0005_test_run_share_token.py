"""add share_token to test_runs

Revision ID: 20260701_0005
Revises: 20260512_0004
Create Date: 2026-07-01

"""
from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260701_0005"
down_revision: Union[str, None] = "20260512_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "test_runs",
        sa.Column("share_token", sa.String(length=64), nullable=True),
    )
    op.create_unique_constraint(
        "uq_test_runs_share_token",
        "test_runs",
        ["share_token"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_test_runs_share_token", "test_runs", type_="unique")
    op.drop_column("test_runs", "share_token")
