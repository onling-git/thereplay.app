const { get } = require('./utils/sportmonks');

(async () => {
  try {
    console.log('Doing comprehensive search for FA Cup seasons...');
    
    // First, let's search for all seasons more thoroughly
    let allSeasons = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore && page <= 50) { // Check more pages
      console.log(`Checking page ${page}...`);
      const response = await get(`/seasons?page=${page}&per_page=100`);
      const seasons = response.data?.data || [];
      const pagination = response.data?.pagination;
      
      allSeasons.push(...seasons);
      
      hasMore = pagination?.has_more === true || (pagination?.next_page && seasons.length > 0);
      page++;
      
      // Add a small delay to avoid rate limiting
      if (hasMore) await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`Total seasons found: ${allSeasons.length}`);
    
    // Filter for FA Cup seasons (league ID 24)
    const faCupSeasons = allSeasons.filter(season => season.league_id === 24);
    console.log(`FA Cup seasons found: ${faCupSeasons.length}`);
    
    // Look for current seasons
    const currentFaCupSeasons = faCupSeasons.filter(season => season.is_current === true);
    
    console.log('\nAll FA Cup seasons:');
    faCupSeasons.forEach(season => {
      console.log(`- ${season.name} (ID: ${season.id}) - Current: ${season.is_current} - Starting: ${season.starting_at} - Ending: ${season.ending_at}`);
    });
    
    console.log(`\nCurrent FA Cup seasons: ${currentFaCupSeasons.length}`);
    
    if (currentFaCupSeasons.length > 0) {
      currentFaCupSeasons.forEach(season => {
        console.log('✅ Found current FA Cup season:', {
          id: season.id,
          name: season.name,
          is_current: season.is_current,
          starting_at: season.starting_at,
          ending_at: season.ending_at
        });
      });
    } else {
      console.log('❌ No current FA Cup seasons found');
      
      // Let's also check for recent seasons that might be incorrectly marked
      const recentSeasons = faCupSeasons.filter(season => {
        const startYear = new Date(season.starting_at).getFullYear();
        return startYear >= 2024; // Check for 2024/25 and 2025/26 seasons
      });
      
      console.log('\nRecent FA Cup seasons (2024+):');
      recentSeasons.forEach(season => {
        console.log(`- ${season.name} (ID: ${season.id}) - Current: ${season.is_current}`);
      });
    }
    
    // Also check what the current season structure looks like for other leagues
    const currentSeasons = allSeasons.filter(season => season.is_current === true);
    console.log(`\nTotal current seasons across all leagues: ${currentSeasons.length}`);
    
    // Sample a few current seasons to see the pattern
    const sampleCurrent = currentSeasons.slice(0, 5);
    console.log('\nSample current seasons:');
    sampleCurrent.forEach(season => {
      console.log(`- ${season.name} (League ID: ${season.league_id}) - Starting: ${season.starting_at}`);
    });
    
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
})();