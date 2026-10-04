"""
run_sql.py — runs a .sql file against the database using the credentials in .env.
Place in the repo root (next to db.py).

    python run_sql.py db/schema.sql
    python run_sql.py db/verify.sql

Each statement runs on its own (autocommit), which continuous aggregates require.
"""
import sys

from db import get_conn


def statements(path: str) -> list[str]:
    with open(path, encoding="utf-8") as f:
        lines = [ln.split("--", 1)[0] for ln in f]      # drop SQL comments
    return [s.strip() for s in "".join(lines).split(";") if s.strip()]


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: python run_sql.py path/to/file.sql")
    with get_conn() as conn:
        conn.autocommit = True
        for sql in statements(sys.argv[1]):
            first_line = sql.splitlines()[0][:70]
            try:
                cur = conn.execute(sql)
            except Exception as e:
                sys.exit(f"FAILED: {first_line}\n  {e}")
            print(f"ok: {first_line}")
            if cur.description:                          # a SELECT: show its rows
                for row in cur.fetchall():
                    print("    ", dict(row))