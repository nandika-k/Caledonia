"""
test_flow.py — checks the whole hours loop against the real database, then cleans up.
Place in the repo root (next to hours.py). Needs schema.sql to have been run.

    python test_flow.py

Does not use Gemini. Every row it creates is tagged 'flowtest' and removed at the end.
"""
import hours
from db import get_conn

ORGANIZER_EMAIL = "flowtest-organizer@njit.edu"


def check(label: str, ok: bool):
    print(("PASS  " if ok else "FAIL  ") + label)
    return ok


def cleanup():
    with get_conn() as conn:
        ids = [r["id"] for r in conn.execute(
            "SELECT id FROM people WHERE google_sub LIKE 'flowtest-%'")]
        conn.execute("DELETE FROM verified_hours WHERE person_id = ANY(%s)", (ids,))
        conn.execute("DELETE FROM hour_entries WHERE person_id = ANY(%s)", (ids,))
        conn.execute("DELETE FROM events WHERE source = 'flowtest'")
        conn.execute("DELETE FROM people WHERE google_sub LIKE 'flowtest-%'")


if __name__ == "__main__":
    cleanup()  # in case an earlier run crashed
    results = []
    try:
        # Set up: one event, one student, the event's organizer, one unrelated person
        with get_conn() as conn:
            event_id = conn.execute(
                """INSERT INTO events (source, source_id, title, starts_at, location,
                                       org_name, organizer_email)
                   VALUES ('flowtest', 'flowtest-1', 'Flow Test Event', now(),
                           'Flow Test Room', 'Flow Test Club', %s)
                   RETURNING id""", (ORGANIZER_EMAIL,)).fetchone()["id"]
            dup = conn.execute(
                """INSERT INTO events (source, source_id, title, starts_at, location, org_name)
                   SELECT 'flowtest', 'flowtest-2', 'Same event, other source', starts_at,
                          'flow test ROOM', 'Flow-Test Club' FROM events WHERE id = %s
                   ON CONFLICT DO NOTHING RETURNING id""", (event_id,)).fetchone()
        results.append(check("duplicate event (same club, location, time) is rejected", dup is None))

        student = hours.upsert_person("flowtest-student", "flowtest-student@njit.edu", "Flow Student")
        organizer = hours.upsert_person("flowtest-organizer", ORGANIZER_EMAIL, "Flow Organizer")
        stranger = hours.upsert_person("flowtest-stranger", "flowtest-stranger@njit.edu", "Flow Stranger")
        results.append(check("signing in twice gives the same person",
                             hours.upsert_person("flowtest-student", "flowtest-student@njit.edu",
                                                 "Flow Student") == student))

        entry = hours.submit_hours(student, event_id, 2.5, "setup crew")
        results.append(check("submission is created as pending",
                             entry is not None and entry["status"] == "pending"))
        results.append(check("second submission for the same event is refused",
                             hours.submit_hours(student, event_id, 1, None) is None))
        results.append(check("pending hours do NOT count on the tree",
                             hours.tree_total(student) == 0))
        results.append(check("organizer sees the pending entry",
                             any(r["id"] == entry["id"] for r in hours.pending_for_organizer(organizer))))
        results.append(check("someone who isn't the organizer cannot approve",
                             hours.approve(entry["id"], stranger) is False))
        results.append(check("organizer can approve", hours.approve(entry["id"], organizer) is True))
        results.append(check("approving twice does nothing",
                             hours.approve(entry["id"], organizer) is False))
        results.append(check("verified hours appear on the tree right away",
                             hours.tree_total(student) == 2.5))
        results.append(check("student shows up in the grove with 2.5 hours",
                             any(t["id"] == student and t["total_hours"] == 2.5 for t in hours.grove())))
    finally:
        cleanup()

    print(f"\n{sum(results)}/{len(results)} checks passed" if len(results) == 11
          else "\nStopped early because of an error (see above).")