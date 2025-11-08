// utils/teamCacheUtils.js
const Team = require('../models/Team');
const { getDynamicTeamMatchInfo } = require('./teamMatchUtils');

/**
 * Find teams with stale cache based on TTL
 * @param {number} staleTtlMs - Teams older than this are considered stale (default: 6 hours)
 * @param {number} limit - Maximum number of stale teams to return
 * @returns {Array} Array of team documents with stale cache
 */
async function findStaleTeams(staleTtlMs = 6 * 60 * 60 * 1000, limit = 50) {
  const staleThreshold = new Date(Date.now() - staleTtlMs);
  
  return Team.find({
    $or: [
      { 'cache_metadata.cached_at': { $lt: staleThreshold } },
      { 'cache_metadata.cached_at': { $exists: false } },
      { 'cache_metadata.cached_at': null }
    ]
  })
  .select('slug name cache_metadata last_match_info next_match_info')
  .sort({ 'cache_metadata.cached_at': 1 }) // Oldest first
  .limit(limit)
  .lean();
}

/**
 * Refresh cache for a specific team
 * @param {string} teamSlug - Team slug to refresh
 * @param {string} computedBy - Who triggered this refresh ('cron', 'manual', 'api', etc.)
 * @returns {Object} Result object with success status and updated data
 */
async function refreshTeamCache(teamSlug, computedBy = 'api') {
  const startTime = Date.now();
  
  try {
    const team = await Team.findOne({ slug: teamSlug });
    if (!team) {
      throw new Error(`Team not found: ${teamSlug}`);
    }

    // Get current match information
    const dynamicInfo = await getDynamicTeamMatchInfo(teamSlug, team.name);
    
    // Check if update is needed (avoid unnecessary writes)
    const needsUpdate = (
      JSON.stringify(dynamicInfo.last_match_info) !== JSON.stringify(team.last_match_info) ||
      JSON.stringify(dynamicInfo.next_match_info) !== JSON.stringify(team.next_match_info) ||
      dynamicInfo.last_played_at?.getTime() !== team.last_played_at?.getTime() ||
      dynamicInfo.next_game_at?.getTime() !== team.next_game_at?.getTime()
    );

    const computationDuration = Date.now() - startTime;

    if (needsUpdate) {
      // Update with new data and cache metadata
      const updated = await Team.findOneAndUpdate(
        { slug: teamSlug },
        {
          $set: {
            last_match_info: dynamicInfo.last_match_info,
            next_match_info: dynamicInfo.next_match_info,
            last_played_at: dynamicInfo.last_played_at,
            next_game_at: dynamicInfo.next_game_at,
            'cache_metadata.cached_at': new Date(),
            'cache_metadata.last_computed_by': computedBy,
            'cache_metadata.computation_duration_ms': computationDuration
          },
          $inc: {
            'cache_metadata.cache_version': 1
          }
        },
        { new: true }
      ).lean();

      return {
        success: true,
        updated: true,
        team: teamSlug,
        cache_metadata: updated.cache_metadata,
        computation_duration_ms: computationDuration
      };
    } else {
      // Just update cache metadata (no data changes)
      await Team.findOneAndUpdate(
        { slug: teamSlug },
        {
          $set: {
            'cache_metadata.cached_at': new Date(),
            'cache_metadata.last_computed_by': computedBy,
            'cache_metadata.computation_duration_ms': computationDuration
          }
        }
      );

      return {
        success: true,
        updated: false,
        team: teamSlug,
        computation_duration_ms: computationDuration,
        message: 'Cache refreshed, no data changes needed'
      };
    }
  } catch (error) {
    const computationDuration = Date.now() - startTime;
    
    // Mark as failed refresh attempt
    try {
      await Team.findOneAndUpdate(
        { slug: teamSlug },
        {
          $set: {
            'cache_metadata.last_computed_by': `${computedBy}-failed`,
            'cache_metadata.computation_duration_ms': computationDuration
          }
        }
      );
    } catch (updateError) {
      console.error(`[cache-refresh] Failed to update error metadata for ${teamSlug}:`, updateError?.message);
    }

    return {
      success: false,
      updated: false,
      team: teamSlug,
      error: error.message,
      computation_duration_ms: computationDuration
    };
  }
}

