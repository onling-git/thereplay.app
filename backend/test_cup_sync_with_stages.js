const { get } = require('./utils/sportmonks');
const { normaliseFixtureToMatchDoc } = require('./utils/normaliseFixture');

async function testCupSyncWithStages() {
  console.log('🧪 Testing cup fixtures sync with stage/round data...');
  
  const today = new Date();
  const dateString = today.toISOString().split('T')[0];
  
  try {
    console.log(`📅 Fetching fixtures for ${dateString} with stage/round data...`);
    
    // Fetch fixtures with stage and round information
    const response = await get(`/fixtures/date/${dateString}`, {
      include: 'league,season,participants,stage,round'
    });
    
    const fixtures = response.data?.data || [];
    console.log(`📊 Total fixtures found: ${fixtures.length}`);
    
    // Check for any fixture with stage data to test
    const fixturesWithStages = fixtures.filter(f => f.stage_id || f.stage);
    console.log(`🏆 Fixtures with stage data: ${fixturesWithStages.length}`);
    
    if (fixturesWithStages.length > 0) {
      console.log('\n📋 Sample fixtures with stages:');
      fixturesWithStages.slice(0, 3).forEach((fixture, i) => {
        console.log(`\n${i + 1}. ${fixture.name || 'Match'} (ID: ${fixture.id})`);
        console.log(`   League: ${fixture.league?.name || 'Unknown'} (${fixture.league_id})`);
        console.log(`   Stage ID: ${fixture.stage_id}`);
        console.log(`   Round ID: ${fixture.round_id}`);
        console.log(`   Stage Object:`, fixture.stage);
        console.log(`   Round Object:`, fixture.round);
      });
      
      // Test normalization of first fixture
      console.log('\n🔄 Testing fixture normalization...');
      const testFixture = fixturesWithStages[0];
      const normalized = normaliseFixtureToMatchDoc(testFixture);
      
      if (normalized) {
        console.log('✅ Normalization successful!');
        console.log(`   Match ID: ${normalized.match_id}`);
        console.log(`   Teams: ${normalized.teams?.home?.team_name} vs ${normalized.teams?.away?.team_name}`);
        console.log(`   League: ${normalized.match_info?.league?.name}`);
        console.log(`   Stage:`, normalized.match_info?.stage);
        console.log(`   Round:`, normalized.match_info?.round);
      } else {
        console.log('❌ Normalization failed');
      }
      
    } else {
      console.log('ℹ️ No fixtures with stage data found for today. Trying some cup leagues...');
      
      // Filter for known cup leagues
      const cupLeagues = [24, 27, 390, 570, 1371]; // FA Cup, Carabao, etc.
      const cupFixtures = fixtures.filter(f => cupLeagues.includes(f.league_id));
      
      if (cupFixtures.length > 0) {
        console.log(`🏆 Cup competition fixtures: ${cupFixtures.length}`);
        cupFixtures.forEach((fixture, i) => {
          console.log(`${i + 1}. ${fixture.name || 'Match'} (League: ${fixture.league_id})`);
          console.log(`   Stage ID: ${fixture.stage_id || 'None'}`);
        });
      } else {
        console.log('ℹ️ No cup fixtures found for today');
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing cup sync:', error.message);
  }
}

testCupSyncWithStages();