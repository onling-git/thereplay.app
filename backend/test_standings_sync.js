// test_standings_sync.js
// Test script to manually trigger standings sync and verify updates

require('dotenv').config();
const mongoose = require('mongoose');
const { syncStandingsByLeague, getStandingsForLeague } = require('./services/standingsService');
const Standing = require('./models/Standing');

// Test with Premier League (ID: 8) and Championship (ID: 9)
const TEST_LEAGUES = {
  8: 'Premier League',
  9: 'Championship'
};

async function testStandingsSync() {
  try {
    console.log('='.repeat(80));
    console.log('TESTING STANDINGS SYNC');
    console.log('='.repeat(80));
    console.log('');

    // Connect to database
    const uri = process.env.DBURI || process.env.MONGODB_URI || process.env.DATABASE_URL;
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB\n');

    for (const [leagueId, leagueName] of Object.entries(TEST_LEAGUES)) {
      console.log(`[${leagueName}] Testing league ID: ${leagueId}`);
      console.log('-'.repeat(80));
      
      // Step 1: Check current standings in database
      console.log('\n1️⃣ Checking current standings in database...');
      const currentStandings = await getStandingsForLeague(parseInt(leagueId));
      
      if (currentStandings) {
        console.log(`   ✅ Found existing standings:`);
        console.log(`      League: ${currentStandings.league_name}`);
        console.log(`      Season: ${currentStandings.season_name}`);
        console.log(`      Teams: ${currentStandings.table?.length || 0}`);
        console.log(`      Last updated: ${currentStandings.last_updated}`);
        
        // Show top 3
        if (currentStandings.table && currentStandings.table.length > 0) {
          console.log(`\n   Top 3 positions:`);
          currentStandings.table.slice(0, 3).forEach(entry => {
            console.log(`      ${entry.position}. ${entry.team_name || `Participant ${entry.participant_id}`} - ${entry.points} pts`);
          });
        }
      } else {
        console.log(`   ⚠️  No standings found in database`);
      }

      // Step 2: Sync fresh standings from API
      console.log(`\n2️⃣ Syncing fresh standings from Sportmonks API...`);
      const result = await syncStandingsByLeague(parseInt(leagueId));
      
      if (result) {
        console.log(`   ✅ Sync successful:`);
        console.log(`      League: ${result.league_name}`);
        console.log(`      Season: ${result.season_name}`);
        console.log(`      Teams: ${result.table?.length || 0}`);
        console.log(`      Synced at: ${result.last_updated}`);
        
        // Show top 3 from fresh data
        if (result.table && result.table.length > 0) {
          console.log(`\n   Top 3 positions (fresh):`);
          result.table.slice(0, 3).forEach(entry => {
            console.log(`      ${entry.position}. Participant ${entry.participant_id} - ${entry.points} pts`);
          });
        }
      } else {
        console.log(`   ❌ Sync failed - no data returned`);
      }

      // Step 3: Verify database was updated
      console.log(`\n3️⃣ Verifying database update...`);
      const updatedStandings = await getStandingsForLeague(parseInt(leagueId));
      
      if (updatedStandings) {
        console.log(`   ✅ Database updated successfully`);
        console.log(`      Last updated: ${updatedStandings.last_updated}`);
        
        // Compare timestamps
        if (currentStandings) {
          const oldTime = new Date(currentStandings.last_updated).getTime();
          const newTime = new Date(updatedStandings.last_updated).getTime();
          const diffSeconds = Math.floor((newTime - oldTime) / 1000);
          
          if (diffSeconds > 0) {
            console.log(`      ⏱️  Updated ${diffSeconds} seconds ago from previous version`);
          } else {
            console.log(`      ⚠️  Timestamp unchanged - may be same data`);
          }
        }
      } else {
        console.log(`   ❌ No updated standings found`);
      }

      console.log('\n' + '='.repeat(80) + '\n');
    }

    // Summary
    console.log('🎉 TESTING COMPLETE');
    console.log('');
    console.log('Next steps:');
    console.log('- Check frontend to see if standings display updated');
    console.log('- Monitor logs when matches finish to see auto-sync in action');
    console.log('- Daily cron will run at 3 AM to refresh all leagues');
    console.log('');

  } catch (error) {
    console.error('❌ Error testing standings sync:', error);
  } finally {
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
  }
}

testStandingsSync();
