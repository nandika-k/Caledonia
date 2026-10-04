"""Run a SQL file against the configured hosted Postgres database."""

from __future__ import annotations

import argparse
from pathlib import Path

from db import get_conn


def statements(path: Path) -> list[str]:
    lines = [line.split("--", 1)[0] for line in path.read_text(encoding="utf-8").splitlines()]
    return [statement.strip() for statement in "\n".join(lines).split(";") if statement.strip()]


def run_sql(path: Path) -> None:
    with get_conn() as conn:
        conn.autocommit = True
        for sql in statements(path):
            first_line = sql.splitlines()[0][:70]
            result = conn.execute(sql)
            print(f"ok: {first_line}")
            if result.description:
                for row in result.fetchall():
                    print("    ", dict(row))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("sql_file", type=Path)
    args = parser.parse_args()
    run_sql(args.sql_file)


if __name__ == "__main__":
    main()
