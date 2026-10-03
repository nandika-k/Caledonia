# Gemini service classifier

The Flask endpoint `POST /api/classify-service` requires an NJIT Google sign-in and the session's CSRF token. It accepts an event name and description, calls `classify_service_hours` in `service_classifier.py`, and returns one category:

- `research`
- `tutoring`
- `environmental`
- `community service`
- `management`

Community service includes food donation, soup kitchens, NJIT HOUSE, and clothing donation. Management covers running a club or organizing an event. The classifier chooses based on the primary work described.

Set `GEMINI_API_KEY` in the private server `.env` file. Install the Python dependencies from the repository root with `python -m pip install -r requirements.txt`. Keep the key on Flask; do not put it in React code.

The React Add Hours form calls the Flask endpoint before saving its local preview activity. The endpoint needs Google sign-in and Gemini credentials to respond. The frontend's activity storage remains local demo storage; Tiger Data persistence is not connected yet.
