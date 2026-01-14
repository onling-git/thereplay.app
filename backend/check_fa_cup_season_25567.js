const { get } = require('./utils/sportmonks');

(async () => {
  try {
    console.log('Checking for specific FA Cup season 25567...');
    
    // Try to fetch the specific season mentioned in the docs
    try {
      const seasonResponse = await get('/seasons/25567', {
        include: 'league'
      });
      const season = seasonResponse.data?.data;
      
      if (season) {
        console.log('✅ Found FA Cup season 25567:');
        console.log(JSON.stringify(season, null, 2));
      }
    } catch (e) {
      console.log('❌ Season 25567 not found or not accessible');
      console.log('Error:', e.response?.data || e.message);
    }
    
    // Also try fetching fixtures for this specific season
    console.log('\nTrying to fetch fixtures for season 25567...');
    try {
      const fixturesResponse = await get('/fixtures/seasons/25567', {
        include: 'league,participants'
      });
      const fixtures = fixturesResponse.data?.data || [];
      
      console.log(`Found ${fixtures.length} fixtures for season 25567`);
      
      if (fixtures.length > 0) {
        console.log('\nSample fixtures:');
        fixtures.slice(0, 5).forEach((fixture, i) => {
          console.log(`${i + 1}. ${fixture.participants?.[0]?.name || 'Home'} vs ${fixture.participants?.[1]?.name || 'Away'}`);
          console.log(`   Date: ${fixture.starting_at}`);
          console.log(`   League: ${fixture.league?.name} (ID: ${fixture.league?.id})`);
        });
      }
    } catch (e) {
      console.log('❌ Could not fetch fixtures for season 25567');
      console.log('Error:', e.response?.data || e.message);
    }
    
    // Let's also try the schedules endpoint for this season
    console.log('\nTrying schedules endpoint for season 25567...');
    try {
      const schedulesResponse = await get('/schedules/seasons/25567');
      const schedules = schedulesResponse.data?.data || [];
      
      console.log(`Found ${schedules.length} schedule stages for season 25567`);
      
      if (schedules.length > 0) {
        console.log('\nSchedule stages:');
        schedules.forEach((stage, i) => {
          console.log(`${i + 1}. ${stage.name} (ID: ${stage.id})`);
          console.log(`   Rounds: ${stage.rounds?.length || 0}`);
        });
      }
    } catch (e) {
      console.log('❌ Could not fetch schedules for season 25567');
      console.log('Error:', e.response?.data || e.message);
    }
    
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
})();