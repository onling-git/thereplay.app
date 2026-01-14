const axios = require('axios');

async function investigateTeams() {
  try {
    console.log('Investigating teams database...\n');
    
    const teamsResponse = await axios.get('https://virtuous-exploration-production.up.railway.app/api/teams');
    const allTeams = teamsResponse.data.teams || [];
    
    console.log(`Total teams in DB: ${allTeams.length}\n`);
    
    // Get unique league IDs and counts
    const leagueMap = {};
    allTeams.forEach(team => {
      const league = team.league_id || team.league_name || 'unknown';
      leagueMap[league] = (leagueMap[league] || 0) + 1;
    });
    
    console.log('Teams by league:');
    Object.entries(leagueMap).forEach(([league, count]) => {
      console.log(`  ${league}: ${count} teams`);
    });
    
    // Search for common teams
    console.log('\n\nSearching for specific teams:');
    const searchTerms = ['southampton', 'reading', 'arsenal', 'liverpool', 'manchester', 'newcastle', 'brighton'];
    
    searchTerms.forEach(term => {
      const matches = allTeams.filter(t => 
        t.name?.toLowerCase().includes(term) ||
        t.slug?.toLowerCase().includes(term)
      );
      
      if (matches.length > 0) {
        console.log(`\n${term}:`);
        matches.forEach(m => {
          console.log(`  - ${m.name} (${m.slug}) [League: ${m.league_name || m.league_id || 'unknown'}]`);
        });
      } else {
        console.log(`\n${term}: NOT FOUND`);
      }
    });
    
    // List ALL teams
    console.log('\n\nALL TEAMS:');
    allTeams.forEach((t, i) => {
      console.log(`${i + 1}. ${t.name} (${t.slug})`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

investigateTeams();
