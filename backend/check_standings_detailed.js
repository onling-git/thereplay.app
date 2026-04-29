// Check standings endpoint with all available includes
require('dotenv').config();
const { get } = require('./utils/sportmonks');

const PREMIER_LEAGUE_ID = 8;  // English Premier League

(async () => {
  try {
    console.log('='.repeat(80));
    console.log('🏆 TESTING STANDINGS WITH ALL INCLUDES');
    console.log('='.repeat(80));
    console.log('\n');

    // Get current season
    const leagueResponse = await get(`/leagues/${PREMIER_LEAGUE_ID}`, {
      include: 'currentseason'
    });
    
    const currentSeason = leagueResponse.data?.data?.currentseason;
    if (!currentSeason) {
      console.log('❌ No current season found');
      return;
    }
    
    console.log(`Season: ${currentSeason.name} (ID: ${currentSeason.id})`);
    console.log('\n');

    // Test with all available includes from documentation
    const includes = [
      'participant',
      'season',
      'league', 
      'stage',
      'group',
      'round',
      'rule'
    ].join(',');

    console.log(`📊 Fetching standings with includes: ${includes}`);
    console.log('\n');

    const standingsResponse = await get(`/standings/seasons/${currentSeason.id}`, {
      include: includes
    });
    
    const standings = standingsResponse.data?.data;

    if (!Array.isArray(standings) || standings.length === 0) {
      console.log('❌ No standings data found');
      return;
    }

    console.log('✅ Retrieved standings for', standings.length, 'teams\n');

    // Display first team with all fields
    console.log('📋 FULL STRUCTURE FOR FIRST TEAM:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(standings[0], null, 2));
    console.log('\n');

    // Display all available fields
    console.log('🔑 AVAILABLE FIELDS IN STANDING OBJECT:');
    console.log('='.repeat(80));
    const allKeys = Object.keys(standings[0]);
    allKeys.forEach(key => {
      console.log(`  - ${key}:`, typeof standings[0][key]);
    });
    console.log('\n');

    // Try to fetch standing details endpoint (if available)
    console.log('🔍 Testing individual standing endpoint...');
    try {
      const standingId = standings[0].id;
      const detailResponse = await get(`/standings/${standingId}`, {
        include: 'details'
      });
      console.log('Standing detail response:');
      console.log(JSON.stringify(detailResponse.data?.data, null, 2));
    } catch (error) {
      console.log('Individual standing endpoint not available or requires different plan');
      console.log(error.response?.data || error.message);
    }

    console.log('\n');
    console.log('='.repeat(80));
    console.log('✅ DETAILED STANDINGS CHECK COMPLETE');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ ERROR:', error);
    if (error.response?.data) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
})();
