"""
ingest.py — puts scraped events into the database.
The scraper code (whoever writes it) calls ingest_hub() first, then ingest_social().

Highlander Hub must go first: it supplies the organizer emails and the official
club/location names that normalize.py matches social posts against.
"""
from datetime import datetime

from db import get_conn
from normalize import known_names, parse_post

INSERT_EVENT = """
    INSERT INTO events (source, source_id, source_url, title,
                        starts_at, ends_at, location, org_name, organizer_email)
    VALUES (%(source)s, %(source_id)s, %(source_url)s, %(title)s,
            %(starts_at)s, %(ends_at)s, %(location)s, %(org_name)s, %(organizer_email)s)
    ON CONFLICT DO NOTHING
    RETURNING id
"""


def ingest_hub(hub_events: list[dict]) -> int:
    """hub_events: dicts with keys source_id, source_url, title, starts_at, ends_at,
    location, org_name, organizer_email. Returns how many were new."""
    added = 0
    with get_conn() as conn:
        for e in hub_events:
            row = conn.execute(INSERT_EVENT, {**e, "source": "highlander_hub"}).fetchone()
            added += row is not None          # no row back = duplicate, skipped
    return added


def ingest_social(posts: list[dict], source: str = "instagram") -> dict:
    """posts: dicts with keys post_id, url, account, text, posted_at (datetime).
    Each post goes through Gemini, then the same INSERT. Returns counts."""
    clubs, places = known_names()             # official names, fetched once per run
    counts = {"added": 0, "duplicate": 0, "skipped": 0}
    for p in posts:
        event = parse_post(p["text"], p["account"], p["posted_at"], clubs, places)
        if event is None:                     # no usable date/time in the post
            counts["skipped"] += 1
            continue
        with get_conn() as conn:
            row = conn.execute(INSERT_EVENT, {
                "source": source,
                "source_id": p["post_id"],
                "source_url": p["url"],
                "title": event.title,
                "starts_at": event.starts_at,
                "ends_at": event.ends_at,
                "location": event.location,
                "org_name": event.club,
                "organizer_email": None,      # socials don't have one
            }).fetchone()
        counts["added" if row else "duplicate"] += 1
    return counts


if __name__ == "__main__":
    # End-to-end check with fake data: python ingest.py
    # Expect: hub added 1, then the Instagram post counted as a duplicate.
    start = "2026-10-16T18:00:00-04:00"
    print("hub added:", ingest_hub([{
        "source_id": "test-1", "source_url": None, "title": "Fall Campus Cleanup",
        "starts_at": start, "ends_at": "2026-10-16T20:00:00-04:00",
        "location": "Campus Center Ballroom A",
        "org_name": "Association for Computing Machinery",
        "organizer_email": "organizer@njit.edu",
    }]))
    print("social:", ingest_social([{
        "post_id": "test-post-1", "url": None, "account": "njit_acm",
        "text": "ACM cleanup this Friday 6pm, CC Ballroom A! Volunteers needed",
        "posted_at": datetime.fromisoformat("2026-10-12T12:00:00-04:00"),
    }]))