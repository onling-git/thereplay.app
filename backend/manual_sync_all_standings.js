// Manual script to sync all league standings
require('dotenv').config();
const mongoose = require('mongoose');
const { syncMultipleLeagues } = require('./services/standingsService');

const AVAILABLE_LEAGUES = {
  181: 'Admiral Bundesliga (Austria)',
  208: 'Pro League (Belgium)', 
  244: '1. HNL (Croatia)',
  271: 'Superliga (Denmark)',
  8: 'Premier League (England)',
  24: 'FA Cup (England)',
  9: 'Championship (England)',
  27: 'Carabao Cup (England)',
  1371: 'UEFA Europa League Play-offs (Europe)',
  301: 'Ligue 1 (France)',
  82: 'Bundesliga (Germany)',
  387: 'Serie B (Italy)',
  384: 'Serie A (Italy)',
  390: 'Coppa Italia (Italy)',
  72: 'Eredivisie (Netherlands)',
  444: 'Eliteserien (Norway)',
  453: 'Ekstraklasa (Poland)',
  462: 'Liga Portugal (Portugal)',
  486: 'Premier League (Russia)',
  501: 'Premiership (Scotland)',
  570: 'Copa Del Rey (Spain)',
  567: 'La Liga 2 (Spain)',
  564: 'La Liga (Spain)',
  573: 'Allsvenskan (Sweden)',
  591: 'Super League (Switzerland)',
  600: 'Super Lig (Turkey)',
  609: 'Premier League (Ukraine)'
};

async function main() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.DBURI);
    console.log('✅ Connected');
    
    const leagueIds = Object.keys(AVAILABLE_LEAGUES).map(id => parseInt(id));
    console.log(`\nSyncing standings for ${leagueIds.length} leagues...\n`);
    
    const results = await syncMultipleLeagues(leagueIds, 2000); // 2 second delay
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log('\n========================================');
    console.log(`✅ COMPLETE: ${successful} succeeded, ${failed} failed`);
    console.log('========================================\n');
    
    if (failed > 0) {
      console.log('Failed leagues:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`  - League ${r.league_id}: ${r.error}`);
      });
    }
    
    await mongoose.disconnect();
    console.log('Database disconnected');
    process.exit(0);
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
