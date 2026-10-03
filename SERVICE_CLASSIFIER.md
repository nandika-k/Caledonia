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
Community service covers direct volunteering and charitable support, including food donation, soup kitchens, NJIT HOUSE, and clothing donation. Management is separate and covers running a club, organizing an event, or coordinating an organization. The classifier chooses based on the primary work described.

## Setup

1. Get a Gemini API key from Google AI Studio.
2. Add it as `GEMINI_API_KEY` in the server's private `.env` file. Do not put it in React code or commit it.
3. Install the project dependencies in the active virtual environment:

   ```powershell
   python -m pip install -r requirements.txt
   ```

## Use from Flask

```python
from service_classifier import classify_service_hours

category = classify_service_hours(
    event_name="Campus garden cleanup",
    description="Volunteers removed litter and cleared invasive plants.",
)
# category == "environmental"
```

The method uses Gemini structured output to constrain the answer to the category enum. Keep API calls on the Flask server. Gemini calls need network access and a valid API key; the classifier has not been exercised against a live Gemini account in this workspace.
