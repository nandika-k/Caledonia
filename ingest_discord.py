"""Move Discord bot-collected posts into the canonical events table."""

from __future__ import annotations

from datetime import datetime

from db import get_conn
from ingest import ingest_social


def pending_discord_posts(limit: int = 100) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT message_id, message_url, guild_name, channel_name,
                      text, posted_at, status
               FROM opportunities
               WHERE status IN ('needs_review', 'failed')
               ORDER BY posted_at
               LIMIT %s""",
            (limit,),
        ).fetchall()
    return [dict(row) for row in rows]


def mark_posts(message_ids: list[str], status: str) -> None:
    if not message_ids:
        return
    with get_conn() as conn:
        conn.execute(
            "UPDATE opportunities SET status = %s WHERE message_id = ANY(%s)",
            (status, message_ids),
        )


def to_social_post(row: dict) -> dict:
    posted_at = row["posted_at"]
    if isinstance(posted_at, str):
        posted_at = datetime.fromisoformat(posted_at)
    return {
        "post_id": row["message_id"],
        "url": row["message_url"],
        "account": row.get("guild_name") or row.get("channel_name") or "discord",
        "text": row["text"],
        "posted_at": posted_at,
    }


def ingest_pending_discord(limit: int = 100) -> dict:
    rows = pending_discord_posts(limit)
    if not rows:
        return {"processed": 0, "added": 0, "duplicate": 0, "skipped": 0, "failed": 0}

    counts = {"processed": 0, "added": 0, "duplicate": 0, "skipped": 0, "failed": 0}
    for index, row in enumerate(rows, start=1):
        message_id = row["message_id"]
        print(f"Processing Discord post {index}/{len(rows)} ({message_id})...", flush=True)
        try:
            result = ingest_social([to_social_post(row)], source="discord")
        except Exception:
            mark_posts([message_id], "failed")
            raise

        mark_posts([message_id], "ingested")
        counts["processed"] += 1
        for key in ("added", "duplicate", "skipped"):
            counts[key] += result[key]

    return counts


if __name__ == "__main__":
    print(ingest_pending_discord())
