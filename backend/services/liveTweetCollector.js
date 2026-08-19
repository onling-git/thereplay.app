// services/liveTweetCollector.js
//
// Root-cause fix for "reports don't have tweets": previously tweets were only ever
// collected AFTER a match finished, so reports never had access to in-game reporter
// commentary (e.g. a reporter reacting to a missed chance in the 60th minute) - only
// post-match reactions, and even those often weren't ready in time (see tweetBackfill.js).
//
// This runs tweet collection WHILE a match is live, piggy-backing on the existing
// live-now cron cycle (every 2 minutes), so reporter tweets posted throughout the
// game are already saved and available as context by the time the final report is
// generated. Teams without any Twitter reporters configured are skipped immediately,
// so this adds no cost for the many clubs without a Twitter handle.

const Team = require('../models/Team');
const Tweet = require('../models/Tweet');
const twitterService = require('../utils/twitterService');

// Avoid hitting the Twitter API for the same match/team more than once per interval.
const MIN_RECOLLECT_INTERVAL_MS = 3 * 60 * 1000;

// In-memory only - losing this on a process restart just means one extra collection
// pass; saved tweets are still deduplicated by tweet_id.
const lastCollectedAt = new Map(); // key: `${matchId}:${teamId}` -> timestamp

async function collectTweetsForLiveMatches(liveMatches) {
  if (!Array.isArray(liveMatches) || !liveMatches.length) return;

  for (const match of liveMatches) {
    const homeTeamId = match.teams?.home?.team_id || match.home_team_id;
    const awayTeamId = match.teams?.away?.team_id || match.away_team_id;

    await maybeCollectForTeam(match, homeTeamId);
    await maybeCollectForTeam(match, awayTeamId);
  }
}

async function maybeCollectForTeam(match, teamId) {
  if (!teamId) return;

  const key = `${match.match_id}:${teamId}`;
  const lastRun = lastCollectedAt.get(key) || 0;
  if (Date.now() - lastRun < MIN_RECOLLECT_INTERVAL_MS) return;
  lastCollectedAt.set(key, Date.now());

  const team = await Team.findOne({ id: teamId }).lean();
  if (!team?.twitter?.reporters?.length) return; // no reporters configured, nothing to collect

  try {
    const kickoff = new Date(match.date);
    const reporterHandles = team.twitter.reporters.map(r => r.handle);

    const results = await twitterService.searchByUser(reporterHandles, {
      since: kickoff,
      until: new Date(),
      hashtag: team.twitter.hashtag,
      queryType: 'Latest'
    });

    let saved = 0;
    for (const tweetData of (results.tweets || []).slice(0, 25)) {
      const existing = await Tweet.findOne({ tweet_id: tweetData.id });
      if (existing) continue;

      await Tweet.create({
        tweet_id: tweetData.id,
        text: tweetData.text,
        url: tweetData.url,
        author: {
          id: tweetData.author?.id,
          userName: tweetData.author?.userName,
          name: tweetData.author?.name,
          profilePicture: tweetData.author?.profilePicture,
          followers: tweetData.author?.followers,
          isBlueVerified: tweetData.author?.isBlueVerified
        },
        created_at: new Date(tweetData.createdAt),
        retweetCount: tweetData.retweetCount || 0,
        replyCount: tweetData.replyCount || 0,
        likeCount: tweetData.likeCount || 0,
        team_id: teamId,
        team_slug: team.slug,
        team_name: team.name,
        match_id: match.match_id,
        match_date: match.date,
        collection_context: {
          search_query: `reporters:${reporterHandles.join(',')}`,
          search_type: 'reporter',
          collected_for: 'live_match',
          source_priority: 1
        },
        analysis: { is_match_related: true, sentiment: 'neutral' },
        status: 'raw',
        api_source: 'twitterapi.io'
      });
      saved++;
    }

    if (saved > 0) {
      console.log(`[liveTweetCollector] Saved ${saved} live reporter tweet(s) for ${team.name} (match ${match.match_id})`);
    }
  } catch (err) {
    console.error(`[liveTweetCollector] Failed collecting live tweets for team ${teamId} match ${match.match_id}:`, err.message);
  }
}

module.exports = { collectTweetsForLiveMatches };
