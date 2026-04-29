// Check standings endpoint testing each include individually
require('dotenv').config();
const { get } = require('./utils/sportmonks');

const PREMIER_LEAGUE_ID = 8;

(async () => {
  try {
    console.log('='.repeat(80));
    console.log('🏆 TESTING STANDINGS INCLUDES INDIVIDUALLY');
    console.log('='.repeat(80));
    console.log('\n');

    // Get current season
    const leagueResponse = await get(`/leagues/${PREMIER_LEAGUE_ID}`, {
      include: 'currentseason'
    });
    
    const currentSeason = leagueResponse.data?.data?.currentseason;
    console.log(`Season: ${currentSeason.name} (ID: ${currentSeason.id})\n`);

    // Test each include individually
    const includesToTest = ['participant', 'season', 'league', 'stage', 'group', 'round', 'rule', 'details', 'form'];

    for (const includeParam of includesToTest) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`Testing include: ${includeParam}`);
      console.log('='.repeat(80));
      
      try {
        const response = await get(`/standings/seasons/${currentSeason.id}`, {
          include: includeParam
        });
        
        const standings = response.data?.data;
        if (standings && standings.length > 0) {
          console.log(`✅ SUCCESS - ${includeParam} works!`);
          console.log(`Extra fields added:`, Object.keys(standings[0]).filter(key => 
            !['id', 'participant_id', 'sport_id', 'league_id', 'season_id', 'stage_id', 
             'group_id', 'round_id', 'standing_rule_id', 'position', 'result', 'points'].includes(key)
          ));
          console.log('\nSample data for first team:');
          console.log(JSON.stringify(standings[0], null, 2).substring(0, 2000));
        }
      } catch (error) {
        console.log(`❌ FAILED - ${includeParam} doesn't work or not in plan`);
        if (error.response?.data?.message) {
          console.log(`   Reason: ${error.response.data.message}`);
        }
      }
      
      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 200));
    }

    console.log('\n');
    console.log('='.repeat(80));
    console.log('✅ INCLUDE TESTING COMPLETE');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ ERROR:', error);
    process.exit(1);
  }
})();
