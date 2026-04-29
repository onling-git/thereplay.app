// Routes for standings API
const express = require('express');
const router = express.Router();
const apiKey = require('../middleware/apiKey');
const {
  syncStandingsByLeague,
  syncStandingsBySeason,
  syncMultipleLeagues,
  getStandingsForLeague,
  getTeamStandings,
  getTeamPositionInLeague
} = require('../services/standingsService');

/**
 * GET /api/standings/league/:leagueId
 * Get standings for a specific league (from database)
 */
router.get('/league/:leagueId', async (req, res) => {
  try {
    const leagueId = parseInt(req.params.leagueId);
    
    const standings = await getStandingsForLeague(leagueId);
    
    if (!standings) {
      return res.status(404).json({
        ok: false,
        error: 'Standings not found',
        detail: 'No standings found for this league. Try syncing first.'
      });
    }
    
    res.json({
      ok: true,
      data: standings
    });
    
  } catch (error) {
    console.error('[standings API] Error fetching standings:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch standings',
      detail: error.message
    });
  }
});

/**
 * GET /api/standings/team/:participantId
 * Get all standings for a specific team across all competitions
 */
router.get('/team/:participantId', async (req, res) => {
  try {
    const participantId = parseInt(req.params.participantId);
    
    const standings = await getTeamStandings(participantId);
    
    res.json({
      ok: true,
      data: standings
    });
    
  } catch (error) {
    console.error('[standings API] Error fetching team standings:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch team standings',
      detail: error.message
    });
  }
});

/**
 * GET /api/standings/league/:leagueId/team/:participantId
 * Get a specific team's position in a league
 */
router.get('/league/:leagueId/team/:participantId', async (req, res) => {
  try {
    const leagueId = parseInt(req.params.leagueId);
    const participantId = parseInt(req.params.participantId);
    
    const position = await getTeamPositionInLeague(leagueId, participantId);
    
    if (!position) {
      return res.status(404).json({
        ok: false,
        error: 'Position not found',
        detail: 'Team not found in this league standings'
      });
    }
    
    res.json({
      ok: true,
      data: position
    });
    
  } catch (error) {
    console.error('[standings API] Error fetching team position:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch team position',
      detail: error.message
    });
  }
});

/**
 * POST /api/standings/sync/league/:leagueId
 * Sync standings for a specific league (admin only)
 */
router.post('/sync/league/:leagueId', apiKey(true), async (req, res) => {
  try {
    const leagueId = parseInt(req.params.leagueId);
    
    console.log(`[standings API] Syncing league ${leagueId}...`);
    
    const result = await syncStandingsByLeague(leagueId);
    
    if (!result) {
      return res.status(404).json({
        ok: false,
        error: 'Sync failed',
        detail: 'No standings found for this league'
      });
    }
    
    res.json({
      ok: true,
      message: 'Standings synced successfully',
      data: {
        league_name: result.league_name,
        season_name: result.season_name,
        teams_count: result.table.length,
        last_updated: result.last_updated
      }
    });
    
  } catch (error) {
    console.error('[standings API] Error syncing league:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to sync standings',
      detail: error.message
    });
  }
});

/**
 * POST /api/standings/sync/season/:seasonId
 * Sync standings for a specific season (admin only)
 */
router.post('/sync/season/:seasonId', apiKey(true), async (req, res) => {
  try {
    const seasonId = parseInt(req.params.seasonId);
    
    console.log(`[standings API] Syncing season ${seasonId}...`);
    
    const result = await syncStandingsBySeason(seasonId);
    
    if (!result) {
      return res.status(404).json({
        ok: false,
        error: 'Sync failed',
        detail: 'No standings found for this season'
      });
    }
    
    res.json({
      ok: true,
      message: 'Standings synced successfully',
      data: {
        league_name: result.league_name,
        season_name: result.season_name,
        teams_count: result.table.length,
        last_updated: result.last_updated
      }
    });
    
  } catch (error) {
    console.error('[standings API] Error syncing season:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to sync standings',
      detail: error.message
    });
  }
});

/**
 * POST /api/standings/sync/batch
 * Sync standings for multiple leagues (admin only)
 * Body: { league_ids: [8, 9, 24], delay_ms: 500 }
 */
router.post('/sync/batch', apiKey(true), async (req, res) => {
  try {
    const { league_ids, delay_ms = 500 } = req.body;
    
    if (!Array.isArray(league_ids) || league_ids.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid request',
        detail: 'league_ids must be a non-empty array'
      });
    }
    
    console.log(`[standings API] Batch syncing ${league_ids.length} leagues...`);
    
    const results = await syncMultipleLeagues(league_ids, delay_ms);
    
    const successful = results.filter(r => r.success).length;
    
    res.json({
      ok: true,
      message: `Synced ${successful}/${league_ids.length} leagues`,
      results: results
    });
    
  } catch (error) {
    console.error('[standings API] Error batch syncing:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to batch sync standings',
      detail: error.message
    });
  }
});

module.exports = router;
