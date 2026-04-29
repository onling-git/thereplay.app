// scripts/enrich_fixture_metadata.js
// Update existing fixtures with complete league and country metadata

require('dotenv').config();
const { connectDB, closeDB } = require('../db/connect');
const Match = require('../models/Match');
const League = require('../models/League');
const Country = require('../models/Country');

async function enrichFixtureMetadata() {
  try {
    console.log('🚀 Starting fixture metadata enrichment...');
    
    // Connect to database
    const mongoUrl = process.env.MONGO_URL || process.env.DBURI || process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay';
    console.log('🔗 Connecting to database...');
    await connectDB(mongoUrl);
    
    // Get all leagues and countries for lookup
    console.log('📊 Loading leagues and countries...');
    const leagues = await League.find({}).lean();
    const countries = await Country.find({}).lean();
    
    // Create lookup maps
    const leagueMap = {};
    const countryMap = {};
    
    leagues.forEach(league => {
      leagueMap[league.id] = league;
    });
    
    countries.forEach(country => {
      countryMap[country.id] = country;
    });
    
    console.log(`✅ Loaded ${leagues.length} leagues and ${countries.length} countries`);
    
    // Find fixtures that need enrichment
    console.log('🔍 Finding fixtures that need metadata enrichment...');
    const fixturesToUpdate = await Match.find({
      $or: [
        { 'match_info.league.name': { $in: ['', null] } },
        { 'match_info.league.country_id': null },
        { 'match_info.league.country_id': { $exists: false } }
      ]
    }).select('match_id match_info').lean();
    
    console.log(`📝 Found ${fixturesToUpdate.length} fixtures to update`);
    
    if (fixturesToUpdate.length === 0) {
      console.log('✅ All fixtures already have complete metadata!');
      return;
    }
    
    let updated = 0;
    let notFound = 0;
    
    // Process fixtures in batches
    const BATCH_SIZE = 100;
    for (let i = 0; i < fixturesToUpdate.length; i += BATCH_SIZE) {
      const batch = fixturesToUpdate.slice(i, i + BATCH_SIZE);
      console.log(`📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(fixturesToUpdate.length / BATCH_SIZE)}...`);
      
      for (const fixture of batch) {
        try {
          const leagueId = fixture.match_info?.league?.id;
          if (!leagueId) {
            console.warn(`⚠️  Match ${fixture.match_id} has no league ID`);
            continue;
          }
          
          const league = leagueMap[leagueId];
          if (!league) {
            console.warn(`⚠️  League ${leagueId} not found in leagues collection`);
            notFound++;
            continue;
          }
          
          const country = countryMap[league.country_id];
          
          // Update the fixture with complete metadata
          const updateData = {
            'match_info.league.name': league.name || '',
            'match_info.league.short_code': league.short_code || '',
            'match_info.league.image_path': league.image_path || '',
            'match_info.league.country_id': league.country_id
          };
          
          // Add country info if available
          if (country) {
            updateData['match_info.league.country_name'] = country.name;
            updateData['match_info.league.country_iso2'] = country.iso2;
          }
          
          await Match.updateOne(
            { match_id: fixture.match_id },
            { $set: updateData }
          );
          
          updated++;
          
          if (updated % 50 === 0) {
            console.log(`📊 Progress: ${updated}/${fixturesToUpdate.length} updated`);
          }
          
        } catch (error) {
          console.error(`❌ Error updating match ${fixture.match_id}:`, error.message);
        }
      }
    }
    
    console.log('\n🎉 Fixture metadata enrichment completed!');
    console.log(`📊 Summary:`);
    console.log(`   • Fixtures updated: ${updated}`);
    console.log(`   • Leagues not found: ${notFound}`);
    console.log(`   • Total processed: ${fixturesToUpdate.length}`);
    
  } catch (error) {
    console.error('💥 Fatal error during metadata enrichment:', error.message);
    throw error;
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

if (require.main === module) {
  enrichFixtureMetadata().catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = { enrichFixtureMetadata };