require('dotenv').config();
const mongoose = require('mongoose');
const sportmonks = require('./utils/sportmonks');
const standingsService = require('./services/standingsService');

async function getAllAvailableLeagues() {
  try {
    console.log('🔍 Fetching all available leagues from Sportmonks...\n');
    
    let allLeagues = [];
    let currentPage = 1;
    let hasMore = true;
    
    // Fetch all pages
    while (hasMore) {
      console.log(`   Fetching page ${currentPage}...`);
      const response = await sportmonks.get('/leagues', {
        include: 'currentseason',
        per_page: 100,
        page: currentPage
      });
      
      const pageLeagues = response.data?.data || [];
      allLeagues = allLeagues.concat(pageLeagues);
      
      // Check if there are more pages
      const pagination = response.data?.pagination;
      hasMore = pagination?.has_more || false;
      currentPage++;
      
      console.log(`   Got ${pageLeagues.length} leagues (total: ${allLeagues.length})`);
      
      // Small delay to avoid rate limiting
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    console.log(`\n📋 Found ${allLeagues.length} total leagues on Sportmonks\n`);
    
    // Filter to only leagues that have a current season
    const leaguesWithCurrentSeason = allLeagues.filter(league => league.currentseason);
    console.log(`✅ ${leaguesWithCurrentSeason.length} leagues have a current season\n`);
    
    return leaguesWithCurrentSeason;
  } catch (error) {
    console.error('❌ Error fetching leagues:', error.message);
    return [];
  }
}

async function syncAllLeagues() {
  try {
    const uri = process.env.DBURI || process.env.MONGODB_URI || process.env.DATABASE_URL;
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB\n');
    
    const leagues = await getAllAvailableLeagues();
    
    if (leagues.length === 0) {
      console.log('⚠️  No leagues found to sync');
      return;
    }
    
    console.log('🌍 Starting sync for all available leagues...\n');
    console.log('================================================================================\n');
    
    const results = {
      success: [],
      noData: [],
      failed: []
    };
    
    for (let i = 0; i < leagues.length; i++) {
      const league = leagues[i];
      console.log(`[${i + 1}/${leagues.length}] Syncing ${league.name} (ID: ${league.id})...`);
      
      try {
        const result = await standingsService.syncStandingsByLeague(league.id);
        
        if (result && result.entries && result.entries.length > 0) {
          console.log(`   ✅ Success: ${result.entries.length} teams synced\n`);
          results.success.push({
            id: league.id,
            name: league.name,
            teams: result.entries.length
          });
        } else {
          console.log(`   ⚠️  No standings data available\n`);
          results.noData.push({
            id: league.id,
            name: league.name
          });
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}\n`);
        results.failed.push({
          id: league.id,
          name: league.name,
          error: error.message
        });
      }
    }
    
    // Print summary
    console.log('\n================================================================================');
    console.log('📊 SYNC SUMMARY');
    console.log('================================================================================\n');
    
    if (results.success.length > 0) {
      console.log(`✅ Successfully synced (${results.success.length} leagues):\n`);
      results.success.forEach(league => {
        console.log(`   🏆 ${league.name} (ID: ${league.id}) - ${league.teams} teams`);
      });
      console.log('');
    }
    
    if (results.noData.length > 0) {
      console.log(`⚠️  No standings data (${results.noData.length} leagues):\n`);
      results.noData.forEach(league => {
        console.log(`   - ${league.name} (ID: ${league.id})`);
      });
      console.log('');
    }
    
    if (results.failed.length > 0) {
      console.log(`❌ Failed (${results.failed.length} leagues):\n`);
      results.failed.forEach(league => {
        console.log(`   - ${league.name} (ID: ${league.id}): ${league.error}`);
      });
      console.log('');
    }
    
    console.log('================================================================================');
    console.log(`Total leagues processed: ${leagues.length}`);
    console.log(`Success: ${results.success.length}`);
    console.log(`No data: ${results.noData.length}`);
    console.log(`Failed: ${results.failed.length}`);
    console.log('================================================================================\n');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

syncAllLeagues();
