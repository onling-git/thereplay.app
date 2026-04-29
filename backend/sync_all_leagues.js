// Sync all major English football leagues and cups
require('dotenv').config();
const mongoose = require('mongoose');
const { syncMultipleLeagues } = require('./services/standingsService');

// Major English football leagues and cups
const LEAGUES_TO_SYNC = [
  { id: 8, name: 'Premier League' },
  { id: 9, name: 'Championship' },
  { id: 10, name: 'League One' },
  { id: 11, name: 'League Two' },
  { id: 27, name: 'Carabao Cup (EFL Cup)' },
  { id: 19, name: 'FA Cup' },
  // Add more if needed
];

(async () => {
  try {
    const uri = process.env.DBURI || process.env.MONGODB_URI || process.env.DATABASE_URL;
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB\n');

    console.log('🔄 Syncing all major English football leagues...\n');
    console.log('Leagues to sync:');
    LEAGUES_TO_SYNC.forEach(league => {
      console.log(`  - ${league.name} (ID: ${league.id})`);
    });
    console.log('\n' + '='.repeat(80) + '\n');

    const leagueIds = LEAGUES_TO_SYNC.map(l => l.id);
    const results = await syncMultipleLeagues(leagueIds);
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 SYNC SUMMARY');
    console.log('='.repeat(80));
    
    let successCount = 0;
    let failCount = 0;
    
    results.forEach((result, idx) => {
      const league = LEAGUES_TO_SYNC[idx];
      if (result.success) {
        successCount++;
        console.log(`✅ ${league.name}`);
        if (result.standing) {
          console.log(`   Season: ${result.standing.season_name}`);
          console.log(`   Teams: ${result.standing.table?.length || 0}`);
        }
      } else {
        failCount++;
        console.log(`❌ ${league.name}`);
        console.log(`   Error: ${result.error}`);
      }
    });
    
    console.log('\n' + '='.repeat(80));
    console.log(`Total: ${results.length} leagues`);
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ FATAL ERROR:', error.message);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
})();
