// webhooks/matchStatusWebhook.js
// Webhook handler for automatic post-match report generation
// Triggered when a match status changes to "Finished"

const Match = require('../models/Match');
const { generateBothReportsV4ForMatch, generateReportV4ForTeam } = require('../controllers/reportControllerV4');
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
      .then(() => void 0)
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
 * 2. Generate once, collecting configured reporter tweets in the pipeline
 * 3. Update standings
 */
async function processFinishedMatch(matchId) {
  try {
    
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
      return;
    }
    
    
    await generateBothReportsV4ForMatch(matchId, { trigger: 'match-status-webhook' });
    
    
    // Update standings for the league (with caching to avoid duplicate syncs)
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
    
    
    for (const match of matches) {
      // Generate missing reports
      const homeSlug = match.home_team_slug || `__home_${match.match_id}`;
      const awaySlug = match.away_team_slug || `__away_${match.match_id}`;
      
      if (!match.reports?.home) {
        await processReportForTeam(match.match_id, homeSlug);
      }
      
      if (!match.reports?.away) {
        await processReportForTeam(match.match_id, awaySlug);
      }
      
      // Add delay between matches to avoid overwhelming the API
      await delay(2000);
    }
    
    
  } catch (err) {
    console.error('[checkRecentlyFinishedMatches] Error:', err);
  }
}

/**
 * Helper to generate and save a report for a single team
 */
async function processReportForTeam(matchId, teamSlug) {
  try {
    await generateReportV4ForTeam(matchId, teamSlug, { trigger: 'recent-finished-check' });
    
  } catch (err) {
    console.error(`[processReportForTeam] ❌ Error for ${teamSlug}:`, err);
    throw err;
  }
}

/**
 * Update standings for a match's league (with caching to prevent duplicates)
 * Checks if standings were recently synced for this league to minimize API calls
 */
async function updateStandingsForMatch(match) {
  try {
    const leagueId = match.match_info?.league?.id || match.league_id;
    
    if (!leagueId) {
      return;
    }
    
    // Check cache - if we synced this league recently, skip
    const lastSync = standingsSyncCache.get(leagueId);
    const now = Date.now();
    
    if (lastSync && (now - lastSync) < STANDINGS_SYNC_COOLDOWN) {
      Math.floor((now - lastSync) / 60000);
      return;
    }
    
    // Sync standings for this league
    
    try {
      const result = await syncStandingsByLeague(leagueId);
      
      if (result) {
        standingsSyncCache.set(leagueId, now);
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
  updateStandingsForMatch
};
