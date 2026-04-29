// Re-sync Premier League standings with fixed parser
require('dotenv').config();
const mongoose = require('mongoose');
const { syncStandingsByLeague } = require('./services/standingsService');

const PREMIER_LEAGUE_ID = 8;

(async () => {
  try {
    const uri = process.env.DBURI || process.env.MONGODB_URI || process.env.DATABASE_URL;
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB\n');

    console.log(`🔄 Re-syncing Premier League (ID: ${PREMIER_LEAGUE_ID}) standings...\n`);
    
    const result = await syncStandingsByLeague(PREMIER_LEAGUE_ID);
    
    if (result) {
      console.log('\n✅ Sync complete!');
      console.log(`   League: ${result.league_name}`);
      console.log(`   Season: ${result.season_name}`);
      console.log(`   Teams: ${result.table.length}`);
      
      // Show top 5 to verify
      console.log('\n📊 Top 5:');
      result.table.slice(0, 5).forEach(team => {
        console.log(`${team.position}. P:${team.played} W:${team.won} D:${team.drawn} L:${team.lost} Pts:${team.points}`);
        console.log(`   Verification: ${team.won}*3 + ${team.drawn} = ${team.won*3 + team.drawn} (should be ${team.points})`);
      });
    } else {
      console.log('❌ Sync failed');
    }

  } catch (error) {
    console.error('❌ ERROR:', error.message);
  } finally {
    await mongoose.disconnect();
  }
})();
