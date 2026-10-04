import unittest
from datetime import datetime, timezone
from unittest.mock import call, patch

from ingest_discord import ingest_pending_discord


def post(message_id: str) -> dict:
    return {
        "message_id": message_id,
        "message_url": f"https://discord.com/channels/guild/channel/{message_id}",
        "guild_name": "Test server",
        "channel_name": "announcements",
        "text": "Volunteer event",
        "posted_at": datetime(2026, 10, 4, tzinfo=timezone.utc),
    }


class IngestPendingDiscordTests(unittest.TestCase):
    @patch("ingest_discord.mark_posts")
    @patch("ingest_discord.ingest_social")
    @patch("ingest_discord.pending_discord_posts")
    def test_marks_only_failing_post_failed_and_stops_batch(
        self, pending_posts, ingest_social, mark_posts
    ):
        pending_posts.return_value = [post("1"), post("2"), post("3")]
        ingest_social.side_effect = [
            {"added": 1, "duplicate": 0, "skipped": 0},
            RuntimeError("Gemini unavailable"),
        ]

        with self.assertRaisesRegex(RuntimeError, "Gemini unavailable"):
            ingest_pending_discord()

        self.assertEqual(ingest_social.call_count, 2)
        self.assertEqual(
            mark_posts.call_args_list,
            [call(["1"], "ingested"), call(["2"], "failed")],
        )

    @patch("ingest_discord.mark_posts")
    @patch("ingest_discord.ingest_social")
    @patch("ingest_discord.pending_discord_posts")
    def test_processes_and_marks_each_successful_post(
        self, pending_posts, ingest_social, mark_posts
    ):
        pending_posts.return_value = [post("1"), post("2")]
        ingest_social.side_effect = [
            {"added": 1, "duplicate": 0, "skipped": 0},
            {"added": 0, "duplicate": 1, "skipped": 0},
        ]

        result = ingest_pending_discord()

        self.assertEqual(
            result,
            {"processed": 2, "added": 1, "duplicate": 1, "skipped": 0, "failed": 0},
        )
        self.assertEqual(ingest_social.call_count, 2)
        self.assertEqual(
            mark_posts.call_args_list,
            [call(["1"], "ingested"), call(["2"], "ingested")],
        )


if __name__ == "__main__":
    unittest.main()
