// Check if standings exist for La Liga 2
require('dotenv').config();
const mongoose = require('mongoose');
const Standing = require('./models/Standing');

async function checkStandingsForLeague() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB\n');

    const leagueId = 567; // La Liga 2

    const standings = await Standing.findOne({ league_id: leagueId }).lean();

    if (!standings) {
      console.log(`❌ No standings found for league ID ${leagueId}`);
    } else {
      console.log(`✅ Standings found for ${standings.league_name} (${standings.season_name})`);
      console.log(`   Teams in table: ${standings.table?.length || 0}`);
      console.log(`   Last updated: ${standings.last_updated}`);
    }

    // Now check a Premier League match
    const Match = require('./models/Match');
    const plMatch = await Match.findOne({
      'match_info.league.id': 8 // Premier League
    }).lean();

    if (plMatch) {
      console.log(`\n📊 Found Premier League match: ${plMatch.match_id}`);
      console.log(`   Teams: ${plMatch.teams?.home?.team_name} vs ${plMatch.teams?.away?.team_name}`);
      console.log(`   League ID: ${plMatch.match_info?.league?.id}`);
      
      const plStandings = await Standing.findOne({ league_id: 8 }).lean();
      if (plStandings) {
        console.log(`   ✅ Standings exist for ${plStandings.league_name}`);
      } else {
        console.log(`   ❌ No standings found for Premier League`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

checkStandingsForLeague().catch(console.error);
