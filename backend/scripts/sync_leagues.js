// scripts/sync_leagues.js
// Fetch and sync leagues from SportMonks API

require('dotenv').config();
const { connectDB, closeDB } = require('../db/connect');
const { get } = require('../utils/sportmonks');
const League = require('../models/League');
const Country = require('../models/Country');

// Rate limiting
const RATE_LIMIT = {
  DELAY_MS: 200, // 200ms between requests
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000 // 1 second
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function enforceRateLimit() {
  await sleep(RATE_LIMIT.DELAY_MS);
}

async function fetchLeaguesFromAPI() {
  console.log('🏆 Fetching leagues from SportMonks API...');
  
  try {
    await enforceRateLimit();
    
    // Fetch leagues with pagination support
    let allLeagues = [];
    let page = 1;
    let hasMorePages = true;
    
    while (hasMorePages) {
      console.log(`📄 Fetching page ${page}...`);
      
      const response = await get('/leagues', {
        page,
        per_page: 100, // Maximum per page
        include: 'country'
      });
      
      const data = response.data;
      const leagues = Array.isArray(data.data) ? data.data : [];
      
      if (leagues.length === 0) {
        hasMorePages = false;
      } else {
        allLeagues = allLeagues.concat(leagues);
        
        // Check if there are more pages
        const pagination = data.pagination;
        if (pagination && pagination.has_more) {
          page++;
          await enforceRateLimit();
        } else {
          hasMorePages = false;
        }
      }
    }
    
    console.log(`✅ Fetched ${allLeagues.length} leagues from API`);
    return allLeagues;
    
  } catch (error) {
    console.error('❌ Failed to fetch leagues from API:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    
    throw error;
  }
}

function transformLeagueData(apiLeague) {
  return {
    id: apiLeague.id,
    name: apiLeague.name,
    short_code: apiLeague.short_code || null,
    image_path: apiLeague.image_path || null,
    country_id: apiLeague.country_id,
    type: apiLeague.type || null,
    sub_type: apiLeague.sub_type || null,
    last_played_at: apiLeague.last_played_at ? new Date(apiLeague.last_played_at) : null,
    category: apiLeague.category || null,
    has_jerseys: apiLeague.has_jerseys || false,
    coverage: {
      predictions: apiLeague.coverage?.predictions || false,
      topscorer_goals: apiLeague.coverage?.topscorer_goals || false,
      topscorer_assists: apiLeague.coverage?.topscorer_assists || false,
      topscorer_cards: apiLeague.coverage?.topscorer_cards || false
    },
    is_cup: apiLeague.is_cup || false
  };
}

async function syncLeaguesToDatabase(leagues) {
  console.log(`💾 Syncing ${leagues.length} leagues to database...`);
  
  let created = 0;
  let updated = 0;
  let errors = 0;
  let missingCountries = 0;
  
  // Get all existing countries for validation
  const existingCountries = await Country.find({}, 'id').lean();
  const countryIds = new Set(existingCountries.map(c => c.id));
  
  for (const apiLeague of leagues) {
    try {
      const leagueData = transformLeagueData(apiLeague);
      
      // Check if country exists
      if (!countryIds.has(leagueData.country_id)) {
        console.warn(`⚠️ Country ${leagueData.country_id} not found for league ${leagueData.name}`);
        missingCountries++;
        continue;
      }
      
      // Upsert league
      const existingLeague = await League.findOne({ id: leagueData.id });
      
      if (existingLeague) {
        await League.findOneAndUpdate({ id: leagueData.id }, leagueData);
        updated++;
      } else {
        await League.create(leagueData);
        created++;
      }
      
      if ((created + updated) % 50 === 0) {
        console.log(`📊 Progress: ${created + updated}/${leagues.length} processed`);
      }
      
    } catch (error) {
      console.error(`❌ Error syncing league ${apiLeague.name} (ID: ${apiLeague.id}):`, error.message);
      errors++;
    }
  }
  
  return { created, updated, errors, missingCountries };
}

async function main() {
  try {
    console.log('🚀 Starting league sync from SportMonks API...');
    
    // Connect to database
    const mongoUrl = process.env.MONGO_URL || process.env.DBURI || process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay';
    console.log('🔗 Connecting to database...');
    await connectDB(mongoUrl);
    
    // Check if countries exist
    const countryCount = await Country.countDocuments();
    if (countryCount === 0) {
      console.error('❌ No countries found in database. Please run sync_countries.js first.');
      process.exit(1);
    }
    console.log(`✅ Found ${countryCount} countries in database`);
    
    // Fetch leagues from API
    const leagues = await fetchLeaguesFromAPI();
    
    if (leagues.length === 0) {
      console.log('⚠️ No leagues fetched from API. Exiting...');
      return;
    }
    
    // Sync to database
    const stats = await syncLeaguesToDatabase(leagues);
    
    // Display results
    console.log('\n🎉 League sync completed!');
    console.log(`📊 Summary:`);
    console.log(`   • Leagues created: ${stats.created}`);
    console.log(`   • Leagues updated: ${stats.updated}`);
    console.log(`   • Missing countries: ${stats.missingCountries}`);
    console.log(`   • Errors: ${stats.errors}`);
    console.log(`   • Total processed: ${stats.created + stats.updated}`);
    
    if (stats.errors > 0) {
      console.log(`⚠️ There were ${stats.errors} errors during sync. Check logs above.`);
    }
    
    if (stats.missingCountries > 0) {
      console.log(`⚠️ ${stats.missingCountries} leagues skipped due to missing countries. Run sync_countries.js first.`);
    }
    
  } catch (error) {
    console.error('💥 Fatal error during league sync:', error.message);
    process.exit(1);
  } finally {
    await closeDB();
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⚠️ Received SIGINT, shutting down gracefully...');
  await closeDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️ Received SIGTERM, shutting down gracefully...');
  await closeDB();
  process.exit(0);
});

if (require.main === module) {
  main().catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = { main, fetchLeaguesFromAPI, syncLeaguesToDatabase };