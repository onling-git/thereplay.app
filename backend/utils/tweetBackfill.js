// utils/tweetBackfill.js
//
// Instant report generation runs the moment a match flips to "Finished" (see
// cron/index.js live-now task), which is often BEFORE reporters have posted
// their post-match reaction tweets (or before those tweets are indexed by the
// Twitter search API). ensureTweetsExist() in reportPipeline.js only checks
// once at that moment, so the first report frequently ships with no tweets -
// they only show up if someone later regenerates the report manually.
//
// This job runs on its own schedule (see cron/index.js) and retries tweet
// collection + regeneration for recently-finished matches whose saved report
// still has zero embedded tweets, WITHOUT touching or delaying the instant
// generation path. Matches/teams with no Twitter reporters configured are
// skipped immediately so they never trigger extra work.

const axios = require('axios');
const Match = require('../models/Match');
const Report = require('../models/Report');
const Team = require('../models/Team');

const BASE = process.env.SELF_BASE || 'http://localhost:8000';
const ADMIN_KEY = process.env.ADMIN_API_KEY;

const MAX_ATTEMPTS = 4;
// Give reporters time to post before the first retry, and stop trying after this long.
const BACKFILL_MIN_AGE_MS = 10 * 60 * 1000; // 10 minutes after kickoff-time full time
const BACKFILL_MAX_AGE_MS = 3 * 60 * 60 * 1000; // give up 3 hours after full time

async function runTweetBackfill() {
  const now = Date.now();
  const windowStart = new Date(now - BACKFILL_MAX_AGE_MS);
  const windowEnd = new Date(now - BACKFILL_MIN_AGE_MS);

  const matches = await Match.find({
    'match_info.starting_at': { $gte: windowStart, $lte: windowEnd },
    'match_status.state': { $in: ['FT', 'finished', 'ended', 'full-time'] }
  })
    .select('match_id home_team_slug away_team_slug teams home_team_id away_team_id')
    .lean();

  if (!matches.length) return;

  for (const match of matches) {
    const homeSlug = match.home_team_slug || match.teams?.home?.team_slug;
    const awaySlug = match.away_team_slug || match.teams?.away?.team_slug;
    const homeTeamId = match.teams?.home?.team_id || match.home_team_id;
    const awayTeamId = match.teams?.away?.team_id || match.away_team_id;

    await maybeBackfillTeamReport(match.match_id, homeSlug, homeTeamId);
    await maybeBackfillTeamReport(match.match_id, awaySlug, awayTeamId);
  }
}

async function maybeBackfillTeamReport(matchId, teamSlug, teamId) {
  if (!teamSlug || !teamId) return;

  const report = await Report.findOne({ match_id: matchId, team_slug: teamSlug });
  if (!report) return; // instant generation hasn't produced a report yet - not our job

  if (report.embedded_tweets && report.embedded_tweets.length > 0) return; // already has tweets

  const attempts = report.tweet_backfill?.attempts || 0;
  if (attempts >= MAX_ATTEMPTS) return;

  // Skip teams with no Twitter reporters configured - nothing to gain, and this
  // is what keeps the job cheap for the many clubs without a Twitter handle.
  const team = await Team.findOne({ id: teamId }).lean();
  if (!team?.twitter?.reporters?.length) return;

  console.log(`[tweetBackfill] Retrying tweet collection for match ${matchId} team ${teamSlug} (attempt ${attempts + 1}/${MAX_ATTEMPTS})`);

  try {
    // Reuses the existing force-regenerate endpoint, which re-runs ensureTweetsExist()
    // and folds any newly-available tweets into the report.
    await axios.post(`${BASE}/api/reports/v2/generate/${matchId}/${teamSlug}`, {}, {
      headers: { 'x-api-key': ADMIN_KEY },
      timeout: 45_000
    });
  } catch (e) {
    console.error(`[tweetBackfill] Regeneration failed for match ${matchId} team ${teamSlug}:`, e?.response?.data || e.message);
  } finally {
    await Report.updateOne(
      { match_id: matchId, team_slug: teamSlug },
      {
        $inc: { 'tweet_backfill.attempts': 1 },
        $set: { 'tweet_backfill.last_attempt_at': new Date() }
      }
    );
  }
}

module.exports = { runTweetBackfill };
