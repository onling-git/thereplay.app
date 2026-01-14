const axios = require('axios');

async function testTeamNews() {
  try {
    console.log('Testing team news endpoint...\n');
    
    // Test 1: Get all teams and find Southampton
    console.log('1. Fetching all teams...');
    const teamsResponse = await axios.get('https://virtuous-exploration-production.up.railway.app/api/teams');
    console.log('Teams response status:', teamsResponse.status);
    console.log('Teams response data type:', typeof teamsResponse.data);
    console.log('Teams response data:', JSON.stringify(teamsResponse.data).substring(0, 200));
    
    const teams = teamsResponse.data.teams || [];
    console.log(`Found ${teams.length} teams total`);
    
    console.log('\nFirst 10 teams:');
    teams.slice(0, 10).forEach(team => {
      console.log(`  ${team.name} (slug: ${team.slug})`);
    });
    
    const southamptonTeams = teams.filter(team => 
      team.name?.toLowerCase().includes('south') || 
      team.slug?.toLowerCase().includes('south') ||
      team.name?.toLowerCase().includes('saints')
    );
    
    console.log('\nTeams matching "south" or "saints":');
    southamptonTeams.forEach(team => {
      console.log(`  ${team.name} (slug: ${team.slug})`);
    });
    
    // Also search for common Premier League teams
    console.log('\nCommon Premier League teams:');
    ['manchester', 'liverpool', 'arsenal', 'chelsea', 'city'].forEach(term => {
      const matches = teams.filter(team => 
        team.name?.toLowerCase().includes(term) || 
        team.slug?.toLowerCase().includes(term)
      );
      if (matches.length > 0) {
        console.log(`  ${term}: ${matches.map(t => t.name).join(', ')}`);
      }
    });
    
    // Test 2: Test news endpoint with 'southampton' slug
    console.log('\n2. Testing /api/news/team/southampton...');
    const newsResponse = await axios.get('https://virtuous-exploration-production.up.railway.app/api/news/team/southampton?limit=10');
    console.log(`Response: ${newsResponse.data.length} articles`);
    
    // Test 3: Test general news to see if any Southampton articles appear
    console.log('\n3. Testing general news for Southampton mentions...');
    const generalNewsResponse = await axios.get('https://virtuous-exploration-production.up.railway.app/api/news?limit=50');
    const southamptonArticles = generalNewsResponse.data.filter(article =>
      article.title?.toLowerCase().includes('southampton') ||
      article.summary?.toLowerCase().includes('southampton') ||
      article.title?.toLowerCase().includes('saints') ||
      article.summary?.toLowerCase().includes('saints')
    );
    
    console.log(`Found ${southamptonArticles.length} Southampton-related articles in general news:`);
    southamptonArticles.slice(0, 3).forEach(article => {
      console.log(`  - ${article.title}`);
      console.log(`    ${article.summary.substring(0, 100)}...`);
    });
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testTeamNews();