require('dotenv').config();
const mongoose = require('mongoose');
const CupCompetition = require('./models/CupCompetition');
const Team = require('./models/Team');

async function debugSouthamptonCups() {
  try {
    if (!process.env.DBURI) {
      console.error('DBURI environment variable not set!');
      process.exit(1);
    }
    await mongoose.connect(process.env.DBURI);
    console.log('Connected to database');
    
    const team = await Team.findOne({ slug: 'southampton' });
    console.log('\nSouthampton ID:', team?.id);
    
    const faCup = await CupCompetition.findOne({ league_name: 'FA Cup' }).lean();
    
    if (!faCup) {
      console.log('No FA Cup found');
      process.exit(1);
    }
    
    console.log('\n=== FA Cup Details ===');
    console.log('League ID:', faCup.league_id);
    console.log('Season ID:', faCup.season_id);
    console.log('Season Name:', faCup.season_name);
    console.log('Current Stage ID:', faCup.current_stage_id);
    console.log('Current Stage Name:', faCup.current_stage_name);
    
    // Find the Semi-finals stage
    const semiFinals = faCup.stages.find(s => s.stage_name === 'Semi-finals');
    
    if (semiFinals) {
      console.log('\n=== Semi-finals Stage ===');
      console.log('Stage ID:', semiFinals.stage_id);
      console.log('Stage Name:', semiFinals.stage_name);
      console.log('Teams Remaining:', JSON.stringify(semiFinals.teams_remaining, null, 2));
      console.log('Fixtures:', semiFinals.fixtures?.length || 0);
      
      semiFinals.fixtures?.forEach((f, i) => {
        console.log(`\nFixture ${i + 1}:`);
        console.log('  Home:', f.home_team_name, '(ID:', f.home_team_id, ')');
        console.log('  Away:', f.away_team_name, '(ID:', f.away_team_id, ')');
        console.log('  Status:', f.status);
        console.log('  Winner ID:', f.winner_team_id);
      });
    }
    
    // Check all stages sorted by sort_order
    console.log('\n=== All Stages (sorted) ===');
    const sortedStages = [...faCup.stages].sort((a, b) => (b.sort_order || 0) - (a.sort_order || 0));
    sortedStages.forEach(stage => {
      const hasSouthampton = stage.fixtures?.some(
        f => f.home_team_id === team.id || f.away_team_id === team.id
      );
      const inRemaining = stage.teams_remaining?.some(t => t.team_id === team.id);
      
      if (hasSouthampton) {
        console.log(`${stage.stage_name} (Order: ${stage.sort_order})`);
        console.log(`  - Has fixture: ${hasSouthampton}`);
        console.log(`  - In remaining: ${inRemaining}`);
        console.log(`  - Teams remaining count: ${stage.teams_remaining?.length || 0}`);
      }
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

debugSouthamptonCups();
