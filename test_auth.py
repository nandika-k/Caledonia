import unittest
from unittest.mock import Mock, patch
from urllib.parse import parse_qs, urlsplit

from authlib.integrations.base_client.errors import MismatchingStateError, OAuthError
from requests.exceptions import Timeout
from joserfc.errors import JoseError

from app import create_app


class SignInTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict("os.environ", {"SECRET_KEY": "test-secret", "COOKIE_SECURE": "false", "OAUTH_REDIRECT_URI": "http://localhost/auth/callback"})
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

    @patch.dict("os.environ", {"OAUTH_REDIRECT_URI": "https://caledonia.garden/auth/callback"})
    def test_other_hostname_redirects_before_creating_state(self):
        with patch("app.OAuth.create_client") as provider:
            response = self.client.get("/auth/login", base_url="https://example.azurewebsites.net")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.location, "https://caledonia.garden/auth/login")
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        provider.assert_not_called()

    def test_real_authlib_state_cookie_round_trip_and_replay(self):
        oauth = self.app.extensions["authlib.integrations.flask_client"]
        oauth.register("google", overwrite=True, client_id="test-client", client_secret="test-secret",
                       authorize_url="https://accounts.google.com/o/oauth2/auth",
                       access_token_url="https://oauth2.googleapis.com/token",
                       client_kwargs={"scope": "openid email profile"})
        google = oauth.create_client("google")
        with patch.object(google, "load_server_metadata", return_value={"authorization_endpoint": "https://accounts.google.com/o/oauth2/auth"}):
            response = self.client.get("/auth/login")
        state = parse_qs(urlsplit(response.location).query)["state"][0]
        with self.client.session_transaction() as current:
            self.assertIn(f"_state_google_{state}", current)
        token = {"userinfo": {"sub": "test-user", "email": "test@njit.edu", "hd": "njit.edu", "email_verified": True}}
        with patch.object(google, "fetch_access_token", return_value=token) as exchange:
            response = self.client.get("/auth/callback", query_string={"state": state, "code": "test-code"})
            self.assertEqual(response.status_code, 302)
            with self.assertLogs(self.app.logger, level="WARNING"):
                replay = self.client.get("/auth/callback", query_string={"state": state, "code": "test-code"})
            self.assertEqual(replay.status_code, 400)
            self.assertEqual(exchange.call_count, 1)


if __name__ == "__main__":
    unittest.main()
