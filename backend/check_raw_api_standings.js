// Check raw API standings data structure
require('dotenv').config();
const { get } = require('./utils/sportmonks');

const CHAMPIONSHIP_ID = 9;

(async () => {
  try {
    console.log('='.repeat(80));
    console.log('🔍 Checking Raw Sportmonks Standings API Data');
    console.log('='.repeat(80));

    // Get current season for Championship
    const leagueResponse = await get(`/leagues/${CHAMPIONSHIP_ID}`, {
      include: 'currentseason'
    });
    
    const currentSeason = leagueResponse.data?.data?.currentseason;
    if (!currentSeason) {
      console.log('❌ No current season found');
      return;
    }
    
    console.log(`\nLeague: Championship (ID: ${CHAMPIONSHIP_ID})`);
    console.log(`Season: ${currentSeason.name} (ID: ${currentSeason.id})\n`);

    // Fetch standings with details
    const standingsResponse = await get(`/standings/seasons/${currentSeason.id}`, {
      include: 'details'
    });
    
    const standings = standingsResponse.data?.data;

    if (!Array.isArray(standings) || standings.length === 0) {
      console.log('❌ No standings found');
      return;
    }

    console.log(`✅ Found ${standings.length} teams\n`);

    // Show first team's full structure
    console.log('📋 FIRST TEAM RAW DATA:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(standings[0], null, 2));
    console.log('\n');

    // Show details array specifically
    if (standings[0].details) {
      console.log('📊 DETAILS ARRAY (type_id mapping):');
      console.log('='.repeat(80));
      standings[0].details.forEach(detail => {
        console.log(`  type_id ${detail.type_id}: ${detail.value} (${detail.type?.name || 'unknown'})`);
      });
      console.log('\n');
    }

    // Show a few more teams
    console.log('📋 TOP 3 TEAMS WITH DETAILS:');
    console.log('='.repeat(80));
    standings.slice(0, 3).forEach((team, idx) => {
      console.log(`\n${idx + 1}. Position ${team.position}:`);
      console.log(`   Participant ID: ${team.participant_id}`);
      console.log(`   Points: ${team.points}`);
      console.log(`   Details:`);
      if (team.details) {
        team.details.forEach(d => {
          console.log(`     - type_id ${d.type_id}: ${d.value}`);
        });
      }
    });

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    if (error.response?.data) {
      console.error('API Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
})();
