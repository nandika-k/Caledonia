# Enchanted grove: population and growth plan

## Decisions so far
- One person becomes one tree.
- Each form response records an event name, hours for that event, and an optional task.
- Hours in a submission are added to that person's accumulated total.
- Tree height and canopy scale follow accumulated hours. The height cap remains configurable.
- Glow is standard for every tree. Flowers are a later visual feature.
- Planned stack: Flask + Python for form ingestion and grove data; React for the interactive display; Tiger Data for PostgreSQL storage.

## Step 1: define the records
Keep each submitted work entry as history, with a stable person key, event name, hours, optional task, and submission timestamp. The stable person key is the Google OpenID Connect `sub` claim, restricted to verified NJIT Workspace accounts (`hd` = `njit.edu`), and is needed to combine a person's submissions into one tree. The app's per-person `GroveRecord` is a derived aggregate (person key, display name, total hours), not a copy of a vendor's raw form schema.

## Step 2: store and aggregate submissions
Use Tiger Data as a PostgreSQL database. Store people separately from their timestamped hour entries. Flask validates incoming form records and inserts an entry; the grove API sums a person's entries to get total hours. Keep the original entries so event/task history and corrections remain possible. A time-partitioned table can be considered because entries have timestamps, but a normal PostgreSQL table is sufficient for a small project.

## Step 3: record semester growth
At each December and May boundary, save a snapshot per person with the cutoff date and cumulative hours. The difference between consecutive snapshots represents that semester's growth. Tree height can use current cumulative hours, while a React history view can show semester-by-semester growth. Make snapshot writes idempotent so rerunning a job does not create duplicates.

## Step 4: connect Flask and React
- Flask endpoints: receive/validate form entries; return current grove records; return a person's semester snapshots when requested.
- React fetches grove records and renders one tree per person. Map `GroveRecord.total_hours` through the configured height scale and use the same normalized progress for canopy scale.
- Keep form-provider-specific field mapping in one Flask adapter, separate from the grove calculations.

## Step 5: build and review in order
1. Confirm the form provider and stable person identifier.
2. Add the database schema and Flask database connection.
3. Add the form adapter and cumulative-hour query.
4. Add a scheduled May/December snapshot job and an admin/manual way to rerun a missed snapshot.
5. Connect the React scene to the grove API, then add flowers later.

## Open details
- Which field uniquely identifies a person (email, school ID, or another stable ID)? A name alone can collide or change.
- Does each submission always add new hours, including corrections? If corrections are needed, decide whether entries can be edited/deleted or use signed adjustments.
- Which local timezone/date defines the May and December semester cutoffs?
- Do trees show all-time cumulative hours (assumed here), with semester growth shown separately?
- What hours-to-height cap and visual style should the grove use?

## Upstream reference
The population, metric-to-size, stable layout, and rendering ideas were traced in Git City at commit `9aeead41abd258910b5d20b7240fc31fe0b2aee4`. Selected upstream files are in `reference/git-city` with its AGPL-3.0 license. The grove model is a small independent Python implementation in `grove.py`; it does not depend on the upstream app.

