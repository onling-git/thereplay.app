// Service for syncing standings from Sportmonks API
const { get } = require('../utils/sportmonks');
const Standing = require('../models/Standing');
const Team = require('../models/Team');
const { transformStandingsResponse, enrichWithTeamIds } = require('../utils/standingsParser');

/**
 * Sync standings for a specific season
 * @param {Number} seasonId - Sportmonks season ID
 * @param {Object} options - Options for the sync
 * @returns {Object} The saved Standing document
 */
async function syncStandingsBySeason(seasonId, options = {}) {
  console.log(`[standings] Syncing standings for season ${seasonId}...`);
  
  try {
    // Sportmonks API doesn't allow multiple includes at once
    // So we need to fetch different data in separate requests and merge
    
    // 1. Get main standings with participant info
    console.log(`[standings] Fetching base standings...`);
    const baseResponse = await get(`/standings/seasons/${seasonId}`, {
      include: 'participant'
    });
    
    const baseData = baseResponse.data?.data;
    
    if (!Array.isArray(baseData) || baseData.length === 0) {
      console.log(`[standings] No standings found for season ${seasonId}`);
      return null;
    }
    
    console.log(`[standings] Retrieved ${baseData.length} teams`);
    
    // 2. Get details (stats)
    console.log(`[standings] Fetching details...`);
    const detailsResponse = await get(`/standings/seasons/${seasonId}`, {
      include: 'details'
    });
    const detailsData = detailsResponse.data?.data || [];
    
    // 3. Get form
    console.log(`[standings] Fetching form...`);
    const formResponse = await get(`/standings/seasons/${seasonId}`, {
      include: 'form'
    });
    const formData = formResponse.data?.data || [];
    
    // 4. Get metadata (each separately)
    console.log(`[standings] Fetching metadata...`);
    const seasonResponse = await get(`/standings/seasons/${seasonId}`, {
      include: 'season'
    });
    const seasonData = seasonResponse.data?.data || [];
    
    const leagueResponse = await get(`/standings/seasons/${seasonId}`, {
      include: 'league'
    });
    const leagueData = leagueResponse.data?.data || [];
    
    const stageResponse = await get(`/standings/seasons/${seasonId}`, {
      include: 'stage'
    });
    const stageData = stageResponse.data?.data || [];
    
   const roundResponse = await get(`/standings/seasons/${seasonId}`, {
      include: 'round'
    });
    const roundData = roundResponse.data?.data || [];
    
    // Merge all data together by standing ID
    const mergedData = baseData.map(base => {
      const details = detailsData.find(d => d.id === base.id);
      const form = formData.find(f => f.id === base.id);
      const season = seasonData.find(m => m.id === base.id);
      const league = leagueData.find(m => m.id === base.id);
      const stage = stageData.find(m => m.id === base.id);
      const round = roundData.find(m => m.id === base.id);
      
      return {
        ...base,
        details: details?.details || [],
        form: form?.form || [],
        season: season?.season,
        league: league?.league,
        stage: stage?.stage,
        round: round?.round
      };
    });
    
    console.log(`[standings] Merged all data`);
    
    // Extract metadata from first entry
    const metadata = mergedData[0] ? {
      season: mergedData[0].season,
      league: mergedData[0].league,
      stage: mergedData[0].stage,
      round: mergedData[0].round
    } : {};
    
    // Transform API response to our schema
    const standingDoc = transformStandingsResponse(mergedData, metadata);
    
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
    
    console.log(`[standings] ✅ Synced ${standingDoc.league_name} - ${standingDoc.season_name}`);
    console.log(`[standings] Stage: ${standingDoc.stage_name}, ${standingDoc.table.length} teams`);
    
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
  console.log(`[standings] Fetching current season for league ${leagueId}...`);
  
  try {
    // Get league with current season
    const leagueResponse = await get(`/leagues/${leagueId}`, {
      include: 'currentseason'
    });
    
    const league = leagueResponse.data?.data;
    const currentSeason = league?.currentseason;
    
    if (!currentSeason) {
      console.log(`[standings] No current season found for league ${leagueId}`);
      return null;
    }
    
    console.log(`[standings] League: ${league.name}, Season: ${currentSeason.name} (${currentSeason.id})`);
    
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
  console.log(`[standings] Syncing ${leagueIds.length} leagues...`);
  
  const results = [];
  
  for (const leagueId of leagueIds) {
    try {
      const result = await syncStandingsByLeague(leagueId);
      results.push({
        league_id: leagueId,
        success: true,
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
  
  const successful = results.filter(r => r.success).length;
  console.log(`[standings] ✅ Synced ${successful}/${leagueIds.length} leagues`);
  
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
 * Get a team's standings across all competitions
 * @param {Number} participantId - Sportmonks participant/team ID
 * @returns {Array} Array of standings where team appears
 */
async function getTeamStandings(participantId) {
  return Standing.getTeamStandings(participantId);
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
