const axios = require('axios');

async function testTeamNewsIssue() {
  try {
    console.log('Investigating team news issue...\n');
    
    // Get all teams
    console.log('1. Fetching all teams...');
    const teamsResponse = await axios.get('https://virtuous-exploration-production.up.railway.app/api/teams');
    const allTeams = teamsResponse.data.teams || [];
    console.log(`Total teams: ${allTeams.length}\n`);
    
    // Search for Southampton and Reading
    const southampton = allTeams.find(t => 
      t.name?.toLowerCase().includes('southampton')
    );
    const reading = allTeams.find(t => 
      t.name?.toLowerCase().includes('reading')
    );
    
    console.log('Southampton team:', southampton ? `${southampton.name} (${southampton.slug})` : 'NOT FOUND');
    console.log('Reading team:', reading ? `${reading.name} (${reading.slug})` : 'NOT FOUND');
    
    // List teams with 'south' or 'read' in their names
    console.log('\nAll teams with "south" in name:');
    allTeams.filter(t => t.name?.toLowerCase().includes('south')).forEach(t => {
      console.log(`  ${t.name} (${t.slug})`);
    });
    
    console.log('\nAll teams with "read" in name:');
    allTeams.filter(t => t.name?.toLowerCase().includes('read')).forEach(t => {
      console.log(`  ${t.name} (${t.slug})`);
    });
    
    // Test news for various team slugs
    console.log('\n2. Testing news endpoints...');
    
    const testSlugs = ['southampton', 'reading', 'south-coast-united', 'reading-fc'];
    
    for (const slug of testSlugs) {
      try {
        const newsResponse = await axios.get(`https://virtuous-exploration-production.up.railway.app/api/news/team/${slug}?limit=5`);
        console.log(`${slug}: ${newsResponse.data.length} articles`);
      } catch (err) {
        console.log(`${slug}: ERROR - ${err.message}`);
      }
    }
    
    // Check general news
    console.log('\n3. Checking general news...');
    const generalNews = await axios.get('https://virtuous-exploration-production.up.railway.app/api/news?limit=30');
    console.log(`General news: ${generalNews.data.length} articles`);
    
    if (generalNews.data.length > 0) {
      console.log('\nFirst 5 articles:');
      generalNews.data.slice(0, 5).forEach(article => {
        console.log(`  - ${article.title}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response?.data) {
      console.error('Response:', error.response.data);
    }
  }
}

testTeamNewsIssue();
