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

## Coverage release checks

Deploy to the `staging` branch before promoting to `main`. Railway watch paths
can skip empty retry commits, so verify the deployment record rather than
assuming that a successful Git push started a backend build.

After initializing launch coverage, `GET /api/teams/coverage` should return the
supported clubs and competitions. Verify supported club routes, clean and legacy
Brighton URLs, and denial of unsupported standalone clubs. Check the authenticated
coverage status and staging report-generation block with a current admin key.
An authentication failure does not establish which application version is live.

Do not promote to production until both the backend and frontend staging
deployments are verified. Coverage initialization and metadata enrichment must
not be used to trigger paid report generation.