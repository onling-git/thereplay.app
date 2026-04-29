// Sync major European leagues
require('dotenv').config();
const mongoose = require('mongoose');
const { syncMultipleLeagues } = require('./services/standingsService');

// Major European football leagues
const EUROPEAN_LEAGUES = [
  // England
  { id: 8, name: 'Premier League (England)' },
  { id: 9, name: 'Championship (England)' },
  
  // Spain
  { id: 564, name: 'La Liga (Spain)' },
  { id: 565, name: 'Segunda División (Spain)' },
  
  // Germany
  { id: 82, name: 'Bundesliga (Germany)' },
  { id: 83, name: '2. Bundesliga (Germany)' },
  
  // Italy
  { id: 384, name: 'Serie A (Italy)' },
  { id: 387, name: 'Serie B (Italy)' },
  
  // France
  { id: 301, name: 'Ligue 1 (France)' },
  { id: 302, name: 'Ligue 2 (France)' },
  
  // Portugal
  { id: 462, name: 'Primeira Liga (Portugal)' },
  
  // Netherlands
  { id: 271, name: 'Eredivisie (Netherlands)' },
  
  // Scotland
  { id: 501, name: 'Premiership (Scotland)' },
  
  // European Competitions
  { id: 2, name: 'UEFA Champions League' },
  { id: 5, name: 'UEFA Europa League' },
];

(async () => {
  try {
    const uri = process.env.DBURI || process.env.MONGODB_URI || process.env.DATABASE_URL;
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB\n');

    console.log('🌍 Syncing major European football leagues...\n');
    console.log('Leagues to sync:');
    EUROPEAN_LEAGUES.forEach(league => {
      console.log(`  - ${league.name}`);
    });
    console.log('\n' + '='.repeat(80) + '\n');

    const leagueIds = EUROPEAN_LEAGUES.map(l => l.id);
    const results = await syncMultipleLeagues(leagueIds);
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 SYNC SUMMARY');
    console.log('='.repeat(80));
    
    let successCount = 0;
    let failCount = 0;
    let noDataCount = 0;
    
    results.forEach((result, idx) => {
      const league = EUROPEAN_LEAGUES[idx];
      if (result.success) {
        if (result.standing) {
          successCount++;
          console.log(`✅ ${league.name}`);
          console.log(`   Season: ${result.standing.season_name}, Teams: ${result.standing.table?.length || 0}`);
        } else {
          noDataCount++;
          console.log(`⚠️  ${league.name} - No standings data`);
        }
      } else {
        failCount++;
        console.log(`❌ ${league.name}`);
        console.log(`   Error: ${result.error}`);
      }
    });
    
    console.log('\n' + '='.repeat(80));
    console.log(`Total: ${results.length} leagues`);
    console.log(`Success (with data): ${successCount}`);
    console.log(`No data available: ${noDataCount}`);
    console.log(`Failed: ${failCount}`);
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ FATAL ERROR:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
})();
