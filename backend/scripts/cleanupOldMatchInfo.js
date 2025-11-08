// scripts/cleanupOldMatchInfo.js
// Cleanup script to remove the old embedded match_info data after migration is complete
// Only run this after thoroughly testing the new reference-based approach

require('dotenv').config();
const mongoose = require('mongoose');
const Team = require('../models/Team');

const DBURI = process.env.DBURI;
if (!DBURI) {
  console.error('Please set DBURI in .env');
  process.exit(1);
}

async function cleanupOldMatchInfo() {
  let cleaned = 0;
  let skipped = 0;
  let errors = 0;

  console.log('🧹 Starting cleanup of old match_info fields...');
  console.log('⚠️  This will permanently remove last_match_info and next_match_info fields');
  console.log('💡 Make sure the new reference-based system is working properly first');
  
  const teams = await Team.find({}).lean();
  console.log(`📊 Found ${teams.length} teams to process`);

  for (const team of teams) {
    try {
      const hasOldData = team.last_match_info || team.next_match_info;
      const hasNewData = team.last_match || team.next_match;

      if (hasOldData) {
        if (!hasNewData) {
          console.warn(`  ⚠️  ${team.slug}: Has old data but no new references - SKIPPING for safety`);
          skipped++;
          continue;
        }

        // Remove old embedded data
        await Team.updateOne(
          { _id: team._id }, 
          { 
            $unset: { 
              last_match_info: 1, 
              next_match_info: 1 
            } 
          }
        );
        
        cleaned++;
        console.log(`  🧹 ${team.slug}: Removed old embedded match_info data`);
      } else {
        skipped++;
        console.log(`  ⏭️  ${team.slug}: No old data to clean up`);
      }

    } catch (error) {
      errors++;
      console.error(`  ❌ ${team.slug || team.name}: Cleanup failed - ${error.message}`);
    }
  }

  console.log('\n📈 Cleanup Summary:');
  console.log(`  🧹 Successfully cleaned: ${cleaned}`);
  console.log(`  ⏭️  Skipped: ${skipped}`);
  console.log(`  ❌ Errors: ${errors}`);
  
  return { cleaned, skipped, errors };
}

async function verifyCleanup() {
  console.log('\n🔍 Verifying cleanup...');
  
  const teamsWithOldData = await Team.countDocuments({
    $or: [
      { last_match_info: { $exists: true } },
      { next_match_info: { $exists: true } }
    ]
  });
  
  const teamsWithNewRefs = await Team.countDocuments({
    $or: [
      { last_match: { $exists: true, $ne: null } },
      { next_match: { $exists: true, $ne: null } }
    ]
  });

  console.log(`  📊 Teams with old match_info data remaining: ${teamsWithOldData}`);
  console.log(`  📊 Teams with new match references: ${teamsWithNewRefs}`);
  
  const success = teamsWithOldData === 0;
  console.log(`  ${success ? '✅' : '⚠️'} Cleanup ${success ? 'successful' : 'incomplete'}`);
  
  return success;
}

async function main() {
  try {
    console.log('⚠️  WARNING: This will permanently delete old embedded match_info data!');
    console.log('💡 Make sure you have tested the new reference-based system thoroughly.');
    console.log('🔄 You can always restore from backup if needed.');
    console.log('⏰ Starting cleanup in 10 seconds... Press Ctrl+C to cancel.');
    
    // Give user more time to cancel since this is destructive
    await new Promise(resolve => setTimeout(resolve, 10000));

    await mongoose.connect(DBURI, { maxPoolSize: 10 });
    console.log('🔗 Connected to database');

    // Run cleanup
    const results = await cleanupOldMatchInfo();
    
    // Verify results
    const isValid = await verifyCleanup();
    
    if (isValid && results.errors === 0) {
      console.log('\n🎉 Cleanup completed successfully!');
      console.log('\n📋 What was cleaned:');
      console.log('  🗑️  Removed old last_match_info and next_match_info embedded objects');
      console.log('  ✅ Preserved new last_match and next_match ID references');
      console.log('\n💡 Your system now uses the cleaner reference-based approach exclusively!');
    } else {
      console.log('\n⚠️  Cleanup completed with issues. Please review the warnings above.');
    }

  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from database');
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { cleanupOldMatchInfo, verifyCleanup };