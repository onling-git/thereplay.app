// scripts/testMatchReferences.js
// Test script to verify the new match reference system is working correctly
// Run this before deploying to production

require('dotenv').config();
const mongoose = require('mongoose');
const Team = require('../models/Team');
const Match = require('../models/Match');
const { getTeamWithMatchReferences, formatMatchForCompatibility } = require('../utils/teamMatchUtils');

const DBURI = process.env.DBURI;
if (!DBURI) {
  console.error('Please set DBURI in .env');
  process.exit(1);
}

async function testTeamWithReferences(teamSlug) {
  console.log(`\n🧪 Testing team: ${teamSlug}`);
  
  try {
    // Test the new approach
    const teamWithRefs = await getTeamWithMatchReferences(teamSlug);
    
    if (!teamWithRefs) {
      console.log(`  ❌ Team not found: ${teamSlug}`);
      return false;
    }

    // Test direct populate approach
    const directTeam = await Team.findOne({ slug: teamSlug })
      .populate('last_match')
      .populate('next_match')
      .lean();

    console.log(`  📊 Team: ${teamWithRefs.name}`);
    console.log(`  🆔 Last match reference: ${directTeam.last_match?.match_id || 'none'}`);
    console.log(`  🆔 Next match reference: ${directTeam.next_match?.match_id || 'none'}`);
    
    // Verify populated matches exist
    if (directTeam.last_match) {
      const lastMatchVerify = await Match.findOne({ match_id: directTeam.last_match.match_id }).lean();
      console.log(`  ✅ Last match verification: ${lastMatchVerify ? 'Found' : 'MISSING!'}`);
    }
    
    if (directTeam.next_match) {
      const nextMatchVerify = await Match.findOne({ match_id: directTeam.next_match.match_id }).lean();
      console.log(`  ✅ Next match verification: ${nextMatchVerify ? 'Found' : 'MISSING!'}`);
    }

    // Test formatted output
    console.log(`  📋 Formatted last_match_info: ${teamWithRefs.last_match_info ? 'Generated' : 'null'}`);
    console.log(`  📋 Formatted next_match_info: ${teamWithRefs.next_match_info ? 'Generated' : 'null'}`);
    
    if (teamWithRefs.last_match_info) {
      console.log(`    🆚 Last opponent: ${teamWithRefs.last_match_info.opponent_name}`);
      console.log(`    ⚽ Last score: ${teamWithRefs.last_match_info.goals_for}-${teamWithRefs.last_match_info.goals_against}`);
    }
    
    if (teamWithRefs.next_match_info) {
      console.log(`    🆚 Next opponent: ${teamWithRefs.next_match_info.opponent_name}`);
      console.log(`    📅 Next date: ${teamWithRefs.next_match_info.date}`);
    }

    return true;
  } catch (error) {
    console.error(`  ❌ Test failed for ${teamSlug}: ${error.message}`);
    return false;
  }
}

async function runComprehensiveTests() {
  console.log('🧪 Running comprehensive tests for match reference system...\n');
  
  let passed = 0;
  let failed = 0;

  // Get some teams with match references to test
  const teamsWithRefs = await Team.find({
    $or: [
      { last_match: { $exists: true, $ne: null } },
      { next_match: { $exists: true, $ne: null } }
    ]
  })
  .limit(10)
  .lean();

  console.log(`📊 Found ${teamsWithRefs.length} teams with match references to test`);
  
  for (const team of teamsWithRefs) {
    const success = await testTeamWithReferences(team.slug);
    if (success) {
      passed++;
    } else {
      failed++;
    }
  }

  // Test some popular teams that might not have references yet
  const popularTeams = ['liverpool', 'manchester-city', 'arsenal', 'chelsea', 'tottenham'];
  console.log('\n🏆 Testing popular teams...');
  
  for (const teamSlug of popularTeams) {
    const success = await testTeamWithReferences(teamSlug);
    if (success) {
      passed++;
    } else {
      failed++;
    }
  }

  return { passed, failed };
}

