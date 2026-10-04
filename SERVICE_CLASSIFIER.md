# Service classification

Both `POST /api/classify-service` and `POST /api/activities` use `classify_service_hours` in `service_classifier.py`. Both require NJIT Google sign-in, the session CSRF token, and valid event name and description fields.

Categories: `research`, `tutoring`, `environmental`, `community service`, `management`, and `miscellaneous`.

Clear activity terms are classified locally without a provider request. For example, `tutoring` / `tutoring for SAT` returns `tutoring`. Rules use word boundaries; mixed category matches are left to Gemini to choose the primary work. These are keyword heuristics, not a full language parser.

Ambiguous activities use Gemini structured output when `GEMINI_API_KEY` or `GOOGLE_API_KEY` is configured on the server. `GEMINI_MODEL` overrides the default model. Requests use a 10-second HTTP timeout and one attempt. Keep credentials on the server, never in React.

Missing credentials, API/network errors, empty responses, and invalid structured output return `miscellaneous` and log a server warning. This fallback lets hours submission continue; it is not a successful AI classification. Blank inputs still fail validation.

Run offline tests:

```powershell
.\.venv312\Scripts\python.exe -m unittest test_service_classifier
```

The frontend saves returned activities in local demo storage. Classification does not add database persistence or verify volunteer hours. Live Gemini behavior has not been verified in this workspace.
