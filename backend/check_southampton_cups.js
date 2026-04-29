require('dotenv').config();
const mongoose = require('mongoose');
const CupCompetition = require('./models/CupCompetition');
const Team = require('./models/Team');

async function checkSouthamptonCups() {
  try {
    if (!process.env.DBURI) {
      console.error('DBURI environment variable not set!');
      process.exit(1);
    }
    await mongoose.connect(process.env.DBURI);
    console.log('Connected to database');
    
    const team = await Team.findOne({ slug: 'southampton' });
    console.log('\n=== Southampton Team ===');
    console.log('ID:', team?.id);
    console.log('Name:', team?.name);
    console.log('Slug:', team?.slug);
    
    if (!team) {
      console.log('Southampton team not found!');
      process.exit(1);
    }
    
    console.log('\n=== Searching for Cup Competitions ===');
    const cups = await CupCompetition.find({
      $or: [
        { 'stages.fixtures.home_team_id': team.id },
        { 'stages.fixtures.away_team_id': team.id },
        { 'stages.teams_remaining.team_id': team.id }
      ]
    }).lean();
    
    console.log('Found', cups.length, 'cup competitions\n');
    
    cups.forEach(cup => {
      console.log('---');
      console.log('Competition:', cup.league_name);
      console.log('Season:', cup.season_name);
      console.log('Stages:', cup.stages?.length || 0);
      
      // Find stages with Southampton
      cup.stages?.forEach(stage => {
        const hasFixture = stage.fixtures?.some(
          f => f.home_team_id === team.id || f.away_team_id === team.id
        );
        const isInRemaining = stage.teams_remaining?.some(t => t.team_id === team.id);
        
        if (hasFixture || isInRemaining) {
          console.log(`  - ${stage.stage_name} (ID: ${stage.stage_id})`);
          console.log(`    Has fixture: ${hasFixture}, In remaining: ${isInRemaining}`);
        }
      });
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkSouthamptonCups();
