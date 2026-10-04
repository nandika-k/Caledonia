import os
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

import httpx
from google.genai import errors
from service_classifier import classify_service_hours, local_category


class ServiceClassifierTests(unittest.TestCase):
    def test_sat_tutoring_needs_no_provider(self):
        with patch("service_classifier.genai.Client") as factory:
            self.assertEqual(classify_service_hours("tutoring", "tutoring for SAT"), "tutoring")
            factory.assert_not_called()

    def test_local_categories_and_ambiguity(self):
        for text, expected in [("gardening", "environmental"), ("data collection", "research"), ("soup kitchen", "community service"), ("running a club", "management"), ("researcher biography", None), ("tutoring and event planning", None)]:
            with self.subTest(text=text):
                self.assertEqual(local_category("Activity", text), expected)

    def test_gemini_output_and_request_limits(self):
        client = Mock()
        client.models.generate_content.return_value = SimpleNamespace(parsed={"category": "community service"}, text=None)
        self.assertEqual(classify_service_hours("Helping", "Supported neighbors", client=client), "community service")
        config = client.models.generate_content.call_args.kwargs["config"]
        self.assertEqual(config.http_options.timeout, 10_000)
        self.assertEqual(config.http_options.retry_options.attempts, 1)

    def test_failures_do_not_block_hours(self):
        for outcome in [errors.ClientError(429, {"error": {"message": "Quota exceeded"}}), errors.ServerError(503, {"error": {"message": "Busy"}}), httpx.ReadTimeout("Timed out"), SimpleNamespace(parsed=None, text=""), SimpleNamespace(parsed=None, text='{"category":"invalid"}'), SimpleNamespace(parsed=None, text="not JSON")]:
            with self.subTest(outcome=outcome):
                client = Mock()
                if isinstance(outcome, Exception):
                    client.models.generate_content.side_effect = outcome
                else:
                    client.models.generate_content.return_value = outcome
                with self.assertLogs("service_classifier", level="WARNING"):
                    self.assertEqual(classify_service_hours("Helping", "Supported neighbors", client=client), "miscellaneous")
                self.assertEqual(client.models.generate_content.call_count, 1)

    @patch.dict(os.environ, {}, clear=True)
    def test_missing_credentials(self):
        with self.assertLogs("service_classifier", level="WARNING"):
            self.assertEqual(classify_service_hours("Helping", "Supported neighbors"), "miscellaneous")

    def test_json_response(self):
        client = Mock()
        client.models.generate_content.return_value = SimpleNamespace(parsed=None, text='{"category":"management"}')
        self.assertEqual(classify_service_hours("Helping", "Supported neighbors", client=client), "management")

    def test_blank_inputs(self):
        for name, description in [("", "something"), ("event", " ")]:
            with self.assertRaises(ValueError):
                classify_service_hours(name, description)


if __name__ == "__main__":
    unittest.main()
