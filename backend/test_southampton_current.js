require('dotenv').config();
const mongoose = require('mongoose');
const Team = require('./models/Team');
const CupCompetition = require('./models/CupCompetition');

async function testSouthamptonCompetitions() {
  try {
    await mongoose.connect(process.env.DBURI);
    
    const team = await Team.findOne({ slug: 'southampton' }).lean();
    const cupCompetitions = await CupCompetition.find({
      $or: [
        { 'stages.fixtures.home_team_id': team.id },
        { 'stages.fixtures.away_team_id': team.id },
        { 'stages.teams_remaining.team_id': team.id }
      ]
    }).lean();
    
    const now = new Date();
    console.log('Current date:', now.toISOString(), '\n');
    
    for (const cup of cupCompetitions) {
      console.log('=== ' + cup.league_name + ' ===');
      
      const teamStages = cup.stages.filter(stage => {
        const hasFixture = stage.fixtures?.some(
          f => f.home_team_id === team.id || f.away_team_id === team.id
        );
        return hasFixture;
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
      
      console.log('Found', teamStages.length, 'stages with Southampton\n');
      
      // Check upcoming vs past
      const upcomingStages = teamStages.filter(s => {
        const fixtureDate = s.teamFixture?.date ? new Date(s.teamFixture.date) : null;
        const isUpcoming = fixtureDate && fixtureDate > now;
        const statusCheck = !s.teamFixture.status || s.teamFixture.status === 'NS' || s.teamFixture.status === 'LIVE';
        console.log(`  ${s.stage_name}:`);
        console.log(`    Date: ${fixtureDate?.toISOString() || 'none'}`);
        console.log(`    Status: ${s.teamFixture.status || 'undefined'}`);
        console.log(`    Is future: ${isUpcoming}`);
        console.log(`    Status check: ${statusCheck}`);
        return statusCheck;
      });
      
      console.log('\nUpcoming stages (by status):', upcomingStages.length);
      
      if (upcomingStages.length > 0) {
        const sorted = upcomingStages.sort((a, b) => {
          const dateA = a.teamFixture?.date ? new Date(a.teamFixture.date) : new Date(0);
          const dateB = b.teamFixture?.date ? new Date(b.teamFixture.date) : new Date(0);
          return dateA - dateB;
        });
        console.log('Earliest upcoming:', sorted[0].stage_name, new Date(sorted[0].teamFixture.date).toISOString());
      }
      
      console.log('\n---\n');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testSouthamptonCompetitions();
