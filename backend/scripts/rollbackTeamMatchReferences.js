// scripts/rollbackTeamMatchReferences.js
// Rollback script to revert from match ID references back to embedded match_info objects
// Use this if the migration causes issues and you need to revert

require('dotenv').config();
const mongoose = require('mongoose');
const Team = require('../models/Team');

const DBURI = process.env.DBURI;
if (!DBURI) {
  console.error('Please set DBURI in .env');
  process.exit(1);
}

async function rollbackTeams() {
  let rolledBack = 0;
  let skipped = 0;
  let errors = 0;

  console.log('🔄 Starting team match reference rollback...');
  console.log('⚠️  This will remove the new last_match and next_match fields');
  console.log('💭 The old last_match_info and next_match_info fields will remain intact');
  
  const teams = await Team.find({}).lean();
  console.log(`📊 Found ${teams.length} teams to process`);

  for (const team of teams) {
    try {
      const updates = {};
      let hasUpdates = false;

      // Remove the new reference fields if they exist
      if (team.last_match !== undefined) {
        updates.last_match = undefined;
        hasUpdates = true;
        console.log(`  🗑️  ${team.slug}: Removing last_match reference`);
      }

      if (team.next_match !== undefined) {
        updates.next_match = undefined;
        hasUpdates = true;
        console.log(`  🗑️  ${team.slug}: Removing next_match reference`);
      }

      if (hasUpdates) {
        await Team.updateOne({ _id: team._id }, { $unset: updates });
        rolledBack++;
        console.log(`  ✅ ${team.slug}: Rollback completed`);
      } else {
        skipped++;
        console.log(`  ⏭️  ${team.slug}: No new references found, skipped`);
      }

    } catch (error) {
      errors++;
      console.error(`  ❌ ${team.slug || team.name}: Rollback failed - ${error.message}`);
    }
  }

  console.log('\n📈 Rollback Summary:');
  console.log(`  ✅ Successfully rolled back: ${rolledBack}`);
  console.log(`  ⏭️  Skipped (no new data): ${skipped}`);
  console.log(`  ❌ Errors: ${errors}`);
  
  return { rolledBack, skipped, errors };
}

async function verifyRollback() {
  console.log('\n🔍 Verifying rollback...');
  
  const teamsWithNewRefs = await Team.countDocuments({
    $or: [
      { last_match: { $exists: true } },
      { next_match: { $exists: true } }
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
  
  const success = teamsWithNewRefs === 0;
  console.log(`  ${success ? '✅' : '❌'} Rollback ${success ? 'successful' : 'incomplete'}`);
  
  return success;
}

async function main() {
  try {
    console.log('⚠️  WARNING: This will rollback the team match reference migration!');
    console.log('💡 Make sure you understand the implications before proceeding.');
    console.log('⏰ Starting rollback in 5 seconds... Press Ctrl+C to cancel.');
    
    // Give user time to cancel
    await new Promise(resolve => setTimeout(resolve, 5000));

    await mongoose.connect(DBURI, { maxPoolSize: 10 });
    console.log('🔗 Connected to database');

    // Run rollback
    const results = await rollbackTeams();
    
    // Verify results
    const isValid = await verifyRollback();
    
    if (isValid && results.errors === 0) {
      console.log('\n🎉 Rollback completed successfully!');
      console.log('\n📋 What was rolled back:');
      console.log('  ❌ Removed last_match and next_match reference fields');
      console.log('  ✅ Preserved original last_match_info and next_match_info data');
      console.log('\n📋 Next steps:');
      console.log('  1. Update your code to use the old embedded approach');
      console.log('  2. Restart your application');
      console.log('  3. Consider why the migration failed and address those issues');
    } else {
      console.log('\n⚠️  Rollback completed with issues. Please review the warnings above.');
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

module.exports = { rollbackTeams, verifyRollback };