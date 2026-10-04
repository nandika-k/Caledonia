import unittest
from unittest.mock import Mock, patch

from authlib.integrations.base_client.errors import MismatchingStateError, OAuthError
from requests.exceptions import Timeout
from joserfc.errors import JoseError

from app import create_app


class SignInTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict("os.environ", {"SECRET_KEY": "test-secret", "COOKIE_SECURE": "false"})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()

    def test_expired_or_replayed_callback_has_retry_link(self):
        provider = Mock()
        provider.authorize_access_token.side_effect = MismatchingStateError()
        with patch("app.OAuth.create_client", return_value=provider):
            with self.assertLogs(self.app.logger, level="WARNING") as logs:
                response = self.client.get("/auth/callback?code=private-code&state=old-state")
        self.assertEqual(response.status_code, 400)
        self.assertIn(b'Start sign-in again', response.data)
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        self.assertIn(response.headers["X-Request-ID"], " ".join(logs.output))
        self.assertNotIn("private-code", " ".join(logs.output))

    def test_provider_timeout_returns_503(self):
        provider = Mock()
        provider.authorize_access_token.side_effect = Timeout()
        with patch("app.OAuth.create_client", return_value=provider):
            with self.assertLogs(self.app.logger, level="WARNING"):
                response = self.client.get("/auth/callback")
        self.assertEqual(response.status_code, 503)
        provider.authorize_access_token.assert_called_once_with(timeout=10)
        with self.client.session_transaction() as current:
            self.assertNotIn("user", current)

    def test_denied_consent_does_not_create_session(self):
        provider = Mock()
        provider.authorize_access_token.side_effect = OAuthError(error="access_denied")
        with patch("app.OAuth.create_client", return_value=provider):
            with self.assertLogs(self.app.logger, level="WARNING"):
                response = self.client.get("/auth/callback")
        self.assertEqual(response.status_code, 400)

    def test_invalid_identity_token_is_rejected(self):
        provider = Mock()
        provider.authorize_access_token.side_effect = JoseError()
        with patch("app.OAuth.create_client", return_value=provider):
            with self.assertLogs(self.app.logger, level="WARNING"):
                response = self.client.get("/auth/callback")
        self.assertEqual(response.status_code, 400)
        with self.client.session_transaction() as current:
            self.assertNotIn("user", current)

    def test_verified_njit_sign_in_still_succeeds(self):
        provider = Mock()
        provider.authorize_access_token.return_value = {"userinfo": {
            "sub": "test-user", "email": "test@njit.edu", "hd": "njit.edu", "email_verified": True
        }}
        with patch("app.OAuth.create_client", return_value=provider):
            response = self.client.get("/auth/callback")
        self.assertEqual(response.status_code, 302)
        self.assertTrue(self.client.get("/api/me").json["csrf_token"])

    def test_non_njit_account_still_rejected(self):
        provider = Mock()
        provider.authorize_access_token.return_value = {"userinfo": {
            "sub": "test-user", "email": "test@example.com", "hd": "example.com", "email_verified": True
        }}
        with patch("app.OAuth.create_client", return_value=provider):
            self.assertEqual(self.client.get("/auth/callback").status_code, 403)

    def test_stale_signed_in_session_gets_csrf_token(self):
        with self.client.session_transaction() as current:
            current["user"] = {"google_sub": "test-user"}
        response = self.client.get("/api/me")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json["csrf_token"])


if __name__ == "__main__":
    unittest.main()
