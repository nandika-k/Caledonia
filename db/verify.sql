SELECT 'people' AS table_name, COUNT(*) AS rows FROM people
UNION ALL
SELECT 'events', COUNT(*) FROM events
UNION ALL
SELECT 'hour_entries', COUNT(*) FROM hour_entries
UNION ALL
SELECT 'verified_hours', COUNT(*) FROM verified_hours
UNION ALL
SELECT 'semester_snapshots', COUNT(*) FROM semester_snapshots;
