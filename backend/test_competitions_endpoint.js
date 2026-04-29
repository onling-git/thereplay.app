require('dotenv').config();
const Team = require('./models/Team');
const CupCompetition = require('./models/CupCompetition');
const mongoose = require('mongoose');

async function testTeamCompetitionsEndpoint() {
  try {
    await mongoose.connect(process.env.DBURI);
    console.log('Connected to database\n');
    
    const teamSlug = 'southampton';
    const team = await Team.findOne({ slug: teamSlug }).lean();
    
    if (!team) {
      console.log('Team not found');
      process.exit(1);
    }
    
    console.log('Team:', team.name, '(ID:', team.id, ')');
    
    // Find all cup competitions where the team appears
    const cupCompetitions = await CupCompetition.find({
      $or: [
        { 'stages.fixtures.home_team_id': team.id },
        { 'stages.fixtures.away_team_id': team.id },
        { 'stages.teams_remaining.team_id': team.id }
      ]
    }).lean();
    
    console.log('\nFound', cupCompetitions.length, 'cup competitions\n');
    
    const competitions = [];
    
    for (const cup of cupCompetitions) {
      // Find all stages where the team participated
      const teamStages = cup.stages.filter(stage => {
        const hasFixture = stage.fixtures?.some(
          f => f.home_team_id === team.id || f.away_team_id === team.id
        );
        const isInRemaining = stage.teams_remaining?.some(t => t.team_id === team.id);
        return hasFixture || isInRemaining;
      }).map(stage => {
        const teamFixture = stage.fixtures?.find(
          f => f.home_team_id === team.id || f.away_team_id === team.id
        );
        return {
          ...stage,
          teamFixture,
          isInRemaining: stage.teams_remaining?.some(t => t.team_id === team.id)
        };
      });

      if (teamStages.length === 0) continue;

      // Find the latest relevant stage based on fixture dates
      const now = new Date();
      const upcomingStages = teamStages.filter(s => {
        const fixtureDate = s.teamFixture?.date ? new Date(s.teamFixture.date) : null;
        return fixtureDate && fixtureDate > now;
      });
      
      let latestStage = null;
      let isStillIn = false;

      if (upcomingStages.length > 0) {
        // Find the earliest upcoming fixture (next match)
        latestStage = upcomingStages.sort((a, b) => {
          const dateA = new Date(a.teamFixture.date);
          const dateB = new Date(b.teamFixture.date);
          return dateA - dateB;
        })[0];
        isStillIn = true;
      } else {
        // All fixtures finished, find the most recent one
        latestStage = teamStages.sort((a, b) => {
          const dateA = a.teamFixture?.date ? new Date(a.teamFixture.date) : new Date(0);
          const dateB = b.teamFixture?.date ? new Date(b.teamFixture.date) : new Date(0);
          return dateB - dateA;
        })[0];
        
        // Check if team won their last fixture
        if (latestStage.teamFixture?.winner_team_id === team.id) {
          isStillIn = true;
        } else if (latestStage.isInRemaining) {
          isStillIn = true;
        } else {
          isStillIn = false;
        }
      }
      
      if (latestStage) {
        competitions.push({
          competition_id: cup.league_id,
          competition_name: cup.league_name,
          competition_slug: cup.league_slug,
          competition_image: cup.league_image,
          season_id: cup.season_id,
          season_name: cup.season_name,
          current_stage: latestStage.stage_name,
          stage_id: latestStage.stage_id,
          is_still_participating: isStillIn,
          last_updated: cup.last_synced
        });
      }
    }
    
    competitions.sort((a, b) => {
      if (a.is_still_participating !== b.is_still_participating) {
        return b.is_still_participating ? 1 : -1;
      }
      return (a.competition_name || '').localeCompare(b.competition_name || '');
    });
    
    console.log('=== API Response ===');
    console.log(JSON.stringify({
      ok: true,
      team: {
        id: team.id,
        name: team.name,
        slug: team.slug
      },
      competitions
    }, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testTeamCompetitionsEndpoint();
