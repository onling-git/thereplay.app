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

## Keeping covered football data fresh

Claude generation requires `CLAUDE_API_KEY` to be scoped to the intended
Anthropic workspace. An unscoped key is rejected by Anthropic because this
integration does not send a workspace-selection header. Keep staging generation
disabled when updating production credentials. Failed writer attempts retain the
six-hour automatic retry cooldown; a skipped pair reports per-team reasons
instead of implying that reports were generated.

Team standings reads use `League.current_season_id` for each enabled competition,
not the latest historical table containing that club. Promoted/relegated clubs
therefore show only their current division; missing current tables do not fall
back to a previous season. Historical standings remain stored.

Recent fixtures and the cached last-match reference are chronological across
covered competitions. They must not inherit the next fixture's season ID:
a forthcoming cup tie must not hide more recent league results.

All refreshes follow the effective coverage policy, including Welsh members of
enabled English leagues and opponent-only clubs in enabled cup fixtures.

- Every six hours, catalogue/membership sync also updates provider-owned club
  metadata and included venues, without changing slugs or editorial content.
- At five minutes past each hour, a data-only catch-up refreshes the last seven
  days and next fourteen days of fixtures (results/status, participants, badges,
  venue, league, season, stage and round), all enabled domestic league tables,
  and every supported club's last/next-match snapshots.
- Club snapshots are also recomputed every fifteen minutes, without a 50/100-club
  cap. Existing live-score, lineup and upcoming schedule jobs continue to run.
- Standings reads use the catalogue's current season. Incomplete provider tables
  never replace a complete stored table. Cup competitions without tables are not
  treated as domestic leagues.

Authenticated `POST /api/admin/leagues/refresh-data` runs the same data-only
refresh. Optional integer `daysBack` and `daysAhead` values are bounded to 1-120;
use a larger window for the initial catch-up, not for every hourly run.
The coverage config stores `data_refresh_status` (counts, start/end, errors) and
a database lease prevents simultaneous refreshes across server instances.
Authenticated `GET /api/admin/leagues/data-status` checks all supported club
profiles, hub cache ages, current-season table sizes and near-term fixtures for
missing metadata rather than treating a successful job as proof of completeness.
Failures return an error and remain visible in League & Country Management;
they are not recorded as successful freshness.

This refresh does not call AI generators, clear reports, replace lineups or
overwrite report flags. Maintenance writes are identified so the match change
stream does not generate reports from those writes. Normal live/report jobs
continue independently under their existing eligibility and staging controls.