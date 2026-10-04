"""Load scraper JSON files into the events table."""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any

from ingest import ingest_hub, ingest_social


def load_json(path: Path) -> list[dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError(f"{path} must contain a JSON list.")
    return data


def normalize_social_posts(posts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized = []
    for post in posts:
        copy = dict(post)
        posted_at = copy.get("posted_at")
        if isinstance(posted_at, str):
            copy["posted_at"] = datetime.fromisoformat(posted_at)
        normalized.append(copy)
    return normalized


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("hub_events_json", type=Path)
    parser.add_argument("social_posts_json", type=Path, nargs="?")
    args = parser.parse_args()

    hub_events = load_json(args.hub_events_json)
    added = ingest_hub(hub_events)
    print(f"Hub events added: {added}")

    if args.social_posts_json:
        social_posts = normalize_social_posts(load_json(args.social_posts_json))
        counts = ingest_social(social_posts)
        print(f"Social posts: {counts}")


if __name__ == "__main__":
    main()
