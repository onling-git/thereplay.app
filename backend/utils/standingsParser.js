// Utility functions for parsing Sportmonks standings API responses

/**
 * Map of Sportmonks standing detail type_ids to field names
 * Based on API testing with details.type include - VERIFIED CORRECT
 */
const STANDING_TYPE_MAP = {
  // Overall (Total) Stats
  129: 'played',           // Overall Matches Played
  130: 'won',              // Overall Won
  131: 'drawn',            // Overall Draw
  132: 'lost',             // Overall Lost
  133: 'goals_for',        // Overall Goals Scored
  134: 'goals_against',    // Overall Goals Conceded
  179: 'goal_difference',  // Goal Difference
  187: 'points',           // Overall Points
  
  // Home Stats
  135: 'home_played',      // Home Matches Played
  136: 'home_won',         // Home Won
  137: 'home_drawn',       // Home Draw
  138: 'home_lost',        // Home Lost
  139: 'home_goals_for',   // Home Goals Scored
  140: 'home_goals_against', // Home Goals Conceded
  185: 'home_points',      // Home Points
  
  // Away Stats
  141: 'away_played',      // Away Matches Played
  142: 'away_won',         // Away Won
  143: 'away_drawn',       // Away Draw
  144: 'away_lost',        // Away Lost
  145: 'away_goals_for',   // Away Goals Scored
  146: 'away_goals_against', // Away Goals Conceded
  186: 'away_points',      // Away Points
};

/**
 * Parse standings details array to extract stats
 * @param {Array} details - Array of detail objects from API
 * @returns {Object} Parsed stats object
 */
function parseStandingDetails(details) {
  if (!Array.isArray(details)) return {};
  
  const stats = {
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goals_for: 0,
    goals_against: 0,
    goal_difference: 0
  };
  
  // Map type_ids to values
  details.forEach(detail => {
    const fieldName = STANDING_TYPE_MAP[detail.type_id];
    if (fieldName) {
      stats[fieldName] = detail.value;
    }
  });
  
  // No need to calculate derived values - we now get them directly from the API
  // The overall stats (played, won, drawn, lost) come from type_ids 129-132
  
  return stats;
}

/**
 * Parse form array to extract recent results
 * @param {Array} form - Array of form objects from API
 * @param {Number} limit - Number of recent matches to include (default 5)
 * @returns {Array} Array of 'W', 'D', 'L' strings
 */
function parseStandingForm(form, limit = 5) {
  if (!Array.isArray(form)) return [];
  
  // Sort by sort_order descending to get most recent first
  const sorted = [...form].sort((a, b) => b.sort_order - a.sort_order);
  
  return sorted.slice(0, limit).map(f => f.form);
}

/**
 * Transform API standing entry to our schema format
 * @param {Object} apiEntry - Standings entry from Sportmonks API
 * @param {Object} options - Options for parsing
 * @returns {Object} Standing entry for our database
 */
function transformStandingEntry(apiEntry, options = {}) {
  const stats = parseStandingDetails(apiEntry.details);
  const form = parseStandingForm(apiEntry.form, options.formLimit || 5);
  
  return {
    position: apiEntry.position,
    participant_id: apiEntry.participant_id,
    points: apiEntry.points,
    trend: apiEntry.result, // 'up', 'down', 'equal'
    
    // Stats
    played: stats.played || 0,
    won: stats.won || 0,
    drawn: stats.drawn || 0,
    lost: stats.lost || 0,
    goals_for: stats.goals_for || 0,
    goals_against: stats.goals_against || 0,
    goal_difference: stats.goal_difference || 0,
    
    // Form
    form: form,
    
    // Rule (for promoted/relegated zones)
    standing_rule_id: apiEntry.standing_rule_id || null
  };
}

/**
 * Transform full API response to our Standing document format
 * @param {Array} apiData - Standings array from Sportmonks
 * @param {Object} metadata - League/season metadata
 * @returns {Object} Standing document for database
 */
function transformStandingsResponse(apiData, metadata = {}) {
  if (!Array.isArray(apiData) || apiData.length === 0) {
    throw new Error('Invalid standings data');
  }
  
  // Get metadata from first entry or provided metadata
  const firstEntry = apiData[0];
  const leagueInfo = metadata.league || firstEntry.league || {};
  const seasonInfo = metadata.season || firstEntry.season || {};
  const stageInfo = metadata.stage || firstEntry.stage || {};
  const roundInfo = metadata.round || firstEntry.round || {};
  
  return {
    league_id: metadata.league_id || firstEntry.league_id,
    league_name: metadata.league_name || leagueInfo.name || '',
    season_id: metadata.season_id || firstEntry.season_id,
    season_name: metadata.season_name || seasonInfo.name || '',
    
    stage_id: metadata.stage_id || firstEntry.stage_id,
    stage_name: metadata.stage_name || stageInfo.name || '',
    
    round_id: metadata.round_id || firstEntry.round_id,
    round_name: metadata.round_name || roundInfo.name || '',
    
    is_cup: metadata.is_cup || (leagueInfo.type === 'cup'),
    
    table: apiData.map(entry => transformStandingEntry(entry)),
    
    last_updated: new Date(),
    updated_at: new Date()
  };
}

/**
 * Match our internal team IDs with Sportmonks participant IDs
 * @param {Object} standingDoc - Standing document
 * @param {Model} TeamModel - Mongoose Team model
 */
async function enrichWithTeamIds(standingDoc, TeamModel) {
  const participantIds = standingDoc.table.map(entry => entry.participant_id);
  
  // Fetch our teams that match these participant_ids
  const teams = await TeamModel.find({
    id: { $in: participantIds }
  }).select('_id id').lean();
  
  // Create a map for quick lookup
  const teamIdMap = {};
  teams.forEach(team => {
    teamIdMap[team.id] = team._id;
  });
  
  // Enrich standings with our team_id references
  standingDoc.table.forEach(entry => {
    entry.team_id = teamIdMap[entry.participant_id] || null;
  });
  
  return standingDoc;
}

module.exports = {
  STANDING_TYPE_MAP,
  parseStandingDetails,
  parseStandingForm,
  transformStandingEntry,
  transformStandingsResponse,
  enrichWithTeamIds
};
