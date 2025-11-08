// routes/teamCacheRoutes.js
const express = require('express');
const router = express.Router();
const { 
  findStaleTeams, 
  refreshTeamCache, 
  batchRefreshTeamCache, 
  getCacheStatistics 
} = require('../utils/teamCacheUtils');
const apiKey = require('../middleware/apiKey');

// All routes require admin API key
router.use(apiKey(true));

/**
 * GET /api/teams/cache/stats
 * Get cache statistics for all teams
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await getCacheStatistics();
    res.json(stats);
  } catch (err) {
    console.error('Cache stats error:', err);
    res.status(500).json({ error: 'Failed to get cache statistics', detail: err.message });
  }
});

/**
 * GET /api/teams/cache/stale
 * Get list of teams with stale cache
 */
router.get('/stale', async (req, res) => {
  try {
    const staleTtlMs = Number(req.query.ttl_hours || 6) * 60 * 60 * 1000;
    const limit = Math.min(Number(req.query.limit || 50), 200);
    
    const staleTeams = await findStaleTeams(staleTtlMs, limit);
    
    res.json({
      stale_teams: staleTeams,
      count: staleTeams.length,
      ttl_hours: staleTtlMs / (60 * 60 * 1000),
      limit: limit
    });
  } catch (err) {
    console.error('Find stale teams error:', err);
    res.status(500).json({ error: 'Failed to find stale teams', detail: err.message });
  }
});

/**
 * POST /api/teams/cache/refresh
 * Refresh cache for specific teams or all stale teams
 * Body: { teams?: string[], all_stale?: boolean, options?: {} }
 */
router.post('/refresh', async (req, res) => {
  try {
    const { teams, all_stale = false, options = {} } = req.body;
    
    let teamSlugs = [];
    
    if (all_stale) {
      // Refresh all stale teams
      const staleTtlMs = Number(options.ttl_hours || 6) * 60 * 60 * 1000;
      const limit = Math.min(Number(options.limit || 100), 500);
      const staleTeams = await findStaleTeams(staleTtlMs, limit);
      teamSlugs = staleTeams.map(team => team.slug);
    } else if (teams && Array.isArray(teams)) {
      // Refresh specific teams
      teamSlugs = teams.filter(slug => typeof slug === 'string' && slug.trim());
    } else {
      return res.status(400).json({ 
        error: 'Either provide teams array or set all_stale=true',
        example: { teams: ["team-slug-1", "team-slug-2"] }
      });
    }
    
    if (teamSlugs.length === 0) {
      return res.json({ message: 'No teams to refresh', count: 0 });
    }
    
    // Batch refresh
    const refreshOptions = {
      concurrency: Math.min(Number(options.concurrency || 5), 10),
      delayMs: Number(options.delay_ms || 200),
      stopOnError: Boolean(options.stop_on_error || false)
    };
    
    const result = await batchRefreshTeamCache(teamSlugs, 'api', refreshOptions);
    
    res.json({
      success: true,
      result: result,
      teams_processed: result.total,
      teams_updated: result.updated,
      duration_ms: result.duration
    });
    
  } catch (err) {
    console.error('Cache refresh error:', err);
    res.status(500).json({ error: 'Failed to refresh cache', detail: err.message });
  }
});

/**
 * POST /api/teams/cache/refresh/:teamSlug
 * Refresh cache for a single team
 */
router.post('/refresh/:teamSlug', async (req, res) => {
  try {
    const teamSlug = req.params.teamSlug;
    
    const result = await refreshTeamCache(teamSlug, 'api');
    
    if (result.success) {
      res.json({
        success: true,
        team: result.team,
        updated: result.updated,
        cache_metadata: result.cache_metadata,
        duration_ms: result.computation_duration_ms
      });
    } else {
      res.status(500).json({
        success: false,
        team: result.team,
        error: result.error,
        duration_ms: result.computation_duration_ms
      });
    }
  } catch (err) {
    console.error('Single team cache refresh error:', err);
    res.status(500).json({ error: 'Failed to refresh team cache', detail: err.message });
  }
});

/**
 * DELETE /api/teams/cache/invalidate
 * Invalidate cache for specific teams (mark as stale)
 * Body: { teams: string[] }
 */
router.delete('/invalidate', async (req, res) => {
  try {
    const { teams } = req.body;
    
    if (!teams || !Array.isArray(teams) || teams.length === 0) {
      return res.status(400).json({ 
        error: 'teams array is required',
        example: { teams: ["team-slug-1", "team-slug-2"] }
      });
    }
    
    const Team = require('../models/Team');
    
    // Mark teams' cache as stale
    const result = await Team.updateMany(
      { slug: { $in: teams } },
      {
        $set: {
          'cache_metadata.cached_at': null,
          'cache_metadata.last_computed_by': 'api-invalidated'
        },
        $inc: {
          'cache_metadata.cache_version': 1
        }
      }
    );
    
    res.json({
      success: true,
      teams_invalidated: result.modifiedCount,
      teams_requested: teams.length
    });
    
  } catch (err) {
    console.error('Cache invalidation error:', err);
    res.status(500).json({ error: 'Failed to invalidate cache', detail: err.message });
  }
});

module.exports = router;