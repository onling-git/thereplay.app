const { get } = require('./utils/sportmonks');

(async () => {
  try {
    console.log('Checking FA Cup current season...');
    
    // Fetch current seasons and filter for FA Cup (league ID 24)
    let allSeasons = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore && page <= 5) { // Just check first few pages
      const response = await get(`/seasons?page=${page}&per_page=100`);
      const seasons = response.data?.data || [];
      const pagination = response.data?.pagination;
      
      allSeasons.push(...seasons);
      
      hasMore = pagination?.has_more === true || (pagination?.next_page && seasons.length > 0);
      page++;
    }
    
    // Filter for FA Cup seasons
    const faCupSeasons = allSeasons.filter(season => season.league_id === 24);
    const currentFaCupSeasons = faCupSeasons.filter(season => season.is_current === true);
    
    console.log('All FA Cup seasons found:', faCupSeasons.length);
    console.log('Current FA Cup seasons:', currentFaCupSeasons.length);
    
    if (currentFaCupSeasons.length > 0) {
      currentFaCupSeasons.forEach(season => {
        console.log('Current FA Cup Season:', {
          id: season.id,
          name: season.name,
          is_current: season.is_current,
          starting_at: season.starting_at,
          ending_at: season.ending_at
        });
      });
    }
    
    if (faCupSeasons.length > 0) {
      console.log('\nAll FA Cup seasons (last 5):');
      faCupSeasons.slice(-5).forEach(season => {
        console.log(`- ${season.name} (ID: ${season.id}) - Current: ${season.is_current}`);
      });
    }
    
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
})();