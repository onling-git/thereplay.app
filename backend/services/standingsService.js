// Service for syncing standings from Sportmonks API
const { get } = require('../utils/sportmonks');
const Standing = require('../models/Standing');
const Team = require('../models/Team');
const { transformStandingsResponse, enrichWithTeamIds } = require('../utils/standingsParser');
const { fetchSportmonksPages } = require('../utils/sportmonksPages');

/**
 * Sync standings for a specific season
 * @param {Number} seasonId - Sportmonks season ID
 * @param {Object} options - Options for the sync
 * @returns {Object} The saved Standing document
 */
async function syncStandingsBySeason(seasonId, options = {}) {
  
  try {
    // Fetch each relation completely before replacing a stored table.
    // So we need to fetch different data in separate requests and merge
    
    // 1. Get main standings with participant info
    const baseData = await fetchSportmonksPages(`/standings/seasons/${seasonId}`, {
      include: 'participant;details;form;season;league;stage;round'
    });
    
    if (!Array.isArray(baseData) || baseData.length === 0) {
      throw new Error(`No standings available for season ${seasonId}`);
    }
    
    
    const mergedData = baseData;
    
    
    // Extract metadata from first entry
    const metadata = mergedData[0] ? {
      season: mergedData[0].season,
      league: mergedData[0].league,
      stage: mergedData[0].stage,
      round: mergedData[0].round
    } : {};
    
    // Transform API response to our schema
    const standingDoc = transformStandingsResponse(mergedData, metadata);
    const members = await require('../models/TeamMembership').find({
      league_id: standingDoc.league_id, season_id: standingDoc.season_id, active: true
    }).select('team_id').lean();
    if (members.length && (new Set(baseData.map(row => row.participant_id)).size !== members.length
      || members.some(member => !baseData.some(row => Number(row.participant_id) === Number(member.team_id))))) {
      throw new Error(`Incomplete standings for season ${seasonId}; keeping the stored table`);
    }
    
    // Enrich with our team IDs
    await enrichWithTeamIds(standingDoc, Team);
    
    // Upsert (update or insert)
    const result = await Standing.findOneAndUpdate(
      {
        league_id: standingDoc.league_id,
        season_id: standingDoc.season_id,
        stage_id: standingDoc.stage_id
      },
      standingDoc,
      { upsert: true, new: true }
    );
    
    
    return result;
    
  } catch (error) {
    console.error(`[standings] Error syncing season ${seasonId}:`, error.message);
    throw error;
  }
}

/**
 * Sync standings for a league's current season
 * @param {Number} leagueId - Sportmonks league ID
 * @returns {Object} The saved Standing document
 */
async function syncStandingsByLeague(leagueId) {
  
  try {
    // Get league with current season
    const leagueResponse = await get(`/leagues/${leagueId}`, {
      include: 'currentseason'
    });
    
    const league = leagueResponse.data?.data;
    const currentSeason = league?.currentseason;
    
    if (!currentSeason) {
      throw new Error(`No current season available for league ${leagueId}`);
    }
    
    
    // Sync standings for this season
    return await syncStandingsBySeason(currentSeason.id);
    
  } catch (error) {
    console.error(`[standings] Error syncing league ${leagueId}:`, error.message);
    throw error;
  }
}

/**
 * Sync standings for multiple leagues (e.g., daily sync job)
 * @param {Array<Number>} leagueIds - Array of Sportmonks league IDs
 * @param {Number} delayMs - Delay between requests (rate limiting)
 * @returns {Array} Results of sync operations
 */
async function syncMultipleLeagues(leagueIds, delayMs = 500) {
  
  const results = [];
  
  for (const leagueId of leagueIds) {
    try {
      const result = await syncStandingsByLeague(leagueId);
      results.push({
        league_id: leagueId,
        success: Boolean(result),
        data: result
      });
    } catch (error) {
      console.error(`[standings] Failed to sync league ${leagueId}:`, error.message);
      results.push({
        league_id: leagueId,
        success: false,
        error: error.message
      });
    }
    
    // Rate limiting delay
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  
  
  return results;
}

/**
 * Get standings for a specific league (from database)
 * @param {Number} leagueId - Sportmonks league ID
 * @returns {Object} Standing document or null
 */
async function getStandingsForLeague(leagueId) {
  return Standing.getCurrentForLeague(leagueId);
}

/**
 * Get a team's current-season standings across competitions
 * @param {Number} participantId - Sportmonks participant/team ID
 * @returns {Array} Array of standings where team appears
 */
async function getTeamStandings(participantId, options) {
  return Standing.getTeamStandings(participantId, options);
}

/**
 * Get a specific team's position in a league
 * @param {Number} leagueId - Sportmonks league ID
 * @param {Number} participantId - Sportmonks participant/team ID
 * @returns {Object} Team's standing entry or null
 */
async function getTeamPositionInLeague(leagueId, participantId) {
  const standings = await getStandingsForLeague(leagueId);
  
  if (!standings || !standings.table) return null;
  
  // Since getStandingsForLeague returns a lean object, manually search the table
  return standings.table.find(entry => entry.participant_id === participantId) || null;
}

module.exports = {
  syncStandingsBySeason,
  syncStandingsByLeague,
  syncMultipleLeagues,
  getStandingsForLeague,
  getTeamStandings,
  getTeamPositionInLeague
};
