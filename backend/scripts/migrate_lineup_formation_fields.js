// scripts/migrate_lineup_formation_fields.js
// Migration script to add formation fields to existing lineups

const mongoose = require('mongoose');
const Match = require('../models/Match');
const { enrichLineupData } = require('../utils/lineup');

function readDbUri() {
  const fs = require('fs');
  const path = require('path');
  try {
    const configPath = path.join(__dirname, '..', 'config', 'database.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config.uri || process.env.MONGODB_URI;
  } catch (e) {
    return process.env.MONGODB_URI;
  }
}

async function migrateLineupFormationFields() {
  const uri = readDbUri();
  if (!uri) {
    console.error('❌ No database URI found in config or environment');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('📊 Connected to database');

  // Find matches with lineups that might need enrichment
  const query = {
    $and: [
      { $or: [
        { 'lineup.home.0': { $exists: true } },
        { 'lineup.away.0': { $exists: true } }
      ]},
      // Only process matches where at least one player is missing formation data
      { $or: [
        { 'lineup.home.image_path': { $exists: false } },
        { 'lineup.away.image_path': { $exists: false } }
      ]}
    ]
  };

  const matchCount = await Match.countDocuments(query);
  console.log(`📋 Found ${matchCount} matches with lineups to potentially enrich`);

  if (matchCount === 0) {
    console.log('✅ No matches need lineup enrichment');
    await mongoose.disconnect();
    return;
  }

  // Process in batches to avoid memory issues
  const batchSize = 10;
  let processed = 0;
  let enriched = 0;

  for (let skip = 0; skip < matchCount; skip += batchSize) {
    const matches = await Match.find(query)
      .select('match_id lineup teams')
      .limit(batchSize)
      .skip(skip)
      .lean();

    console.log(`\n📦 Processing batch ${Math.floor(skip / batchSize) + 1}/${Math.ceil(matchCount / batchSize)}`);

    for (const match of matches) {
      try {
        console.log(`   🔄 Processing match ${match.match_id}...`);

        // Only enrich if we have lineup data and API key
        if (match.lineup && process.env.SPORTMONKS_API_KEY) {
          const originalLineup = { ...match.lineup };
          
          // Enrich the lineup data
          const enrichedLineup = await enrichLineupData(match.lineup, {
            batchSize: 2, // Small batches for migration
            delayMs: 300  // Longer delays to be API-friendly
          });

          // Check if any enrichment actually occurred
          const hasNewData = (
            (enrichedLineup.home && enrichedLineup.home.some(p => p.image_path || p.position_name)) ||
            (enrichedLineup.away && enrichedLineup.away.some(p => p.image_path || p.position_name))
          );

          if (hasNewData) {
            // Update the match with enriched data
            await Match.updateOne(
              { _id: match._id },
              { $set: { lineup: enrichedLineup } }
            );
            
            console.log(`   ✅ Enriched match ${match.match_id}`);
            enriched++;
          } else {
            console.log(`   ⚠️  No new data found for match ${match.match_id}`);
          }
        } else {
          if (!process.env.SPORTMONKS_API_KEY) {
            console.log(`   ⚠️  Skipping match ${match.match_id} - no API key`);
          } else {
            console.log(`   ⚠️  Skipping match ${match.match_id} - no lineup data`);
          }
        }

        processed++;
      } catch (error) {
        console.error(`   ❌ Error processing match ${match.match_id}:`, error.message);
      }
    }

    // Small delay between batches
    if (skip + batchSize < matchCount) {
      console.log('   ⏱️  Waiting before next batch...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`\n📈 Migration Summary:`);
  console.log(`   - Processed: ${processed} matches`);
  console.log(`   - Enriched: ${enriched} matches`);
  console.log(`   - Success rate: ${processed > 0 ? ((enriched / processed) * 100).toFixed(1) : 0}%`);

  await mongoose.disconnect();
  console.log('✅ Migration completed');
}

// Handle script execution
if (require.main === module) {
  migrateLineupFormationFields().catch(error => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });
}

module.exports = { migrateLineupFormationFields };