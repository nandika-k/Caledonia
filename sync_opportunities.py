"""Sync NJIT Engage volunteering opportunities into Postgres.

Run once:
    python sync_opportunities.py

Run forever:
    python sync_opportunities.py --forever
"""

from __future__ import annotations

import argparse
import os
import time

from dotenv import load_dotenv

from opportunities_scraper import fetch_volunteering_events
from opportunities_store import init_opportunities_table, upsert_opportunities

load_dotenv()


def sync_once() -> int:
    init_opportunities_table()
    events = fetch_volunteering_events()
    saved_count = upsert_opportunities(events)
    print(f"Synced {saved_count} current/upcoming volunteering opportunities.")
    return saved_count


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--forever",
        action="store_true",
        help="Keep syncing on an interval for always-on worker deployments.",
    )
    parser.add_argument(
        "--interval-seconds",
        type=int,
        default=int(os.environ.get("OPPORTUNITY_SYNC_INTERVAL_SECONDS", "900")),
        help="Seconds between syncs when --forever is set.",
    )
    args = parser.parse_args()

    if not args.forever:
        sync_once()
        return

    while True:
        try:
            sync_once()
        except Exception as error:
            print(f"Opportunity sync failed: {error}", flush=True)
        time.sleep(args.interval_seconds)


if __name__ == "__main__":
    main()
