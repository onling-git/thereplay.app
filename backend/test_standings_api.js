// Test the standings API endpoint
require('dotenv').config();
const mongoose = require('mongoose');
const { getStandingsForLeague } = require('./services/standingsService');

const CHAMPIONSHIP_ID = 9;

(async () => {
  try {
    const uri = process.env.DBURI || process.env.MONGODB_URI || process.env.DATABASE_URL;
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB\n');

    console.log('🔍 Testing API service for Championship standings...\n');
    
    const standings = await getStandingsForLeague(CHAMPIONSHIP_ID);
    
    if (!standings) {
      console.log('❌ No standings found');
      return;
    }

    console.log(`✅ Retrieved standings for ${standings.league_name} - ${standings.season_name}`);
    console.log(`   Teams in table: ${standings.table.length}\n`);
    
    // Show first 5 teams with enriched data
    console.log('📊 Top 5 Teams (WITH ENRICHMENT):');
    console.log('='.repeat(80));
    standings.table.slice(0, 5).forEach(team => {
      console.log(`\n${team.position}. ${team.team_name || `Unknown (${team.participant_id})`}`);
      console.log(`   Logo: ${team.team_image ? '✓' : '✗'}`);
      console.log(`   Slug: ${team.team_slug || 'N/A'}`);
      console.log(`   P: ${team.played}, W: ${team.won}, D: ${team.drawn}, L: ${team.lost}`);
      console.log(`   GF: ${team.goals_for}, GA: ${team.goals_against}, GD: ${team.goal_difference > 0 ? '+' : ''}${team.goal_difference}`);
      console.log(`   Pts: ${team.points}`);
      if (team.form && team.form.length > 0) {
        console.log(`   Form: ${team.form.join(' ')}`);
      }
    });

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error);
  } finally {
    await mongoose.disconnect();
  }
})();
