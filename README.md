# Volunteer hours backend

Database, event ingestion, and hours logic for our GirlHacks 2026 project. Students find volunteer events, log hours, and an organizer approves them. Approved hours grow the student's tree.

- **Database:** Tiger Data (PostgreSQL) on Tiger Cloud
- **AI:** Gemini, used to clean up club names, locations, and times from social posts
- **Language:** Python

## Setup

1. Clone the repo and create a virtual environment.
   ```powershell
   python -m venv .venv
   .venv\Scripts\activate
   pip install -r requirements.txt
   ```
2. Copy `.env.example` to a new file named exactly `.env` (no `.txt`) in the repo root.
3. Fill in `.env`. Get the database values and password from the database owner in person or through a password manager. Create your own Gemini key at aistudio.google.com.

| Variable | What it is |
|---|---|
| `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` | Tiger Cloud connection details |
| `PGSSLMODE` | Always `require` |
| `GEMINI_API_KEY` | Your Gemini key |
| `GEMINI_MODEL` | `gemini-3.8-flash` |
| `DATABASE_URL` | Same database as one string, used only by the Discord bot: `postgresql://USER:PASSWORD@HOST:PORT/tsdb?sslmode=require` |
| `DISCORD_TOKEN` | Discord bot token, needed only to run the bot |

4. Check your connection. This is safe to run any time and cleans up after itself.
   ```powershell
   python test_flow.py
   ```
   You should see `11/11 checks passed`.

The database tables already exist. **Do not run `db/schema.sql` again.**

## Rules for secrets

- `.env` is never committed. It is listed in `.gitignore`; check `git status` before every commit.
- No credentials in GitHub, frontend code, screenshots, or chat.
- If a password or key leaks, tell the team right away so it can be reset.

## How it works

**Events coming in**

1. Highlander Hub events are loaded first. They carry the official club names, locations, and organizer emails.
2. The Discord bot saves likely volunteer posts into its own `opportunities` table.
3. `ingest_discord.py` sends each post to Gemini, which extracts the title and start time and maps the club and location onto the official Highlander Hub names.
4. The cleaned event is inserted into `events`. The database rejects it if an event with the same club, location, and start time already exists.

**Hours going onto a tree**

1. A student signs in with Google and gets a row in `people`.
2. The student submits hours for an event. The entry is `pending` and does not count yet.
3. The organizer (the person whose email matches the event's `organizer_email`) approves or rejects it.
4. On approval the hours are written to `verified_hours`, and the tree total updates immediately.

## Files

| File | Purpose |
|---|---|
| `db.py` | Opens database connections. Everything else imports `get_conn` from here. |
| `hours.py` | Functions the Flask app calls (see below). |
| `normalize.py` | The Gemini step: turns a raw post into a clean event. |
| `ingest.py` | Inserts events into the database. |
| `ingest_discord.py` | Moves the Discord bot's collected posts into `events`. |
| `run_ingest.py` | Loads the scraper's JSON files. |
| `run_sql.py` | Runs a `.sql` file and prints the results. |
| `test_flow.py` | End-to-end check of the hours loop. |
| `db/schema.sql` | Creates all tables. Already run. |
| `db/verify.sql` | Confirms the tables exist. |
| `db/snapshot.sql` | Semester snapshot, run at the December and May cutoffs. |

## Tables

| Table | One row is |
|---|---|
| `people` | One Google account, which is one tree. Keyed on `google_sub`. |
| `events` | One volunteer event. |
| `hour_entries` | One student's submission for one event: `pending`, `verified`, or `rejected`. |
| `verified_hours` | One approved submission. A Tiger Data hypertable. |
| `person_daily_hours` | One person's verified hours for one day. A continuous aggregate; trees read this. |
| `semester_snapshots` | One person's running total at a semester cutoff. |
| `opportunities`, `monitored_channels` | The Discord bot's own tables. |

## For the Flask developer

Import `hours` and call these. None of them know about HTTP or Google; verify the Google ID token and the `njit.edu` hosted-domain claim before calling `upsert_person`.

| Function | Use |
|---|---|
| `upsert_person(google_sub, email, display_name)` | At sign-in. Returns the person's `id`. Pass the token's `sub` claim, not the email, as `google_sub`. |
| `list_events(upcoming_only=False)` | Event list for the feed. |
| `submit_hours(person_id, event_id, hours, task)` | Creates a pending entry. Returns `None` if this person already logged this event. |
| `my_entries(person_id)` | A student's submissions and their status. |
| `pending_for_organizer(reviewer_id)` | Entries waiting on the signed-in organizer. |
| `approve(entry_id, reviewer_id)` | Returns `True` on success, `False` if the entry was already reviewed or the reviewer isn't that event's organizer. |
| `reject(entry_id, reviewer_id)` | Same return values as `approve`. |
| `grove()` | Every person with `total_hours`, for drawing all trees. |
| `tree_total(person_id)` | One person's verified total. |
| `daily_hours(person_id)` | Hours per day, for a growth chart. |

## For the scraper developer

Produce JSON, not CSV. Every key must be present; use `null` for missing values. Times must include the UTC offset (`-04:00` until November 1, then `-05:00`).

`hub_events.json`:

```json
[
  {
    "source_id": "9876543",
    "source_url": "https://...",
    "title": "Fall Campus Cleanup",
    "starts_at": "2026-10-16T18:00:00-04:00",
    "ends_at": "2026-10-16T20:00:00-04:00",
    "location": "Campus Center Ballroom A",
    "org_name": "Association for Computing Machinery",
    "organizer_email": "someone@njit.edu"
  }
]
```

`social_posts.json` (optional, for posts not collected by the Discord bot):

```json
[
  {
    "post_id": "abc123",
    "url": "https://...",
    "account": "njit_acm",
    "text": "ACM cleanup this Friday 6pm, CC Ballroom A! Volunteers needed",
    "posted_at": "2026-10-12T12:00:00-04:00"
  }
]
```

## Loading events

Always load Highlander Hub first.

```powershell
python run_ingest.py data/hub_events.json
python run_ingest.py data/hub_events.json data/social_posts.json
python ingest_discord.py
```

- The first form loads Highlander Hub only; the second also loads a social posts file.
- `ingest_discord.py` processes whatever the Discord bot has collected since the last run. It prints counts of `ingested`, `duplicate`, `no_date`, and `failed`.
- All three are safe to re-run. Duplicates are skipped.

## Discord bot

The bot needs `DISCORD_TOKEN` and `DATABASE_URL` in `.env`. It only collects while it is running. In a server, a moderator runs `/watch_here` in an announcement channel, and `/scan_recent` to pick up older messages.

## Known limits

- **Events without an organizer email can't be approved.** Discord posts get an email only when Gemini matches the club to one on Highlander Hub.
- **Duplicate detection needs matching names.** It catches the same club, location, and start time after ignoring case and punctuation. Gemini handles abbreviations, but it can miss.
- **Posts with no date or time are skipped.**
- **Gemini can be busy.** `normalize.py` retries automatically and prints "Gemini busy" while it waits.

## Troubleshooting

| Problem | Likely cause |
|---|---|
| Connection error or "password authentication failed" | A typo in `.env`, or the file is named `.env.txt`. |
| `404 ... model is no longer available` | `GEMINI_MODEL` is out of date. The error message names the replacement. |
| `503 UNAVAILABLE` from Gemini | Google is overloaded. Wait and rerun. |
| `relation "opportunities" does not exist` | The Discord bot hasn't been run against this database yet. |
| A social post is `added` when it should be `duplicate` | Gemini returned a different club, location, or time than the Highlander Hub row. Run `python normalize.py` to see its output. |
