"""
hours.py — everything the Flask app needs from the database, as plain functions.
The Flask routes call these; none of them know anything about HTTP or Google.
"""
from db import get_conn


# ---------------------------------------------------------------- people
def upsert_person(google_sub: str, email: str, display_name: str | None) -> int:
    """Call after Flask has verified the Google ID token. Returns people.id."""
    with get_conn() as conn:
        return conn.execute(
            """INSERT INTO people (google_sub, email, display_name)
               VALUES (%s, %s, %s)
               ON CONFLICT (google_sub) DO UPDATE
                   SET email = EXCLUDED.email, display_name = EXCLUDED.display_name
               RETURNING id""",
            (google_sub, email, display_name),
        ).fetchone()["id"]


# ---------------------------------------------------------------- events
def list_events(upcoming_only: bool = False) -> list[dict]:
    with get_conn() as conn:
        return conn.execute(
            """SELECT id, title, org_name, location, starts_at, ends_at, source, source_url
               FROM events
               WHERE (%s = FALSE OR starts_at >= now())
               ORDER BY starts_at""",
            (upcoming_only,),
        ).fetchall()


# ---------------------------------------------------------------- student side
def submit_hours(person_id: int, event_id: int, hours: float, task: str | None) -> dict | None:
    """Creates a PENDING entry. Returns None if this person already logged this event."""
    with get_conn() as conn:
        return conn.execute(
            """INSERT INTO hour_entries (person_id, event_id, hours, task)
               VALUES (%s, %s, %s, %s)
               ON CONFLICT (person_id, event_id) DO NOTHING
               RETURNING id, status, submitted_at""",
            (person_id, event_id, hours, task),
        ).fetchone()


def my_entries(person_id: int) -> list[dict]:
    with get_conn() as conn:
        return conn.execute(
            """SELECT h.id, e.title, e.org_name, h.hours, h.task, h.status, h.submitted_at
               FROM hour_entries h JOIN events e ON e.id = h.event_id
               WHERE h.person_id = %s
               ORDER BY h.submitted_at DESC""",
            (person_id,),
        ).fetchall()


# ---------------------------------------------------------------- organizer side
def pending_for_organizer(reviewer_id: int) -> list[dict]:
    """Entries waiting on this person, matched by their email = events.organizer_email."""
    with get_conn() as conn:
        return conn.execute(
            """SELECT h.id, p.display_name, p.email, e.title, h.hours, h.task, h.submitted_at
               FROM hour_entries h
               JOIN events e ON e.id = h.event_id
               JOIN people p ON p.id = h.person_id
               JOIN people r ON r.id = %s AND lower(r.email) = lower(e.organizer_email)
               WHERE h.status = 'pending'
               ORDER BY h.submitted_at""",
            (reviewer_id,),
        ).fetchall()


def approve(entry_id: int, reviewer_id: int) -> bool:
    """Marks the entry verified AND writes it to the hypertable, in one statement.
    False = entry wasn't pending, or reviewer isn't that event's organizer."""
    with get_conn() as conn:
        row = conn.execute(
            """WITH approved AS (
                   UPDATE hour_entries h
                   SET status = 'verified', reviewed_by = r.id, reviewed_at = now()
                   FROM events e, people r
                   WHERE h.id = %(entry)s AND h.status = 'pending'
                     AND e.id = h.event_id
                     AND r.id = %(reviewer)s
                     AND lower(r.email) = lower(e.organizer_email)
                   RETURNING h.id, h.person_id, h.event_id, h.hours
               )
               INSERT INTO verified_hours (person_id, event_id, hours, entry_id)
               SELECT person_id, event_id, hours, id FROM approved
               RETURNING entry_id""",
            {"entry": entry_id, "reviewer": reviewer_id},
        ).fetchone()
    return row is not None


def reject(entry_id: int, reviewer_id: int) -> bool:
    with get_conn() as conn:
        row = conn.execute(
            """UPDATE hour_entries h
               SET status = 'rejected', reviewed_by = r.id, reviewed_at = now()
               FROM events e, people r
               WHERE h.id = %(entry)s AND h.status = 'pending'
                 AND e.id = h.event_id
                 AND r.id = %(reviewer)s
                 AND lower(r.email) = lower(e.organizer_email)
               RETURNING h.id""",
            {"entry": entry_id, "reviewer": reviewer_id},
        ).fetchone()
    return row is not None


# ---------------------------------------------------------------- trees (verified hours only)
def grove() -> list[dict]:
    """One row per person = one tree. total_hours drives height and canopy."""
    with get_conn() as conn:
        return conn.execute(
            """SELECT p.id, p.display_name, COALESCE(SUM(d.hours), 0)::float8 AS total_hours
               FROM people p LEFT JOIN person_daily_hours d ON d.person_id = p.id
               GROUP BY p.id, p.display_name
               ORDER BY total_hours DESC, p.id"""
        ).fetchall()


def tree_total(person_id: int) -> float:
    with get_conn() as conn:
        return conn.execute(
            "SELECT COALESCE(SUM(hours), 0)::float8 AS total FROM person_daily_hours WHERE person_id = %s",
            (person_id,),
        ).fetchone()["total"]


def daily_hours(person_id: int) -> list[dict]:
    """Hours per day for one person, for a growth chart."""
    with get_conn() as conn:
        return conn.execute(
            """SELECT day::date AS day, hours::float8 AS hours
               FROM person_daily_hours WHERE person_id = %s ORDER BY day""",
            (person_id,),
        ).fetchall()