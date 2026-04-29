require('dotenv').config();
const sportmonks = require('./utils/sportmonks');

async function checkTotalLeagues() {
  try {
    console.log('🔍 Fetching all leagues from Sportmonks API...\n');
    
    let allLeagues = [];
    let currentPage = 1;
    let hasMore = true;
    
    while (hasMore) {
      console.log(`Fetching page ${currentPage}...`);
      const response = await sportmonks.get('/leagues', {
        include: 'currentseason',
        per_page: 100,
        page: currentPage
      });
      
      const pageLeagues = response.data?.data || [];
      allLeagues = allLeagues.concat(pageLeagues);
      
      const pagination = response.data?.pagination;
      hasMore = pagination?.has_more || false;
      
      console.log(`  Page ${currentPage}: ${pageLeagues.length} leagues (Total so far: ${allLeagues.length})`);
      console.log(`  Has more: ${hasMore}\n`);
      
      currentPage++;
      
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    console.log(`\n📊 TOTAL LEAGUES: ${allLeagues.length}\n`);
    
    // Filter by current season
    const withCurrentSeason = allLeagues.filter(l => l.currentseason);
    console.log(`✅ Leagues with current season: ${withCurrentSeason.length}`);
    
    // Group by type
    const byType = allLeagues.reduce((acc, league) => {
      const type = league.sub_type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    
    console.log('\n📋 Breakdown by type:');
    Object.entries(byType).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });
    
    // Show leagues with current seasons
    console.log(`\n🏆 Leagues with current season (first 50):\n`);
    withCurrentSeason.slice(0, 50).forEach(league => {
      console.log(`   ${league.name} (ID: ${league.id}) - ${league.sub_type} - ${league.currentseason.name}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkTotalLeagues();
