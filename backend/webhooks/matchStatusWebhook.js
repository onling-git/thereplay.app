// webhooks/matchStatusWebhook.js
// Webhook handler for automatic post-match report generation
// Triggered when a match status changes to "Finished"

const Match = require('../models/Match');
const Tweet = require('../models/Tweet');
const { generateReportPipeline } = require('../services/reportPipeline');
const { saveReportToDatabase } = require('../controllers/reportControllerV2');
const twitterService = require('../utils/twitterService');
const { syncStandingsByLeague } = require('../services/standingsService');

// Cache to prevent duplicate standings syncs for same league within a time window
const standingsSyncCache = new Map(); // leagueId -> timestamp
const STANDINGS_SYNC_COOLDOWN = 10 * 60 * 1000; // 10 minutes

/**
 * Webhook endpoint for match status updates
 * Route: POST /api/webhooks/match-status
 * 
 * Expected payload:
 * {
 *   "match_id": 123456,
 *   "status": "Finished",
 *   "timestamp": "2024-01-15T20:00:00Z"
 * }
 */
async function handleMatchStatusWebhook(req, res) {
  try {
    const { match_id, status, timestamp } = req.body;
    
    if (!match_id) {
      return res.status(400).json({ error: 'match_id required' });
    }
    
    console.log(`[MatchStatusWebhook] Received update: match ${match_id} → ${status}`);
    
    // Only process finished matches
    if (status !== 'Finished' && status !== 'FT') {
      return res.json({
        ok: true,
        message: 'Not a finished match, skipping report generation',
        match_id,
        status
      });
    }
    
    // Process asynchronously (don't block webhook response)
    processFinishedMatch(match_id)
      .then(() => console.log(`[MatchStatusWebhook] Reports generated for match ${match_id}`))
      .catch(err => console.error(`[MatchStatusWebhook] Error processing match ${match_id}:`, err));
    
    // Respond immediately to webhook
    return res.json({
      ok: true,
      message: 'Match report generation queued',
      match_id
    });
    
  } catch (err) {
    console.error('[MatchStatusWebhook] Error:', err);
    return res.status(500).json({
      error: 'Webhook processing failed',
      detail: err.message || err
    });
  }
}

/**
 * Process a finished match and generate reports for both teams
 * Steps:
 * 1. Verify match is finished
 * 2. Collect tweets (if TwitterAPI configured)
 * 3. Wait for tweets to be saved
 * 4. Generate reports with fresh tweet context
 */
