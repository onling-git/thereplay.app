require('dotenv').config();
const mongoose = require('mongoose');
const CupCompetition = require('./models/CupCompetition');

async function checkFaCupStages() {
  try {
    await mongoose.connect(process.env.DBURI);
    
    const faCup = await CupCompetition.findOne({ league_name: 'FA Cup' }).lean();
    
    console.log('=== FA Cup Stages for Southampton (ID: 65) ===\n');
    
    const southamptonStages = faCup.stages.filter(stage => 
      stage.fixtures?.some(f => f.home_team_id === 65 || f.away_team_id === 65)
    );
    
    southamptonStages.forEach(stage => {
      const fixture = stage.fixtures.find(f => f.home_team_id === 65 || f.away_team_id === 65);
      console.log(`${stage.stage_name} (Sort Order: ${stage.sort_order})`);
      console.log(`  Fixture ID: ${fixture.fixture_id}`);
      console.log(`  ${fixture.home_team_name} vs ${fixture.away_team_name}`);
      console.log(`  Status: ${fixture.status || 'undefined'}`);
      console.log(`  Date: ${fixture.date || 'undefined'}`);
      console.log(`  Home Score: ${fixture.home_score}, Away Score: ${fixture.away_score}`);
      console.log(`  Winner ID: ${fixture.winner_team_id || 'null'}`);
      console.log();
    });
    
    // Sort by date if available
    const withDates = southamptonStages
      .filter(s => s.fixtures?.some(f => f.date))
      .sort((a, b) => {
        const dateA = a.fixtures.find(f => f.home_team_id === 65 || f.away_team_id === 65)?.date;
        const dateB = b.fixtures.find(f => f.home_team_id === 65 || f.away_team_id === 65)?.date;
        return new Date(dateB) - new Date(dateA);
      });
    
    if (withDates.length > 0) {
      const latest = withDates[0];
      const fixture = latest.fixtures.find(f => f.home_team_id === 65 || f.away_team_id === 65);
      console.log('=== Latest by Date ===');
      console.log(`Stage: ${latest.stage_name}`);
      console.log(`Date: ${fixture.date}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkFaCupStages();
