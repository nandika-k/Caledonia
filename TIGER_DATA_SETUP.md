# Tiger Data setup handoff

This is for the teammate setting up the database. The app uses Flask + React. Google sign-in identifies NJIT users; Tiger Data stores their accounts, hour entries, and semester snapshots. React must never connect directly to Tiger Data.

## 1. Create the database

Create a Tiger Cloud PostgreSQL service. Send the app developer the hostname, port, database name, username, and password through a private channel. Require TLS (`sslmode=require`). Do not put credentials in GitHub, frontend code, screenshots, or chat messages.

The app developer will configure these server-side environment variables:

```text
PGHOST=
PGPORT=
PGDATABASE=
PGUSER=
PGPASSWORD=
PGSSLMODE=require
```

Flask connects with a PostgreSQL driver such as psycopg. Tiger Data is PostgreSQL-compatible; this small app can start with ordinary tables and does not need a time-series hypertable.

## 2. Create the tables

Run this SQL in Tiger Cloud's SQL editor:

```sql
CREATE TABLE people (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    google_sub TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    display_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE hour_entries (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    person_id BIGINT NOT NULL REFERENCES people(id),
    event_name TEXT NOT NULL,
    hours NUMERIC(8, 2) NOT NULL CHECK (hours > 0),
    task TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX hour_entries_person_time_idx
    ON hour_entries (person_id, submitted_at DESC);

CREATE TABLE semester_snapshots (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    person_id BIGINT NOT NULL REFERENCES people(id),
    term_label TEXT NOT NULL,
    cutoff_date DATE NOT NULL,
    total_hours NUMERIC(10, 2) NOT NULL CHECK (total_hours >= 0),
    captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (person_id, term_label)
);
```

`google_sub` is the stable Google account ID and links a person to their tree. `hour_entries` preserves each event submission. The current tree total is `SUM(hour_entries.hours)` for that person. A semester snapshot stores that cumulative total at the term cutoff; the difference from the prior snapshot is the term's growth.

## 3. Check setup

After running the SQL, verify that all three tables exist. Share the connection details privately and tell the app developer that TLS is required. Do not create or share a public database credential; the Flask server uses the app's database user.

## 4. NJIT sign-in note

Google sign-in is configured in the app's Google Cloud OAuth settings, not in Tiger Data. Flask must verify the Google ID token and accept it only when the signed token's hosted-domain claim is exactly `njit.edu`. The Google sign-in screen can use `hd=njit.edu` as a hint, but the server-side claim check enforces access. Use the token's `sub` claim for `people.google_sub`, not email as the account key.

## Decisions already made

- One tree per Google account.
- Each event submission adds hours to the account's total.
- Event name is required; task is optional.
- Height and canopy grow with accumulated total hours; glow is standard; flowers come later.
- Snapshot each person's cumulative total at the December and May semester cutoffs.
