import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

from google.genai import errors

import normalize


class NormalizeRetryTests(unittest.TestCase):
    def parse(self):
        return normalize.parse_post(
            "Volunteer Friday", "club", datetime.now(timezone.utc), [], []
        )

    @patch("normalize.time.sleep")
    @patch("normalize.gemini_client")
    def test_daily_quota_stops_without_sleep_or_retry(self, client, sleep):
        error = errors.ClientError(429, {"error": {
            "message": "Daily quota exceeded. Please retry in 12h50m21s."
        }})
        generate = client.return_value.models.generate_content
        generate.side_effect = error
        with self.assertRaises(errors.ClientError):
            self.parse()
        self.assertEqual(generate.call_count, 1)
        sleep.assert_not_called()

    @patch("normalize.time.sleep")
    @patch("normalize.gemini_client")
    def test_server_error_recovers(self, client, sleep):
        generate = client.return_value.models.generate_content
        generate.side_effect = [
            errors.ServerError(503, {"error": {"message": "Busy"}}),
            SimpleNamespace(parsed=None),
        ]
        self.assertIsNone(self.parse())
        self.assertEqual(generate.call_count, 2)
        sleep.assert_called_once_with(5)

    @patch("normalize.time.sleep")
    @patch("normalize.gemini_client")
    def test_server_retries_are_bounded(self, client, sleep):
        generate = client.return_value.models.generate_content
        generate.side_effect = errors.ServerError(503, {"error": {"message": "Busy"}})
        with self.assertRaises(errors.ServerError):
            self.parse()
        self.assertEqual(generate.call_count, 5)
        self.assertEqual([c.args[0] for c in sleep.call_args_list], [5, 10, 20, 40])

    @patch("normalize._client", None)
    @patch("normalize.genai.Client")
    def test_client_limits_timeout_and_disables_nested_retries(self, client):
        normalize.gemini_client()
        normalize.gemini_client()
        client.assert_called_once_with(
            http_options={"timeout": 30_000, "retry_options": {"attempts": 1}}
        )


if __name__ == "__main__":
    unittest.main()
