"""use TIMESTAMPTZ for all datetime columns

Revision ID: 891e672a26a9
Revises: 710442dad2c4
Create Date: 2026-05-07 00:00:00.000000

The application code consistently builds timezone-aware UTC datetimes
(`datetime.now(timezone.utc)`), but the original schema declared these
columns as plain `TIMESTAMP WITHOUT TIME ZONE`. SQLite tolerated the
mismatch; Postgres + asyncpg does not (`can't subtract offset-naive and
offset-aware datetimes` on bind). This migration aligns the schema with
the code by converting every datetime column to `TIMESTAMP WITH TIME ZONE`,
interpreting existing values as UTC.

SQLite has no distinct TIMESTAMPTZ type, so the migration is a no-op there.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '891e672a26a9'
down_revision: Union[str, Sequence[str], None] = '710442dad2c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (table, column) pairs to convert.
COLUMNS = [
    ('users', 'created_at'),
    ('users', 'updated_at'),
    ('sessions', 'expires_at'),
    ('sessions', 'created_at'),
    ('tokens', 'expires_at'),
    ('tokens', 'used_at'),
    ('tokens', 'created_at'),
    ('whitelist_settings', 'updated_at'),
    ('whitelist_entries', 'created_at'),
]


def upgrade() -> None:
    """Upgrade schema."""
    if op.get_bind().dialect.name != 'postgresql':
        return

    for table, column in COLUMNS:
        op.alter_column(
            table,
            column,
            existing_type=sa.DateTime(timezone=False),
            type_=sa.DateTime(timezone=True),
            postgresql_using=f"{column} AT TIME ZONE 'UTC'",
        )


def downgrade() -> None:
    """Downgrade schema."""
    if op.get_bind().dialect.name != 'postgresql':
        return

    for table, column in COLUMNS:
        op.alter_column(
            table,
            column,
            existing_type=sa.DateTime(timezone=True),
            type_=sa.DateTime(timezone=False),
            postgresql_using=f"{column} AT TIME ZONE 'UTC'",
        )
