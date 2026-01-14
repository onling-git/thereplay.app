// utils/sportmonksPlayer.js
// Utilities for fetching player data from SportMonks API

const { get } = require('./sportmonks');

/**
 * Fetch player details by ID from SportMonks
 * Returns player info including jersey number, position, image_path
 */
async function fetchPlayerById(playerId) {
  try {
    if (!playerId) return null;
    
    const response = await get(`players/${playerId}`);
    const player = response.data?.data;
    
    if (!player) return null;
    
    return {
      player_id: player.id,
      name: player.display_name || player.fullname || player.name,
      jersey_number: player.jersey_number || null,
      position_id: player.position_id || null,
      position_name: player.position?.name || null,
      image_path: player.image_path || null,
      height: player.height || null,
      weight: player.weight || null,
      date_of_birth: player.date_of_birth || null,
      country_id: player.country_id || null
    };
  } catch (error) {
    console.warn(`[sportmonksPlayer] Failed to fetch player ${playerId}:`, error.message);
    return null;
  }
}

/**
 * Fetch multiple players in batch (with rate limiting consideration)
 * Takes array of player IDs, returns Map of playerId -> player data
 */
async function fetchPlayersBatch(playerIds, options = {}) {
  const { batchSize = 5, delayMs = 100 } = options;
  const results = new Map();
  
  if (!Array.isArray(playerIds) || playerIds.length === 0) {
    return results;
  }
  
  // Filter unique, valid IDs
  const uniqueIds = [...new Set(playerIds.filter(id => id != null))];
  
  // Process in batches to avoid overwhelming the API
  for (let i = 0; i < uniqueIds.length; i += batchSize) {
    const batch = uniqueIds.slice(i, i + batchSize);
    
    const promises = batch.map(async (playerId) => {
      const player = await fetchPlayerById(playerId);
      return { playerId, player };
    });
    
    try {
      const batchResults = await Promise.all(promises);
      batchResults.forEach(({ playerId, player }) => {
        if (player) {
          results.set(String(playerId), player);
        }
      });
      
      // Small delay between batches to be API-friendly
      if (i + batchSize < uniqueIds.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      console.warn(`[sportmonksPlayer] Batch error for players ${batch.join(', ')}:`, error.message);
      // Continue with next batch
    }
  }
  
  return results;
}

/**
 * Fetch team squad/players using SportMonks teams endpoint
 * Useful for getting current jersey numbers and positions
 */
async function fetchTeamSquad(teamId, seasonId = null) {
  try {
    if (!teamId) return [];
    
    let path = `teams/${teamId}`;
    let params = { include: 'squad.player' };
    
    if (seasonId) {
      params.seasons = seasonId;
    }
    
    const response = await get(path, params);
    const team = response.data?.data;
    
    if (!team?.squad?.data) return [];
    
    return team.squad.data.map(squadMember => ({
      player_id: squadMember.player_id,
      team_id: teamId,
      jersey_number: squadMember.jersey_number || null,
      position_id: squadMember.position_id || null,
      player: {
        id: squadMember.player?.id,
        name: squadMember.player?.display_name || squadMember.player?.name,
        position_name: squadMember.player?.position?.name || null,
        image_path: squadMember.player?.image_path || null
      }
    }));
  } catch (error) {
    console.warn(`[sportmonksPlayer] Failed to fetch team squad ${teamId}:`, error.message);
    return [];
  }
}

/**
 * Enrich lineup data with additional player information
 * Takes array of lineup players and enriches with SportMonks data
 */
async function enrichLineupWithPlayerData(lineup, options = {}) {
  if (!Array.isArray(lineup) || lineup.length === 0) {
    return lineup;
  }
  
  // Extract player IDs that need enrichment
  const playerIds = lineup
    .map(player => player.player_id)
    .filter(id => id != null);
    
  if (playerIds.length === 0) {
    return lineup;
  }
  
  console.log(`[sportmonksPlayer] Enriching ${playerIds.length} players with SportMonks data...`);
  
  // Fetch player data
  const playerDataMap = await fetchPlayersBatch(playerIds, options);
  
  // Enrich lineup with fetched data
  return lineup.map(player => {
    const playerId = String(player.player_id || '');
    const enrichmentData = playerDataMap.get(playerId);
    
    if (!enrichmentData) {
      return player; // Return original if no enrichment data
    }
    
    return {
      ...player,
      // Update with SportMonks data, keeping original as fallback
      player_name: enrichmentData.name || player.player_name,
      jersey_number: enrichmentData.jersey_number ?? player.jersey_number,
      position_name: enrichmentData.position_name || player.position_name,
      image_path: enrichmentData.image_path || player.image_path,
      // Keep original formation data
      formation_field: player.formation_field,
      formation_position: player.formation_position
    };
  });
}

module.exports = {
  fetchPlayerById,
  fetchPlayersBatch, 
  fetchTeamSquad,
  enrichLineupWithPlayerData
};