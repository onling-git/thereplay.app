const { get } = require('./utils/sportmonks');

// Test the cup fixtures sync logic
async function testCupSync() {
  // Cup competition league IDs that might not have proper "current" seasons
  const CUP_LEAGUES = {
    24: 'FA Cup (England)',
    27: 'Carabao Cup (England)',
    390: 'Coppa Italia (Italy)', 
    570: 'Copa Del Rey (Spain)',
    1371: 'UEFA Europa League Play-offs (Europe)'
  };
  
  try {
    const today = new Date();
    const dateString = today.toISOString().split('T')[0];
    
    console.log(`Testing cup fixtures sync for ${dateString}...`);
    
    // Fetch fixtures for today
    const response = await get(`/fixtures/date/${dateString}`, {
      include: 'league,season,participants'
    });
    
    const fixtures = response.data?.data || [];
    console.log(`Total fixtures found for ${dateString}: ${fixtures.length}`);
    
    // Filter for cup competition fixtures
    const cupFixtures = fixtures.filter(fixture => 
      fixture.league && CUP_LEAGUES.hasOwnProperty(fixture.league.id)
    );
    
    console.log(`Cup fixtures found for ${dateString}: ${cupFixtures.length}`);
    
    if (cupFixtures.length > 0) {
      console.log('\n✅ Cup fixtures available in SportMonks API:');
      cupFixtures.forEach((fixture, i) => {
        console.log(`${i + 1}. Competition: ${CUP_LEAGUES[fixture.league.id]} (ID: ${fixture.league.id})`);
        console.log(`   Match: ${fixture.participants?.[0]?.name || 'Home Team'} vs ${fixture.participants?.[1]?.name || 'Away Team'}`);
        console.log(`   Time: ${fixture.starting_at}`);
        console.log(`   Season: ${fixture.season?.name} (ID: ${fixture.season?.id})`);
        console.log(`   Fixture ID: ${fixture.id}`);
        console.log('');
      });
    } else {
      console.log('❌ No cup fixtures found for today via date endpoint');
    }
    
  } catch (e) {
    console.error('Error:', e);
  }
}

testCupSync();