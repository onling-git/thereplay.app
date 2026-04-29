// Service for syncing cup competitions from Sportmonks API
const { get } = require('../utils/sportmonks');
const CupCompetition = require('../models/CupCompetition');

/**
 * Sync a cup competition for a specific season
 * @param {Number} leagueId - Sportmonks league ID
 * @param {Number} seasonId - Sportmonks season ID  
 * @returns {Object} The saved CupCompetition document
 */
async function syncCupCompetition(leagueId, seasonId) {
  console.log(`[cup] Syncing cup competition for league ${leagueId}, season ${seasonId}...`);
  
  try {
    // 1. Get league info
    const leagueResponse = await get(`/leagues/${leagueId}`);
    const league = leagueResponse.data?.data;
    
    if (!league) {
      console.log(`[cup] League ${leagueId} not found`);
      return null;
    }
    
    console.log(`[cup] Cup: ${league.name}`);
    
    // 2. Get all stages for this season
    const stagesResponse = await get(`/stages/seasons/${seasonId}`);
    const stagesData = stagesResponse.data?.data || [];
    
    console.log(`[cup] Found ${stagesData.length} stages`);
    
    if (stagesData.length === 0) {
      console.log(`[cup] No stages found for season ${seasonId}`);
      return null;
    }
    
    // 3. Sort stages by logical order (we'll need to determine this)
    const orderedStages = orderCupStages(stagesData);
    
    // 4. Fetch fixtures for each stage
    const stages = [];
    for (let i = 0; i < orderedStages.length; i++) {
      const stageData = orderedStages[i];
      console.log(`[cup] Fetching fixtures for stage ${i + 1}/${orderedStages.length}: ${stageData.name}...`);
      
      try {
        const stageDetailResponse = await get(`/stages/${stageData.id}`, {
          include: 'fixtures.participants'
        });
        
        const stageDetail = stageDetailResponse.data?.data;
        const fixtures = stageDetail?.fixtures || [];
        
        // Transform fixtures
        const cupFixtures = fixtures.map(fixture => {
          const homeTeam = fixture.participants?.find(p => p.meta?.location === 'home');
          const awayTeam = fixture.participants?.find(p => p.meta?.location === 'away');
          const ftScore = fixture.scores?.find(s => s.description === 'CURRENT');
          
          return {
            fixture_id: fixture.id,
            home_team_id: homeTeam?.id,
            away_team_id: awayTeam?.id,
            home_team_name: homeTeam?.name,
            away_team_name: awayTeam?.name,
            home_score: ftScore?.score?.goals?.home,
            away_score: ftScore?.score?.goals?.away,
            winner_team_id: fixture.winner_team_id || determineWinner(ftScore, homeTeam?.id, awayTeam?.id),
            status: fixture.state?.short || fixture.state?.state,
            date: fixture.starting_at,
            has_extra_time: false, // Could parse from fixture.periods
            has_penalties: false
          };
        });
        
        // Determine remaining teams (teams that won in this stage)
        const teamsRemaining = cupFixtures
          .filter(f => f.winner_team_id)
          .map(f => ({
            team_id: f.winner_team_id,
            team_name: f.winner_team_id === f.home_team_id ? f.home_team_name : f.away_team_name,
            team_image: null // Could be enriched later
          }));
        
        stages.push({
          stage_id: stageData.id,
          stage_name: stageData.name,
          stage_type_id: stageData.type_id,
          sort_order: i,
          fixtures: cupFixtures,
          teams_remaining: teamsRemaining
        });
        
        console.log(`[cup]   ${cupFixtures.length} fixtures, ${teamsRemaining.length} teams progressed`);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (error) {
        console.error(`[cup] Error fetching stage ${stageData.id}:`, error.message);
      }
    }
    
    // 5. Determine current stage and winner
    const currentStage = stages.find(s => s.fixtures.some(f => f.status === 'LIVE' || f.status === 'NS'));
    const finalStage = stages.find(s => s.stage_name.toLowerCase().includes('final') && !s.stage_name.toLowerCase().includes('semi'));
    const winner = finalStage?.teams_remaining?.[0];
    
    // 6. Create or update cup competition document
    const cupDoc = {
      league_id: leagueId,
      league_name: league.name,
      league_slug: league.short_code?.toLowerCase().replace(/\s+/g, '-'),
      league_image: league.image_path,
      sub_type: league.sub_type,
      season_id: seasonId,
      season_name: stagesData[0]?.season?.name,
      stages: stages,
      current_stage_id: currentStage?.stage_id,
      current_stage_name: currentStage?.stage_name,
      winner_team_id: winner?.team_id,
      winner_team_name: winner?.team_name,
      last_synced: new Date(),
      updated_at: new Date()
    };
    
    const result = await CupCompetition.findOneAndUpdate(
      { league_id: leagueId, season_id: seasonId },
      cupDoc,
      { upsert: true, new: true }
    );
    
    console.log(`[cup] ✅ Synced ${league.name} - ${cupDoc.season_name}`);
    console.log(`[cup] ${stages.length} stages, current: ${currentStage?.stage_name || 'Completed'}`);
    
    return result;
    
  } catch (error) {
    console.error(`[cup] Error syncing cup:`, error.message);
    throw error;
  }
}

/**
 * Sync cup competition by league (uses current season)
 * @param  {Number} leagueId - Sportmonks league ID
 * @returns {Object} The saved CupCompetition document
 */
async function syncCupByLeague(leagueId) {
  console.log(`[cup] Fetching current season for league ${leagueId}...`);
  
  try {
    const leagueResponse = await get(`/leagues/${leagueId}`, {
      include: 'currentseason'
    });
    
    const league = leagueResponse.data?.data;
    const currentSeason = league?.currentseason;
    
    if (!currentSeason) {
      console.log(`[cup] No current season found for league ${leagueId}`);
      return null;
    }
    
    return await syncCupCompetition(leagueId, currentSeason.id);
    
  } catch (error) {
    console.error(`[cup] Error syncing cup by league:`, error.message);
    throw error;
  }
}

/**
 * Helper: Order cup stages logically
 */
function orderCupStages(stages) {
  const stageOrder = {
    'extra preliminary round': 1,
    'preliminary round': 2,
    '1st round qualifying': 3,
    '2nd round qualifying': 4,
    '3rd round qualifying': 5,
    '4th round qualifying': 6,
    'round 1': 10,
    'round 2': 11,
    'round 3': 12,
    'round 4': 13,
    'round 5': 14,
    'round 6': 15,
    'round of 64': 20,
    'round of 32': 21,
    'round of 16': 22,
    'quarter-finals': 30,
    'semi-finals': 40,
    'final': 50
  };
  
  return stages.sort((a, b) => {
    const orderA = stageOrder[a.name.toLowerCase()] || 100;
    const orderB = stageOrder[b.name.toLowerCase()] || 100;
    return orderA - orderB;
  });
}

/**
 * Helper: Determine winner from score
 */
function determineWinner(score, homeTeamId, awayTeamId) {
  if (!score || !score.score?.goals) return null;
  
  const homeGoals = score.score.goals.home || 0;
  const awayGoals = score.score.goals.away || 0;
  
  if (homeGoals > awayGoals) return homeTeamId;
  if (awayGoals > homeGoals) return awayTeamId;
  
  // Draw - check penalties
  if (score.score.goals.penalties_home && score.score.goals.penalties_away) {
    if (score.score.goals.penalties_home > score.score.goals.penalties_away) {
      return homeTeamId;
    } else {
      return awayTeamId;
    }
  }
  
  return null; // Draw, replay needed
}

/**
 * Get cup competition for display
 */
async function getCupForLeague(leagueId) {
  try {
    const cup = await CupCompetition.getCurrentForLeague(leagueId);
    return cup;
  } catch (error) {
    console.error(`[cup] Error getting cup for league ${leagueId}:`, error.message);
    return null;
  }
}

module.exports = {
  syncCupCompetition,
  syncCupByLeague,
  getCupForLeague
};