async function processFinishedMatch(matchId) {
  try {
    console.log(`[processFinishedMatch] 🏁 Processing match ${matchId}...`);
    
    // Fetch match data
    const match = await Match.findOne({ match_id: Number(matchId) }).lean();
    
    if (!match) {
      console.error(`[processFinishedMatch] ❌ Match ${matchId} not found`);
      return;
    }
    
    // Verify match is actually finished
    const isFinished = match.status === 'Finished' || 
                      match.status === 'FT' ||
                      match.match_status?.short_name === 'FT' ||
                      match.match_status?.state === 'Finished';
    
    if (!isFinished) {
      console.log(`[processFinishedMatch] ⏭️ Match ${matchId} status is ${match.status}, skipping`);
      return;
    }
    
    console.log(`[processFinishedMatch] ✅ Match confirmed finished: ${match.teams?.home?.team_name || match.home_team} ${match.score?.ft_score || 'vs'} ${match.teams?.away?.team_name || match.away_team}`);
    
    // STEP 1: Collect tweets immediately for EACH TEAM using their configured sources
    // This ensures proper team_id assignment from admin configuration
    let tweetsCollected = 0;
    
    if (process.env.TWITTERAPI_KEY) {
      try {
        console.log(`[processFinishedMatch] 🐦 Collecting tweets for match ${matchId}...`);
        
        const Team = require('../models/Team');
        const homeTeamId = match.teams?.home?.team_id || match.home_team_id;
        const awayTeamId = match.teams?.away?.team_id || match.away_team_id;
        
        const matchDate = new Date(match.date);
        const searchStart = new Date(matchDate.getTime() - 2 * 60 * 60 * 1000); // 2h before
        const searchEnd = new Date(); // Now (match just finished)
        
        // Collect for both teams using their configured Twitter sources
        for (const teamId of [homeTeamId, awayTeamId]) {
          try {
            const team = await Team.findOne({ id: teamId }).lean();
            
            if (!team) {
              console.log(`[processFinishedMatch] Team ${teamId} not found`);
              continue;
            }
            
            if (!team.twitter || !team.twitter.tweet_fetch_enabled) {
              console.log(`[processFinishedMatch] Team ${team.name} has no Twitter configured, skipping`);
              continue;
            }
            
            console.log(`[processFinishedMatch] Collecting tweets for ${team.name} using configured sources...`);
            
            // Use searchTeamTweets which respects reporters/hashtags from admin config
            const results = await twitterService.searchTeamTweets(team, {
              since: searchStart,
              until: searchEnd,
              queryType: 'Latest'
            });
            
            console.log(`[processFinishedMatch] Found ${results.tweets.length} tweets for ${team.name}`);
            
            // Save tweets - they already have team_id from searchTeamTweets
            for (const tweetData of results.tweets.slice(0, 25)) {
              try {
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
                  team_id: tweetData.collection_context?.team_id, // From configured source
                  team_slug: tweetData.collection_context?.team_slug,
                  team_name: tweetData.collection_context?.team_name,
                  match_id: matchId,
                  match_date: match.date,
                  collection_context: {
                    search_query: tweetData.collection_context?.search_query || '',
                    search_type: tweetData.collection_context?.search_type || 'team_source',
                    collected_for: 'post_match',
                    source_priority: tweetData.collection_context?.source_priority || 2
                  },
                  analysis: {
                    is_match_related: true,
                    sentiment: 'neutral'
                  },
                  status: 'raw',
                  api_source: 'twitterapi.io'
                });
                
                tweetsCollected++;
              } catch (err) {
                console.error(`[processFinishedMatch] Error saving tweet ${tweetData.id}:`, err.message);
              }
            }
          } catch (err) {
            console.error(`[processFinishedMatch] Error collecting tweets for team ${teamId}:`, err.message);
          }
        }
        
        console.log(`[processFinishedMatch] ✅ Collected ${tweetsCollected} tweets total`);
        
      } catch (err) {
        console.error(`[processFinishedMatch] ⚠️ Tweet collection failed (continuing anyway):`, err.message);
      }
    } else {
      console.log(`[processFinishedMatch] ⚠️ TwitterAPI not configured, skipping tweet collection`);
    }
    
    // STEP 2: Small delay to ensure all data is ready
    await delay(3000); // 3 second delay
    
    // STEP 3: Generate reports (pipeline will use the tweets we just collected)
    const homeSlug = match.home_team_slug || `__home_${matchId}`;
    const awaySlug = match.away_team_slug || `__away_${matchId}`;
    
    console.log(`[processFinishedMatch] 📝 Generating reports for ${homeSlug} and ${awaySlug}...`);
    
    // Generate home team report
    try {
      const homeResult = await generateReportPipeline({
        matchId,
        teamSlug: homeSlug,
        options: {
          autoCollectTweets: false // We already collected tweets above
        }
      });
      
      await saveReportToDatabase({
        report: homeResult.report,
        matchId,
        teamSlug: homeSlug,
        metadata: homeResult.metadata
      });
      
      console.log(`[processFinishedMatch] ✅ Home report generated for ${homeSlug}`);
    } catch (err) {
      console.error(`[processFinishedMatch] ❌ Failed to generate home report:`, err.message);
    }
    
    // Generate away team report
    try {
      const awayResult = await generateReportPipeline({
        matchId,
        teamSlug: awaySlug,
        options: {
          autoCollectTweets: false // We already collected tweets above
        }
      });
      
      await saveReportToDatabase({
        report: awayResult.report,
        matchId,
        teamSlug: awaySlug,
        metadata: awayResult.metadata
      });
      
      console.log(`[processFinishedMatch] ✅ Away report generated for ${awaySlug}`);
    } catch (err) {
      console.error(`[processFinishedMatch] ❌ Failed to generate away report:`, err.message);
    }
    
    console.log(`[processFinishedMatch] 🎉 Processing complete for match ${matchId} (${tweetsCollected} tweets, 2 reports)`);
    
    // STEP 4: Update standings for the league (with caching to avoid duplicate syncs)
    await updateStandingsForMatch(match);
    
  } catch (err) {
    console.error(`[processFinishedMatch] ❌ Error processing match ${matchId}:`, err);
  }
}

