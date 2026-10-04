"""
normalize.py — place next to db.py. Runs in the scraper, BEFORE the INSERT into events.

Takes a raw social post and uses Gemini to map its club and location onto the
exact names Highlander Hub already uses, so the database's duplicate rule
(club + location + start time) can match them.

Setup:
    pip install google-genai pydantic
    add GEMINI_API_KEY=... to .env   (and the blank key to .env.example)
"""
import os
import time
from datetime import datetime
from typing import Optional

from google import genai
from google.genai import errors
from pydantic import BaseModel

from db import get_conn

# Check Google AI Studio for the current Flash model name and set GEMINI_MODEL if it differs.
MODEL = os.environ.get("GEMINI_MODEL") or "gemini-3.8-flash"
_client: genai.Client | None = None


def gemini_client() -> genai.Client:
    """Create Gemini only when social-post parsing needs it."""
    global _client
    if _client is None:
        # Own retries here so SDK retries cannot multiply our backoff loop.
        _client = genai.Client(
            http_options={"timeout": 30_000, "retry_options": {"attempts": 1}}
        )  # reads GEMINI_API_KEY from the environment
    return _client


class ParsedEvent(BaseModel):
    title: str
    club: Optional[str]        # exact name from the known list, or the post's wording if new
    club_is_known: bool        # True only if club was copied from the known list
    location: Optional[str]    # exact name from the known list, or the post's wording if new
    location_is_known: bool
    starts_at: Optional[str]   # ISO 8601 with offset, e.g. 2026-10-14T18:00:00-04:00
    ends_at: Optional[str]


def known_names():
    """Club and location names already in the database from Highlander Hub."""
    with get_conn() as conn:
        clubs = [r["org_name"] for r in conn.execute(
            "SELECT DISTINCT org_name FROM events "
            "WHERE source = 'highlander_hub' AND org_name IS NOT NULL ORDER BY 1")]
        places = [r["location"] for r in conn.execute(
            "SELECT DISTINCT location FROM events "
            "WHERE source = 'highlander_hub' AND location IS NOT NULL ORDER BY 1")]
    return clubs, places


def parse_post(post_text: str, account_name: str, posted_at: datetime,
               clubs: list[str], places: list[str]) -> Optional[ParsedEvent]:
    """Returns a ParsedEvent, or None if Gemini's answer can't be used."""
    prompt = f"""You extract event details from a social media post by an NJIT student club.

KNOWN CLUBS (official names):
{chr(10).join(clubs)}

KNOWN LOCATIONS (official names):
{chr(10).join(places)}

Rules:
- club: if the posting account or the post refers to one of the KNOWN CLUBS
  (including abbreviations, nicknames, or handles), return that name copied
  exactly and set club_is_known true. Otherwise return the club name as written
  and set club_is_known false.
- location: same rule against KNOWN LOCATIONS. "CC" means Campus Center.
  Keep room or ballroom details only if the matching known name includes them.
- starts_at / ends_at: ISO 8601 in America/New_York with the UTC offset.
  Resolve relative dates ("this Friday") against the post date. Use null if
  the post gives no date or time. Never guess.
- title: the event's name, short, without emojis or hashtags.

Posting account: {account_name}
Post date: {posted_at.isoformat()}
Post text:
{post_text}
"""
    response = None
    for attempt in range(3):  # bounded retries for temporary server failures
        try:
            response = gemini_client().models.generate_content(
                model=MODEL,
                contents=prompt,
                config={
                    "response_mime_type": "application/json",
                    "response_schema": ParsedEvent,
                    "temperature": 0,
                },
            )
            break
        except errors.APIError as e:
            if e.code == 429:
                # Daily quota exhaustion cannot be fixed by a short backoff.
                # Stop the batch and leave its remaining posts pending.
                print(
                    "Gemini quota/rate limit reached (429); stopping ingestion. "
                    "Retry after the provider's stated delay or adjust the API quota.",
                    flush=True,
                )
                raise
            if e.code not in (500, 502, 503, 504) or attempt == 2:
                raise
            wait = 2 ** attempt * 2  # 2, 4 seconds
            print(f"Gemini busy ({e.code}); retrying in {wait}s...", flush=True)
            time.sleep(wait)
    event = response.parsed
    if event is None or event.starts_at is None:
        return None  # no usable start time -> can't be deduplicated or shown; skip it

    # Don't trust the model's "known" flags: check them ourselves.
    if event.club_is_known and event.club not in clubs:
        event.club_is_known = False
    if event.location_is_known and event.location not in places:
        event.location_is_known = False
    return event


if __name__ == "__main__":
    # Quick manual test: python normalize.py
    clubs, places = known_names()
    sample = "Join ACM this Fri 6pm in CC Ballroom A for our fall cleanup! Volunteers needed"
    print(parse_post(sample, "njit_acm", datetime.now().astimezone(), clubs, places))
