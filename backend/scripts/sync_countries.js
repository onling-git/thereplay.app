// scripts/sync_countries.js
// Fetch and sync countries from SportMonks API

require('dotenv').config();
const { connectDB, closeDB } = require('../db/connect');
const axios = require('axios');
const Country = require('../models/Country');

// SportMonks API configuration for core endpoints
const SPORTMONKS_BASE = 'https://api.sportmonks.com/v3';
const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;

if (!SPORTMONKS_API_KEY) {
  console.error('❌ SPORTMONKS_API_KEY is required but not found in environment variables.');
  process.exit(1);
}

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

// Custom API call function for countries
async function apiGet(endpoint, params = {}) {
  const url = `${SPORTMONKS_BASE}${endpoint}`;
  const fullParams = { api_token: SPORTMONKS_API_KEY, ...params };
  
  console.log(`[API] GET ${url}`, { ...fullParams, api_token: '***' });
  
  try {
    const response = await axios.get(url, { 
      params: fullParams,
      timeout: 30000 
    });
    return response;
  } catch (error) {
    console.error(`[API] Error:`, error.response?.data || error.message);
    throw error;
  }
}

async function fetchCountriesFromAPI() {
  console.log('🌍 Fetching countries from SportMonks API...');
  
  try {
    await enforceRateLimit();
    
    // Fetch countries with pagination support
    let allCountries = [];
    let page = 1;
    let hasMorePages = true;
    
    while (hasMorePages) {
      console.log(`📄 Fetching page ${page}...`);
      
      const response = await apiGet('/core/countries', {
        page,
        per_page: 100 // Maximum per page
      });
      
      const data = response.data;
      const countries = Array.isArray(data.data) ? data.data : [];
      
      if (countries.length === 0) {
        hasMorePages = false;
      } else {
        allCountries = allCountries.concat(countries);
        
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
    
    console.log(`✅ Fetched ${allCountries.length} countries from API`);
    return allCountries;
    
  } catch (error) {
    console.error('❌ Failed to fetch countries from API:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    
    throw error;
  }
}

function transformCountryData(apiCountry) {
  return {
    id: apiCountry.id,
    name: apiCountry.name,
    iso2: apiCountry.iso2 || null,
    iso3: apiCountry.iso3 || null,
    continent_id: apiCountry.continent_id || null,
    continent_name: apiCountry.continent?.name || null,
    flag_path: apiCountry.image_path || null,
    official_name: apiCountry.official_name || null,
    fifa_name: apiCountry.fifa_name || null
  };
}

async function syncCountriesToDatabase(countries) {
  console.log(`💾 Syncing ${countries.length} countries to database...`);
  
  let created = 0;
  let updated = 0;
  let errors = 0;
  
  for (const apiCountry of countries) {
    try {
      const countryData = transformCountryData(apiCountry);
      
      // Upsert country
      const result = await Country.findOneAndUpdate(
        { id: countryData.id },
        countryData,
        { 
          upsert: true, 
          new: true,
          setDefaultsOnInsert: true 
        }
      );
      
      if (result.isNew !== false) {
        created++;
      } else {
        updated++;
      }
      
      if ((created + updated) % 50 === 0) {
        console.log(`📊 Progress: ${created + updated}/${countries.length} processed`);
      }
      
    } catch (error) {
      console.error(`❌ Error syncing country ${apiCountry.name} (ID: ${apiCountry.id}):`, error.message);
      errors++;
    }
  }
  
  return { created, updated, errors };
}

async function main() {
  try {
    console.log('🚀 Starting country sync from SportMonks API...');
    
    // Connect to database
    const mongoUrl = process.env.MONGO_URL || process.env.DBURI || process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay';
    console.log('🔗 Connecting to database...');
    await connectDB(mongoUrl);
    
    // Fetch countries from API
    const countries = await fetchCountriesFromAPI();
    
    if (countries.length === 0) {
      console.log('⚠️ No countries fetched from API. Exiting...');
      return;
    }
    
    // Sync to database
    const stats = await syncCountriesToDatabase(countries);
    
    // Display results
    console.log('\n🎉 Country sync completed!');
    console.log(`📊 Summary:`);
    console.log(`   • Countries created: ${stats.created}`);
    console.log(`   • Countries updated: ${stats.updated}`);
    console.log(`   • Errors: ${stats.errors}`);
    console.log(`   • Total processed: ${stats.created + stats.updated}`);
    
    if (stats.errors > 0) {
      console.log(`⚠️ There were ${stats.errors} errors during sync. Check logs above.`);
    }
    
  } catch (error) {
    console.error('💥 Fatal error during country sync:', error.message);
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

module.exports = { main, fetchCountriesFromAPI, syncCountriesToDatabase };