/**
 * Alternative: Cron job to check for recently finished matches
 * Can run every 10-15 minutes to catch any matches that finished
 */
async function checkRecentlyFinishedMatches() {
  try {
    console.log('[checkRecentlyFinishedMatches] Scanning for finished matches...');
    
    // Find matches that finished in the last 2 hours and don't have reports
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
    
    const matches = await Match.find({
      date: { $gte: cutoff },
      status: { $in: ['Finished', 'FT'] },
      $or: [
        { 'reports.home': { $exists: false } },
        { 'reports.away': { $exists: false } }
      ]
    })
      .select('match_id home_team_slug away_team_slug reports status')
      .limit(20) // Process max 20 at a time
      .lean();
    
    console.log(`[checkRecentlyFinishedMatches] Found ${matches.length} matches needing reports`);
    
    for (const match of matches) {
      // Generate missing reports
      const homeSlug = match.home_team_slug || `__home_${match.match_id}`;
      const awaySlug = match.away_team_slug || `__away_${match.match_id}`;
      
      if (!match.reports?.home) {
        console.log(`[checkRecentlyFinishedMatches] Generating home report for match ${match.match_id}...`);
        await processReportForTeam(match.match_id, homeSlug);
      }
      
      if (!match.reports?.away) {
        console.log(`[checkRecentlyFinishedMatches] Generating away report for match ${match.match_id}...`);
        await processReportForTeam(match.match_id, awaySlug);
      }
      
      // Add delay between matches to avoid overwhelming the API
      await delay(2000);
    }
    
    console.log('[checkRecentlyFinishedMatches] Scan complete');
    
  } catch (err) {
    console.error('[checkRecentlyFinishedMatches] Error:', err);
  }
}

/**
 * Helper to generate and save a report for a single team
 */
async function processReportForTeam(matchId, teamSlug) {
  try {
    const result = await generateReportPipeline({
      matchId,
      teamSlug,
      options: {}
    });
    
    await saveReportToDatabase({
      report: result.report,
      matchId,
      teamSlug,
      metadata: result.metadata
    });
    
    console.log(`[processReportForTeam] ✅ Report saved for ${teamSlug}`);
  } catch (err) {
    console.error(`[processReportForTeam] ❌ Error for ${teamSlug}:`, err);
    throw err;
  }
}pdate standings for a match's league (with caching to prevent duplicates)
 * Checks if standings were recently synced for this league to minimize API calls
 */
async function updateStandingsForMatch(match) {
  try {
    const leagueId = match.match_info?.league?.id || match.league_id;
    
    if (!leagueId) {
      console.log('[updateStandingsForMatch] No league ID found, skipping standings update');
      return;
    }
    
    // Check cache - if we synced this league recently, skip
    const lastSync = standingsSyncCache.get(leagueId);
    const now = Date.now();
    
    if (lastSync && (now - lastSync) < STANDINGS_SYNC_COOLDOWN) {
      const minutesAgo = Math.floor((now - lastSync) / 60000);
      console.log(`[updateStandingsForMatch] ⏭️ Standings for league ${leagueId} were synced ${minutesAgo} min ago, skipping`);
      return;
    }
    
    // Sync standings for this league
    console.log(`[updateStandingsForMatch] 📊 Syncing standings for league ${leagueId}...`);
    
    try {
      const result = await syncStandingsByLeague(leagueId);
      
      if (result) {
        standingsSyncCache.set(leagueId, now);
        console.log(`[updateStandingsForMatch] ✅ Standings synced: ${result.league_name} (${result.table?.length || 0} teams)`);
      } else {
        console.log(`[updateStandingsForMatch] ⚠️ No standings data available for league ${leagueId}`);
      }
    } catch (err) {
      console.error(`[updateStandingsForMatch] ❌ Failed to sync standings for league ${leagueId}:`, err.message);
    }
    
  } catch (err) {
    console.error('[updateStandingsForMatch] Error:', err.message);
  }
}

/**
 * Utility delay function
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  handleMatchStatusWebhook,
  checkRecentlyFinishedMatches,
  processFinishedMatch,
  updateStandingsFor{
  handleMatchStatusWebhook,
  checkRecentlyFinishedMatches,
  processFinishedMatch
};
