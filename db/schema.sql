CREATE TABLE IF NOT EXISTS people (
    id BIGSERIAL PRIMARY KEY,
    google_sub TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    display_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
    id BIGSERIAL PRIMARY KEY,
    source TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_url TEXT,
    title TEXT NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ,
    location TEXT,
    org_name TEXT,
    organizer_email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (source, source_id)
);

CREATE INDEX IF NOT EXISTS events_starts_at_idx ON events (starts_at);
CREATE INDEX IF NOT EXISTS events_source_idx ON events (source);
CREATE UNIQUE INDEX IF NOT EXISTS events_duplicate_key_idx ON events (
    lower(regexp_replace(coalesce(org_name, ''), '[^a-z0-9]+', '', 'g')),
    lower(regexp_replace(coalesce(location, ''), '[^a-z0-9]+', '', 'g')),
    starts_at
);

CREATE TABLE IF NOT EXISTS hour_entries (
    id BIGSERIAL PRIMARY KEY,
    person_id BIGINT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    hours NUMERIC(5, 2) NOT NULL CHECK (hours > 0 AND hours <= 24),
    task TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_by BIGINT REFERENCES people(id),
    reviewed_at TIMESTAMPTZ,
    UNIQUE (person_id, event_id)
);

CREATE INDEX IF NOT EXISTS hour_entries_status_idx ON hour_entries (status);
CREATE INDEX IF NOT EXISTS hour_entries_person_idx ON hour_entries (person_id);

CREATE TABLE IF NOT EXISTS verified_hours (
    id BIGSERIAL PRIMARY KEY,
    person_id BIGINT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    entry_id BIGINT NOT NULL UNIQUE REFERENCES hour_entries(id) ON DELETE CASCADE,
    hours NUMERIC(5, 2) NOT NULL CHECK (hours > 0 AND hours <= 24),
    verified_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS verified_hours_person_verified_at_idx
    ON verified_hours (person_id, verified_at);

CREATE OR REPLACE VIEW person_daily_hours AS
SELECT
    person_id,
    verified_at::date AS day,
    SUM(hours)::float8 AS hours
FROM verified_hours
GROUP BY person_id, verified_at::date;

CREATE TABLE IF NOT EXISTS semester_snapshots (
    id BIGSERIAL PRIMARY KEY,
    person_id BIGINT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    semester TEXT NOT NULL,
    total_hours NUMERIC(8, 2) NOT NULL DEFAULT 0,
    snapped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (person_id, semester)
);
