"""PostgreSQL storage for scraped service opportunities."""

from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Any

import psycopg
from psycopg.rows import dict_row


def database_url() -> str:
    url = (
        os.environ.get("DATABASE_URL")
        or os.environ.get("TIGERDATA_DATABASE_URL")
        or os.environ.get("AZURE_POSTGRESQL_CONNECTIONSTRING")
    )
    if url:
        return url

    required = ("PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD")
    if all(os.environ.get(name) for name in required):
        sslmode = os.environ.get("PGSSLMODE", "require")
        return (
            f"postgresql://{os.environ['PGUSER']}:{os.environ['PGPASSWORD']}"
            f"@{os.environ['PGHOST']}:{os.environ['PGPORT']}/{os.environ['PGDATABASE']}"
            f"?sslmode={sslmode}"
        )

    raise RuntimeError(
        "Set DATABASE_URL/TIGERDATA_DATABASE_URL/AZURE_POSTGRESQL_CONNECTIONSTRING "
        "or PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD."
    )


@contextmanager
def connect():
    with psycopg.connect(database_url(), row_factory=dict_row) as db:
        yield db


def init_opportunities_table() -> None:
    with connect() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS service_opportunities (
                source TEXT NOT NULL,
                event_id TEXT NOT NULL,
                title TEXT NOT NULL,
                organization_name TEXT NOT NULL,
                organization_id TEXT,
                location TEXT,
                starts_on TIMESTAMPTZ,
                ends_on TIMESTAMPTZ,
                description TEXT,
                event_url TEXT,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                PRIMARY KEY (source, event_id)
            )
        """)
        db.execute("""
            CREATE INDEX IF NOT EXISTS service_opportunities_starts_on_idx
            ON service_opportunities (starts_on)
        """)
        db.execute("""
            CREATE INDEX IF NOT EXISTS service_opportunities_ends_on_idx
            ON service_opportunities (ends_on)
        """)


def upsert_opportunities(events: list[dict[str, Any]]) -> int:
    if not events:
        return 0

    with connect() as db:
        with db.cursor() as cursor:
            cursor.executemany("""
                INSERT INTO service_opportunities (
                    source, event_id, title, organization_name, organization_id,
                    location, starts_on, ends_on, description, event_url, updated_at
                )
                VALUES (
                    %(source)s, %(event_id)s, %(title)s, %(organization_name)s,
                    %(organization_id)s, %(location)s, %(starts_on)s, %(ends_on)s,
                    %(description)s, %(event_url)s, now()
                )
                ON CONFLICT (source, event_id) DO UPDATE SET
                    title = EXCLUDED.title,
                    organization_name = EXCLUDED.organization_name,
                    organization_id = EXCLUDED.organization_id,
                    location = EXCLUDED.location,
                    starts_on = EXCLUDED.starts_on,
                    ends_on = EXCLUDED.ends_on,
                    description = EXCLUDED.description,
                    event_url = EXCLUDED.event_url,
                    updated_at = now()
            """, events)
        return len(events)


def list_current_opportunities(limit: int = 100) -> list[dict[str, Any]]:
    init_opportunities_table()
    with connect() as db:
        rows = db.execute("""
            SELECT source, event_id, title, organization_name, organization_id,
                   location, starts_on, ends_on, description, event_url
            FROM service_opportunities
            WHERE ends_on IS NULL OR ends_on >= now()
            ORDER BY starts_on NULLS LAST, title
            LIMIT %(limit)s
        """, {"limit": limit}).fetchall()
    return [dict(row) for row in rows]
