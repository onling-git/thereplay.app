# Followed fixtures data

The followed-fixtures page requests `current_season=true` on both
`GET /api/matches/by-teams?teams=<comma-separated IDs>` and `GET /api/favorites`.
This filters matches before returning them, using the provider season's start/end
dates, or its `is_current` flag when date boundaries are missing. Fixtures without
enough season metadata to identify a current season are excluded.

Current-season responses include all matching fixtures, rather than the default
50-item limit. The favourites endpoint joins saved entries to canonical match
records so scores, status, season details, badges and report availability remain
up to date. Each team includes `logo`, `team_slug` and `has_report`; report links
should only target a team with an available report.

Deploy these backend changes alongside the frontend update: the frontend relies
on the current-season filtering and enriched favourite data.