async function testMatchPopulation() {
  console.log('\n🔗 Testing match population performance...');
  
  const startTime = Date.now();
  
  const teamsWithMatches = await Team.find({
    $or: [
      { last_match: { $exists: true, $ne: null } },
      { next_match: { $exists: true, $ne: null } }
    ]
  })
  .populate('last_match')
  .populate('next_match')
  .limit(50)
  .lean();

  const endTime = Date.now();
  const duration = endTime - startTime;
  
  console.log(`  📊 Populated ${teamsWithMatches.length} teams in ${duration}ms`);
  console.log(`  ⚡ Average: ${(duration / teamsWithMatches.length).toFixed(2)}ms per team`);
  
  // Check for broken references
  let brokenRefs = 0;
  for (const team of teamsWithMatches) {
    if (team.last_match && !team.last_match.match_id) brokenRefs++;
    if (team.next_match && !team.next_match.match_id) brokenRefs++;
  }
  
  console.log(`  ${brokenRefs === 0 ? '✅' : '❌'} Broken references: ${brokenRefs}`);
  
  return brokenRefs === 0;
}

async function testDataConsistency() {
  console.log('\n🔍 Testing data consistency...');
  
  // Check teams with both old and new data
  const teamsWithBothData = await Team.find({
    $and: [
      { $or: [{ last_match: { $exists: true, $ne: null } }, { next_match: { $exists: true, $ne: null } }] },
      { $or: [{ last_match_info: { $exists: true, $ne: null } }, { next_match_info: { $exists: true, $ne: null } }] }
    ]
  }).lean();

  console.log(`  📊 Teams with both old and new data: ${teamsWithBothData.length}`);
  
  let consistencyIssues = 0;
  for (const team of teamsWithBothData.slice(0, 20)) { // Test first 20
    try {
      // Compare old vs new approach
      if (team.last_match && team.last_match_info) {
        if (team.last_match !== team.last_match_info.match_id) {
          console.warn(`  ⚠️  ${team.slug}: Last match ID mismatch (${team.last_match} vs ${team.last_match_info.match_id})`);
          consistencyIssues++;
        }
      }
      
      if (team.next_match && team.next_match_info) {
        if (team.next_match !== team.next_match_info.match_id) {
          console.warn(`  ⚠️  ${team.slug}: Next match ID mismatch (${team.next_match} vs ${team.next_match_info.match_id})`);
          consistencyIssues++;
        }
      }
    } catch (error) {
      console.error(`  ❌ Consistency check failed for ${team.slug}: ${error.message}`);
      consistencyIssues++;
    }
  }
  
  console.log(`  ${consistencyIssues === 0 ? '✅' : '⚠️'} Consistency issues: ${consistencyIssues}`);
  return consistencyIssues === 0;
}

async function main() {
  try {
    await mongoose.connect(DBURI, { maxPoolSize: 10 });
    console.log('🔗 Connected to database');

    // Run all tests
    const testResults = await runComprehensiveTests();
    const populationTest = await testMatchPopulation();
    const consistencyTest = await testDataConsistency();
    
    console.log('\n📈 Test Summary:');
    console.log(`  ✅ Tests passed: ${testResults.passed}`);
    console.log(`  ❌ Tests failed: ${testResults.failed}`);
    console.log(`  🔗 Population test: ${populationTest ? 'PASSED' : 'FAILED'}`);
    console.log(`  🔍 Consistency test: ${consistencyTest ? 'PASSED' : 'ISSUES FOUND'}`);
    
    const allTestsPassed = testResults.failed === 0 && populationTest && consistencyTest;
    
    if (allTestsPassed) {
      console.log('\n🎉 All tests passed! The match reference system is working correctly.');
      console.log('✅ Ready for production deployment.');
    } else {
      console.log('\n⚠️  Some tests failed. Please review the issues above before deploying.');
    }

    return allTestsPassed;

  } catch (error) {
    console.error('💥 Fatal error:', error);
    return false;
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from database');
  }
}

// Run if called directly
if (require.main === module) {
  main().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { testTeamWithReferences, runComprehensiveTests, testMatchPopulation, testDataConsistency };