"""Flask app with NJIT-only Google OpenID Connect sign-in."""

from __future__ import annotations

import os
import secrets
import math
from datetime import date, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

from authlib.integrations.flask_client import OAuth
from authlib.integrations.base_client.errors import OAuthError
from joserfc.errors import JoseError
from dotenv import load_dotenv
from flask import Flask, abort, g, jsonify, redirect, request, session, url_for
from requests.exceptions import RequestException

NJIT_DOMAIN = "njit.edu"
GOOGLE_DISCOVERY_URL = "https://accounts.google.com/.well-known/openid-configuration"
load_dotenv()


def json_ready(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value


def row_to_json(row: dict) -> dict:
    return {key: json_ready(value) for key, value in row.items()}


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.update(
        SECRET_KEY=os.environ.get("SECRET_KEY"),
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=os.environ.get("COOKIE_SECURE", "false").lower() == "true",
        PERMANENT_SESSION_LIFETIME=timedelta(hours=8),
    )
    if not app.config["SECRET_KEY"]:
        raise RuntimeError("Set SECRET_KEY before starting the app. See .env.example.")

    @app.before_request
    def identify_request():
        g.request_id = uuid4().hex

    @app.after_request
    def identify_response(response):
        response.headers["X-Request-ID"] = g.request_id
        return response

    def sign_in_failed(status: int, reason: str):
        # Never log the callback query, authorization code, or provider tokens.
        app.logger.warning("Google sign-in failed id=%s reason=%s", g.request_id, reason)
        response = app.make_response((
            "<!doctype html><title>Sign-in interrupted</title>"
            "<main><h1>Sign-in interrupted</h1>"
            "<p>Your sign-in could not be completed. Please start again.</p>"
            '<a href="/auth/login">Start sign-in again</a>'
            f"<p>Reference: {g.request_id}</p></main>", status
        ))
        response.headers["Cache-Control"] = "no-store"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response

    oauth = OAuth(app)
    client_id = os.environ.get("GOOGLE_OAUTH_CLIENT_ID")
    client_secret = os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET")
    if client_id and client_secret:
        oauth.register(
            name="google",
            client_id=client_id,
            client_secret=client_secret,
            server_metadata_url=GOOGLE_DISCOVERY_URL,
            client_kwargs={"scope": "openid email profile", "default_timeout": 10},
        )

    def google_client():
        client = oauth.create_client("google")
        if client is None:
            abort(503, description="Google sign-in is not configured. Set the Google OAuth credentials.")
        return client

    @app.get("/")
    def index():
        if session.get("user"):
            user = session["user"]
            return (
                "<!doctype html><title>Enchanted Grove</title>"
                f"<main><h1>Welcome, {user['name'] or user['email']}</h1>"
                "<p>You are signed in with an NJIT Google account.</p>"
                '<a href="/api/me">View sign-in status</a></main>'
            )
        return (
            "<!doctype html><title>Enchanted Grove</title>"
            "<main><h1>Enchanted Grove</h1>"
            '<p>Sign in with your NJIT Google account to enter the grove.</p>'
            '<a href="/auth/login">Sign in with Google</a></main>'
        )

    @app.get("/auth/login")
    def login():
        callback_url = os.environ.get(
            "OAUTH_REDIRECT_URI", url_for("auth_callback", _external=True)
        )
        # `hd` filters the account chooser. The callback independently checks
        # the signed ID token claim, which is the actual access restriction.
        try:
            return google_client().authorize_redirect(
                callback_url,
                hd=NJIT_DOMAIN,
                prompt="select_account",
            )
        except RequestException as error:
            return sign_in_failed(503, type(error).__name__)

    @app.get("/auth/callback")
    def auth_callback():
        try:
            token = google_client().authorize_access_token(timeout=10)
        except (OAuthError, JoseError) as error:
            # State/nonce/signature checks remain enforced. Never accept an
            # unverified identity just because a callback failed.
            return sign_in_failed(400, type(error).__name__)
        except RequestException as error:
            return sign_in_failed(503, type(error).__name__)
        claims = token.get("userinfo")
        if not claims:
            abort(401, description="Google did not return verified sign-in information.")
        if claims.get("hd") != NJIT_DOMAIN:
            session.clear()
            abort(403, description="Use an NJIT Google Workspace account to sign in.")
        if not claims.get("sub") or not claims.get("email"):
            abort(401, description="Google did not return the required account information.")
        if claims.get("email_verified") is not True:
            abort(403, description="The Google account email must be verified.")

        session.clear()
        session.permanent = True
        session["user"] = {
            "google_sub": claims["sub"],
            "email": claims["email"],
            "name": claims.get("name"),
            "picture": claims.get("picture"),
        }
        session["csrf_token"] = secrets.token_urlsafe(32)
        return redirect(os.environ.get("FRONTEND_URL", url_for("index")))

    @app.get("/api/me")
    def me():
        user = session.get("user")
        if not user:
            return jsonify({"authenticated": False}), 401
        if not session.get("csrf_token"):
            session["csrf_token"] = secrets.token_urlsafe(32)
        response = jsonify(
            {
                "authenticated": True,
                "user": user,
                "csrf_token": session["csrf_token"],
            }
        )
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.get("/api/opportunities")
    def opportunities():
        try:
            limit = min(max(int(request.args.get("limit", "100")), 1), 200)
        except ValueError:
            return jsonify({"error": "limit must be a number."}), 400

        try:
            from hours import list_events

            rows = list_events(upcoming_only=True)
        except Exception:
            app.logger.exception("Could not load opportunities")
            return jsonify({"error": "Could not load opportunities."}), 502

        return jsonify({"opportunities": [row_to_json(dict(row)) for row in rows[:limit]]})

    @app.post("/api/classify-service")
    def classify_service():
        if not session.get("user"):
            return jsonify({"error": "Sign in with an NJIT Google account first."}), 401
        provided_token = request.headers.get("X-CSRF-Token", "")
        if not secrets.compare_digest(provided_token, session.get("csrf_token", "")):
            return jsonify({"error": "A valid CSRF token is required."}), 403

        payload = request.get_json(silent=True) or {}
        if not isinstance(payload, dict):
            return jsonify({"error": "Send Event Name and Description as JSON fields."}), 400
        event_name = payload.get("event_name")
        description = payload.get("description")
        if not isinstance(event_name, str) or not event_name.strip():
            return jsonify({"error": "Event Name is required."}), 400
        if not isinstance(description, str) or not description.strip():
            return jsonify({"error": "Description is required."}), 400
        if len(event_name) > 200 or len(description) > 4000:
            return jsonify({"error": "Event Name or Description is too long."}), 400

        try:
            from service_classifier import classify_service_hours

            category = classify_service_hours(event_name.strip(), description.strip())
        except Exception:
            app.logger.exception("Gemini service classification failed")
            return jsonify({"error": "Could not classify this activity. Please try again."}), 502
        return jsonify({"category": category})

    @app.post("/api/activities")
    def create_activity():
        """Validate and classify a form submission for the signed-in volunteer.

        Persistence is intentionally left to the Tiger Data integration. The
        frontend currently stores the returned activity in browser storage.
        """
        user = session.get("user")
        if not user:
            return jsonify({"error": "Sign in with an NJIT Google account first."}), 401
        provided_token = request.headers.get("X-CSRF-Token", "")
        if not secrets.compare_digest(provided_token, session.get("csrf_token", "")):
            return jsonify({"error": "A valid CSRF token is required."}), 403

        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"error": "Send the activity form as a JSON object."}), 400

        event_name = payload.get("event_name")
        description = payload.get("description")
        hours = payload.get("hours")
        internal_external = payload.get("internal_external")
        contact_email = payload.get("contact_email")
        org_person_name = payload.get("org_person_name")
        activity_date = payload.get("date")

        if not isinstance(event_name, str) or not event_name.strip() or len(event_name) > 200:
            return jsonify({"error": "Event Name is required and must be at most 200 characters."}), 400
        if not isinstance(description, str) or not description.strip() or len(description) > 4000:
            return jsonify({"error": "Description is required and must be at most 4000 characters."}), 400
        if isinstance(hours, bool) or not isinstance(hours, (int, float)) or not math.isfinite(hours) or not 0 < hours <= 24:
            return jsonify({"error": "Hours Served must be greater than 0 and no more than 24."}), 400
        if internal_external not in ("internal", "external"):
            return jsonify({"error": "Choose Internal or External."}), 400
        if not isinstance(contact_email, str) or not contact_email.strip() or len(contact_email) > 320:
            return jsonify({"error": "A valid Contact Email is required."}), 400
        if not isinstance(org_person_name, str) or not org_person_name.strip() or len(org_person_name) > 200:
            return jsonify({"error": "Org/Person Name is required and must be at most 200 characters."}), 400
        try:
            normalized_date = date.fromisoformat(activity_date).isoformat() if isinstance(activity_date, str) else date.today().isoformat()
        except ValueError:
            return jsonify({"error": "Date must use YYYY-MM-DD format."}), 400

        try:
            from service_classifier import classify_service_hours

            category = classify_service_hours(event_name.strip(), description.strip())
        except Exception:
            app.logger.exception("Gemini service classification failed")
            return jsonify({"error": "Could not classify this activity. Please try again."}), 502

        return jsonify(
            {
                "activity": {
                    "id": str(uuid4()),
                    "userId": user["google_sub"],
                    "eventName": event_name.strip(),
                    "description": description.strip(),
                    "hours": round(float(hours), 1),
                    "activityType": category,
                    "internalExternal": internal_external,
                    "contactEmail": contact_email.strip(),
                    "orgPersonName": org_person_name.strip(),
                    "date": normalized_date,
                }
            }
        ), 201

    @app.post("/auth/logout")
    def logout():
        if not session.get("user"):
            return "", 204
        provided_token = request.headers.get("X-CSRF-Token", "")
        if not secrets.compare_digest(provided_token, session.get("csrf_token", "")):
            abort(403, description="A valid CSRF token is required to sign out.")
        session.clear()
        return "", 204

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", "5000")), debug=False)