/**
 * Batch refresh cache for multiple teams
 * @param {Array} teamSlugs - Array of team slugs to refresh
 * @param {string} computedBy - Who triggered this refresh
 * @param {Object} options - Options for batch processing
 * @returns {Object} Summary of batch refresh results
 */
async function batchRefreshTeamCache(teamSlugs, computedBy = 'batch', options = {}) {
  const { 
    concurrency = 5, 
    delayMs = 200,
    stopOnError = false 
  } = options;

  const results = {
    total: teamSlugs.length,
    successful: 0,
    updated: 0,
    failed: 0,
    errors: [],
    startTime: new Date(),
    endTime: null,
    duration: null
  };

  // Process teams in chunks to prevent overwhelming the database
  for (let i = 0; i < teamSlugs.length; i += concurrency) {
    const chunk = teamSlugs.slice(i, i + concurrency);
    const chunkPromises = chunk.map(async (teamSlug) => {
      try {
        const result = await refreshTeamCache(teamSlug, computedBy);
        if (result.success) {
          results.successful++;
          if (result.updated) results.updated++;
        } else {
          results.failed++;
          results.errors.push({ team: teamSlug, error: result.error });
          if (stopOnError) throw new Error(`Stopped on error for team ${teamSlug}: ${result.error}`);
        }
        return result;
      } catch (error) {
        results.failed++;
        results.errors.push({ team: teamSlug, error: error.message });
        if (stopOnError) throw error;
        return { success: false, team: teamSlug, error: error.message };
      }
    });

    await Promise.all(chunkPromises);
    
    // Delay between chunks
    if (i + concurrency < teamSlugs.length && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  results.endTime = new Date();
  results.duration = results.endTime.getTime() - results.startTime.getTime();

  return results;
}

/**
 * Get cache statistics for all teams
 * @returns {Object} Cache statistics
 */
async function getCacheStatistics() {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

  const [
    totalTeams,
    teamsWithCache,
    teamsUpdatedLastHour,
    teamsUpdatedLast6Hours,
    teamsUpdatedLastDay,
    staleTeams,
    neverCachedTeams
  ] = await Promise.all([
    Team.countDocuments({}),
    Team.countDocuments({ 'cache_metadata.cached_at': { $exists: true, $ne: null } }),
    Team.countDocuments({ 'cache_metadata.cached_at': { $gte: oneHourAgo } }),
    Team.countDocuments({ 'cache_metadata.cached_at': { $gte: sixHoursAgo } }),
    Team.countDocuments({ 'cache_metadata.cached_at': { $gte: oneDayAgo } }),
    Team.countDocuments({
      $or: [
        { 'cache_metadata.cached_at': { $lt: sixHoursAgo } },
        { 'cache_metadata.cached_at': null }
      ]
    }),
    Team.countDocuments({
      $or: [
        { 'cache_metadata.cached_at': { $exists: false } },
        { 'cache_metadata.cached_at': null }
      ]
    })
  ]);

  return {
    total_teams: totalTeams,
    teams_with_cache: teamsWithCache,
    cache_coverage_pct: totalTeams > 0 ? Math.round((teamsWithCache / totalTeams) * 100) : 0,
    updated_last_hour: teamsUpdatedLastHour,
    updated_last_6_hours: teamsUpdatedLast6Hours,
    updated_last_day: teamsUpdatedLastDay,
    stale_teams: staleTeams,
    never_cached_teams: neverCachedTeams,
    generated_at: now.toISOString()
  };
}

module.exports = {
  findStaleTeams,
  refreshTeamCache,
  batchRefreshTeamCache,
  getCacheStatistics
};