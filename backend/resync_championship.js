// Re-sync Championship standings with fixed parser
require('dotenv').config();
const mongoose = require('mongoose');
const { syncStandingsByLeague } = require('./services/standingsService');

const CHAMPIONSHIP_ID = 9;

(async () => {
  try {
    const uri = process.env.DBURI || process.env.MONGODB_URI || process.env.DATABASE_URL;
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB\n');

    console.log(`🔄 Re-syncing Championship (ID: ${CHAMPIONSHIP_ID}) standings with FIXED parser...\n`);
    
    const result = await syncStandingsByLeague(CHAMPIONSHIP_ID);
    
    if (result) {
      console.log('\n✅ Sync complete!');
      console.log(`   League: ${result.league_name}`);
      console.log(`   Season: ${result.season_name}`);
      console.log(`   Teams: ${result.table.length}`);
      
      // Show a few sample entries to verify
      console.log('\n📊 Sample entries (first 3):');
      result.table.slice(0, 3).forEach(team => {
        console.log(`\n${team.position}. Participant ${team.participant_id}:`);
        console.log(`   Played: ${team.played}, Won: ${team.won}, Drawn: ${team.drawn}, Lost: ${team.lost}`);
        console.log(`   GF: ${team.goals_for}, GA: ${team.goals_against}, GD: ${team.goal_difference}`);
        console.log(`   Points: ${team.points}`);
        console.log(`   Verification: ${team.won}*3 + ${team.drawn}*1 = ${team.won*3 + team.drawn} (should be ${team.points})`);
      });
    } else {
      console.log('❌ Sync failed');
    }

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
})();
