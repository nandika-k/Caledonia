"""Continuously scrape NJIT Engage volunteering events into the events table."""

from __future__ import annotations

import argparse
import os
import time
from pathlib import Path

from dotenv import load_dotenv

from ingest import ingest_hub
from opportunities_scraper import fetch_volunteering_events, write_events_json

load_dotenv()


def sync_once(write_json: bool = True) -> int:
    events = fetch_volunteering_events()
    if write_json:
        write_events_json(Path("data/hub_events.json"), events)
    added = ingest_hub(events)
    print(f"Scraped {len(events)} current/upcoming volunteering events; added {added} new rows.")
    return added


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--forever", action="store_true")
    parser.add_argument(
        "--interval-seconds",
        type=int,
        default=int(os.environ.get("OPPORTUNITY_SYNC_INTERVAL_SECONDS", "900")),
    )
    parser.add_argument("--no-json", action="store_true")
    args = parser.parse_args()

    if not args.forever:
        sync_once(write_json=not args.no_json)
        return

    while True:
        try:
            sync_once(write_json=not args.no_json)
        except Exception as error:
            print(f"Opportunity sync failed: {error}", flush=True)
        time.sleep(args.interval_seconds)


if __name__ == "__main__":
    main()
