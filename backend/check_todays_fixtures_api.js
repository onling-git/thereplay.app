const { get } = require('./utils/sportmonks');

(async () => {
  try {
    const today = new Date();
    const dateString = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    
    console.log(`Fetching fixtures for date: ${dateString}`);
    
    // Fetch today's fixtures directly by date with includes
    const response = await get(`/fixtures/date/${dateString}`, {
      include: 'league,season,participants'
    });
    const fixtures = response.data?.data || [];
    
    // Log first fixture to see structure
    if (fixtures.length > 0) {
      console.log('\nSample fixture structure:');
      console.log(JSON.stringify(fixtures[0], null, 2));
    }
    
    console.log(`Total fixtures found for ${dateString}: ${fixtures.length}`);
    
    // Filter for FA Cup fixtures (league ID 24)
    const faCupFixtures = fixtures.filter(fixture => 
      fixture.league && fixture.league.id === 24
    );
    
    console.log(`FA Cup fixtures found for ${dateString}: ${faCupFixtures.length}`);
    
    if (faCupFixtures.length > 0) {
      console.log('\n✅ FA Cup fixtures available in SportMonks API:');
      faCupFixtures.forEach((fixture, i) => {
        console.log(`${i + 1}. ${fixture.participants?.[0]?.name || 'Home Team'} vs ${fixture.participants?.[1]?.name || 'Away Team'}`);
        console.log(`   Time: ${fixture.starting_at}`);
        console.log(`   League: ${fixture.league?.name} (ID: ${fixture.league?.id})`);
        console.log(`   Season: ${fixture.season?.name} (ID: ${fixture.season?.id})`);
        console.log('');
      });
      
      // Let's also check what season these fixtures belong to
      const seasonIds = [...new Set(faCupFixtures.map(f => f.season?.id).filter(Boolean))];
      console.log('Season IDs for these FA Cup fixtures:', seasonIds);
      
    } else {
      console.log('❌ No FA Cup fixtures found for today via date endpoint');
      
      // Let's see what leagues are available today
      const leagueIds = [...new Set(fixtures.map(f => f.league?.id).filter(Boolean))];
      console.log(`\nLeagues with fixtures today: ${leagueIds.length}`);
      console.log('League IDs:', leagueIds.slice(0, 20)); // Show first 20
      
      // Check if any fixtures match our available leagues
      const availableLeagues = {
        181: 'Admiral Bundesliga (Austria)',
        208: 'Pro League (Belgium)', 
        244: '1. HNL (Croatia)',
        271: 'Superliga (Denmark)',
        8: 'Premier League (England)',
        24: 'FA Cup (England)',
        9: 'Championship (England)',
        27: 'Carabao Cup (England)'
      };
      
      const matchingFixtures = fixtures.filter(f => 
        availableLeagues.hasOwnProperty(f.league?.id)
      );
      
      console.log(`\nFixtures for our available leagues today: ${matchingFixtures.length}`);
      matchingFixtures.forEach(f => {
        console.log(`- ${availableLeagues[f.league.id]} (${f.league.id}): ${f.participants?.[0]?.name || 'Home'} vs ${f.participants?.[1]?.name || 'Away'}`);
      });
    }
    
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
})();