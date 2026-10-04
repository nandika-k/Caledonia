"""Scrape current NJIT Engage volunteering opportunities."""

from __future__ import annotations

import re
import time
from datetime import datetime, timezone
from urllib.parse import urlencode

import requests
from bs4 import BeautifulSoup

API_BASE = "https://njit.campuslabs.com/engage/api/discovery/event/search"
EVENT_PAGE_BASE = "https://njit.campuslabs.com/engage/event"
VOLUNTEERING_CATEGORY_ID = "20748"

HEADERS = {
    "Accept": "application/json",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
}


def clean_html(html: str | None) -> str:
    """Convert CampusLabs HTML descriptions into readable plain text."""
    if not html:
        return ""
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(" ", strip=True)
    return re.sub(r"\s+", " ", text).strip()


def parse_event_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def event_url(event_id: str | int | None) -> str | None:
    if not event_id:
        return None
    return f"{EVENT_PAGE_BASE}/{event_id}"


def is_current_or_upcoming(item: dict, now_utc: datetime | None = None) -> bool:
    """Keep approved events that have not ended yet."""
    if item.get("status") != "Approved":
        return False

    now_utc = now_utc or datetime.now(timezone.utc)
    ends_on = parse_event_datetime(item.get("endsOn"))
    starts_on = parse_event_datetime(item.get("startsOn"))
    if ends_on is not None:
        return ends_on >= now_utc
    return starts_on is not None and starts_on >= now_utc


def normalize_event(item: dict) -> dict:
    """Return app-facing fields for one NJIT Engage event."""
    event_id = str(item.get("id", "")).strip()
    return {
        "source": "njit_engage",
        "event_id": event_id,
        "title": item.get("name") or "",
        "organization_name": item.get("organizationName") or "",
        "organization_id": item.get("organizationId"),
        "location": item.get("location") or "",
        "starts_on": item.get("startsOn"),
        "ends_on": item.get("endsOn"),
        "description": clean_html(item.get("description")),
        "event_url": event_url(event_id),
    }


def fetch_volunteering_events(take: int = 100, max_pages: int = 20) -> list[dict]:
    """Fetch current/upcoming NJIT Engage events tagged as Volunteering."""
    events = []
    seen_ids = set()
    skip = 0
    now_utc = datetime.now(timezone.utc)

    for page in range(max_pages):
        params = {
            "take": take,
            "skip": skip,
            "categoryIds": VOLUNTEERING_CATEGORY_ID,
            "endsAfter": now_utc.isoformat(),
            "forceOrderBy": "true",
            "orderByField": "StartsOn",
            "orderByDirection": "ascending",
        }
        response = requests.get(
            f"{API_BASE}?{urlencode(params)}",
            headers=HEADERS,
            timeout=20,
        )
        response.raise_for_status()
        items = response.json().get("value", [])

        if not items:
            break

        for item in items:
            event_id = str(item.get("id", "")).strip()
            if not event_id or event_id in seen_ids or not is_current_or_upcoming(item, now_utc):
                continue
            seen_ids.add(event_id)
            events.append(normalize_event(item))

        if len(items) < take:
            break

        skip += take
        time.sleep(0.25)

    return events
