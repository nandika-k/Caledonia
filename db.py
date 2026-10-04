"""Shared PostgreSQL connection helpers for TigerData/Azure."""

from __future__ import annotations

import os
from contextlib import contextmanager
from urllib.parse import quote_plus

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

load_dotenv()


def database_url() -> str:
    """Return a hosted Postgres connection URL from common env var shapes."""
    url = (
        os.environ.get("DATABASE_URL")
        or os.environ.get("TIGERDATA_DATABASE_URL")
        or os.environ.get("AZURE_POSTGRESQL_CONNECTIONSTRING")
    )
    if url:
        return url

    required = ("PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD")
    if all(os.environ.get(name) for name in required):
        user = quote_plus(os.environ["PGUSER"])
        password = quote_plus(os.environ["PGPASSWORD"])
        host = os.environ["PGHOST"]
        port = os.environ["PGPORT"]
        database = os.environ["PGDATABASE"]
        sslmode = os.environ.get("PGSSLMODE", "require")
        return f"postgresql://{user}:{password}@{host}:{port}/{database}?sslmode={sslmode}"

    raise RuntimeError(
        "Set DATABASE_URL/TIGERDATA_DATABASE_URL/AZURE_POSTGRESQL_CONNECTIONSTRING "
        "or PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD."
    )


@contextmanager
def get_conn():
    """Open a dict-row connection that commits on successful context exit."""
    with psycopg.connect(database_url(), row_factory=dict_row) as conn:
        yield conn
