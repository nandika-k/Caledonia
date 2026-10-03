"""Flask app with NJIT-only Google OpenID Connect sign-in."""

from __future__ import annotations

import os
import secrets
from datetime import timedelta

from authlib.integrations.flask_client import OAuth
from dotenv import load_dotenv
from flask import Flask, abort, jsonify, redirect, request, session, url_for

NJIT_DOMAIN = "njit.edu"
GOOGLE_DISCOVERY_URL = "https://accounts.google.com/.well-known/openid-configuration"
load_dotenv()


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

    oauth = OAuth(app)
    client_id = os.environ.get("GOOGLE_OAUTH_CLIENT_ID")
    client_secret = os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET")
    if client_id and client_secret:
        oauth.register(
            name="google",
            client_id=client_id,
            client_secret=client_secret,
            server_metadata_url=GOOGLE_DISCOVERY_URL,
            client_kwargs={"scope": "openid email profile"},
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
        return google_client().authorize_redirect(
            callback_url,
            hd=NJIT_DOMAIN,
            prompt="select_account",
        )

    @app.get("/auth/callback")
    def auth_callback():
        token = google_client().authorize_access_token()
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
        response = jsonify(
            {
                "authenticated": True,
                "user": user,
                "csrf_token": session["csrf_token"],
            }
        )
        response.headers["Cache-Control"] = "no-store"
        return response

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
