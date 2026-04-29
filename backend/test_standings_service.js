// Test script for standings service
require('dotenv').config();
const mongoose = require('mongoose');
const {
  syncStandingsByLeague,
  syncMultipleLeagues,
  getStandingsForLeague,
  getTeamPositionInLeague
} = require('./services/standingsService');

const PREMIER_LEAGUE_ID = 8;
const CHAMPIONSHIP_ID = 9;
const FA_CUP_ID = 24;

async function run() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB\n');

    console.log('='.repeat(80));
    console.log('🏆 TESTING STANDINGS SERVICE');
    console.log('='.repeat(80));
    console.log('\n');

    // Test 1: Sync Premier League standings
    console.log('📊 Test 1: Syncing Premier League standings...');
    const plStandings = await syncStandingsByLeague(PREMIER_LEAGUE_ID);
    
    if (plStandings) {
      console.log(`\n✅ Synced: ${plStandings.league_name}`);
      console.log(`   Season: ${plStandings.season_name}`);
      console.log(`   Teams: ${plStandings.table.length}`);
      console.log('\n   Top 3:');
      plStandings.table.slice(0, 3).forEach(entry => {
        console.log(`   ${entry.position}. Participant #${entry.participant_id} - ${entry.points} pts (${entry.trend})`);
      });
    }

    console.log('\n');
    console.log('='.repeat(80));
    console.log('\n');

    // Test 2: Sync multiple leagues
    console.log('📊 Test 2: Syncing multiple leagues...');
    const results = await syncMultipleLeagues([CHAMPIONSHIP_ID], 500);
    
    console.log(`\n✅ Completed ${results.length} sync operations`);
    results.forEach(result => {
      if (result.success) {
        console.log(`   ✅ League ${result.league_id}: ${result.data?.league_name}`);
      } else {
        console.log(`   ❌ League ${result.league_id}: ${result.error}`);
      }
    });

    console.log('\n');
    console.log('='.repeat(80));
    console.log('\n');

    // Test 3: Retrieve from database
    console.log('📊 Test 3: Retrieving standings from database...');
    const savedStandings = await getStandingsForLeague(PREMIER_LEAGUE_ID);
    
    if (savedStandings) {
      console.log(`\n✅ Retrieved from DB: ${savedStandings.league_name}`);
      console.log(`   Last updated: ${savedStandings.last_updated}`);
      console.log(`   Total teams: ${savedStandings.table.length}`);
      
      // Show a team with stats
      const topTeam = savedStandings.table[0];
      console.log(`\n   League Leader Details:`);
      console.log(`   Position: ${topTeam.position}`);
      console.log(`   Participant ID: ${topTeam.participant_id}`);
      console.log(`   Points: ${topTeam.points}`);
      console.log(`   Played: ${topTeam.played}`);
      console.log(`   W-D-L: ${topTeam.won}-${topTeam.drawn}-${topTeam.lost}`);
      console.log(`   GF-GA: ${topTeam.goals_for}-${topTeam.goals_against} (${topTeam.goal_difference})`);
      console.log(`   Form: ${topTeam.form.join('-')}`);
      console.log(`   Trend: ${topTeam.trend}`);
    }

    console.log('\n');
    console.log('='.repeat(80));
    console.log('\n');

    // Test 4: Get specific team position (Arsenal = 19)
    console.log('📊 Test 4: Getting specific team position...');
    const arsenalPosition = await getTeamPositionInLeague(PREMIER_LEAGUE_ID, 19);
    
    if (arsenalPosition) {
      console.log(`\n✅ Arsenal (ID: 19) in Premier League:`);
      console.log(`   Position: ${arsenalPosition.position}`);
      console.log(`   Points: ${arsenalPosition.points}`);
      console.log(`   Form: ${arsenalPosition.form.join('-')}`);
    }

    console.log('\n');
    console.log('='.repeat(80));
    console.log('✅ ALL TESTS COMPLETE');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ ERROR:', error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

run();
