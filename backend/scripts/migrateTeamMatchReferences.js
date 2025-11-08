// scripts/migrateTeamMatchReferences.js
// Migration script to convert from embedded match_info objects to match ID references
// This preserves existing data while moving to a cleaner reference-based approach

require('dotenv').config();
const mongoose = require('mongoose');
const Team = require('../models/Team');
const Match = require('../models/Match');

const DBURI = process.env.DBURI;
if (!DBURI) {
  console.error('Please set DBURI in .env');
  process.exit(1);
}

// Helper to safely convert to number
function safeNum(v) {
  if (v == null) return null;
  const num = Number(v);
  return Number.isFinite(num) ? num : null;
}

async function migrateTeams() {
  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  console.log('🔄 Starting team match reference migration...');
  
  const teams = await Team.find({}).lean();
  console.log(`📊 Found ${teams.length} teams to process`);

  for (const team of teams) {
    try {
      const updates = {};
      let hasUpdates = false;

      // Process last_match_info -> last_match
      if (team.last_match_info && team.last_match_info.match_id) {
        const lastMatchId = safeNum(team.last_match_info.match_id);
        if (lastMatchId) {
          // Verify the match exists
          const matchExists = await Match.findOne({ match_id: lastMatchId }).lean();
          if (matchExists) {
            updates.last_match = lastMatchId;
            hasUpdates = true;
            console.log(`  ✅ ${team.slug}: Setting last_match to ${lastMatchId}`);
          } else {
            console.warn(`  ⚠️  ${team.slug}: Match ${lastMatchId} not found for last_match`);
          }
        }
      }

      // Process next_match_info -> next_match
      if (team.next_match_info && team.next_match_info.match_id) {
        const nextMatchId = safeNum(team.next_match_info.match_id);
        if (nextMatchId) {
          // Verify the match exists
          const matchExists = await Match.findOne({ match_id: nextMatchId }).lean();
          if (matchExists) {
            updates.next_match = nextMatchId;
            hasUpdates = true;
            console.log(`  ✅ ${team.slug}: Setting next_match to ${nextMatchId}`);
          } else {
            console.warn(`  ⚠️  ${team.slug}: Match ${nextMatchId} not found for next_match`);
          }
        }
      }

      if (hasUpdates) {
        await Team.updateOne({ _id: team._id }, { $set: updates });
        migrated++;
        console.log(`  📝 ${team.slug}: Updated with new references`);
      } else {
        skipped++;
        console.log(`  ⏭️  ${team.slug}: No valid match IDs found, skipped`);
      }

    } catch (error) {
      errors++;
      console.error(`  ❌ ${team.slug || team.name}: Migration failed - ${error.message}`);
    }
  }

  console.log('\n📈 Migration Summary:');
  console.log(`  ✅ Successfully migrated: ${migrated}`);
  console.log(`  ⏭️  Skipped (no data): ${skipped}`);
  console.log(`  ❌ Errors: ${errors}`);
  
  return { migrated, skipped, errors };
}

async function verifyMigration() {
  console.log('\n🔍 Verifying migration...');
  
  const teamsWithNewRefs = await Team.countDocuments({
    $or: [
      { last_match: { $exists: true, $ne: null } },
      { next_match: { $exists: true, $ne: null } }
    ]
  });
  
  const teamsWithOldData = await Team.countDocuments({
    $or: [
      { last_match_info: { $exists: true, $ne: null } },
      { next_match_info: { $exists: true, $ne: null } }
    ]
  });

  console.log(`  📊 Teams with new match references: ${teamsWithNewRefs}`);
  console.log(`  📊 Teams with old match_info data: ${teamsWithOldData}`);
  
  // Check for any broken references
  const teamsWithRefs = await Team.find({
    $or: [
      { last_match: { $exists: true, $ne: null } },
      { next_match: { $exists: true, $ne: null } }
    ]
  }).lean();

  let brokenRefs = 0;
  for (const team of teamsWithRefs) {
    if (team.last_match) {
      const match = await Match.findOne({ match_id: team.last_match }).lean();
      if (!match) {
        console.warn(`  ⚠️  ${team.slug}: Broken last_match reference ${team.last_match}`);
        brokenRefs++;
      }
    }
    
    if (team.next_match) {
      const match = await Match.findOne({ match_id: team.next_match }).lean();
      if (!match) {
        console.warn(`  ⚠️  ${team.slug}: Broken next_match reference ${team.next_match}`);
        brokenRefs++;
      }
    }
  }

  console.log(`  ${brokenRefs === 0 ? '✅' : '❌'} Broken references: ${brokenRefs}`);
  
  return brokenRefs === 0;
}

async function main() {
  try {
    await mongoose.connect(DBURI, { maxPoolSize: 10 });
    console.log('🔗 Connected to database');

    // Run migration
    const results = await migrateTeams();
    
    // Verify results
    const isValid = await verifyMigration();
    
    if (isValid && results.errors === 0) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('\n📋 Next steps:');
      console.log('  1. Update the Team model schema to add the new fields');
      console.log('  2. Update controllers to use populate() with the new references');
      console.log('  3. Test thoroughly before removing old match_info fields');
      console.log('  4. Run the cleanup script to remove old embedded data');
    } else {
      console.log('\n⚠️  Migration completed with issues. Please review the warnings above.');
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

module.exports = { migrateTeams, verifyMigration };