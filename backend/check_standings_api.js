const mongoose = require('mongoose');
require('dotenv').config();
const Standing = require('./models/Standing');

async function checkStandings() {
  try {
    const uri = process.env.DBURI || process.env.MONGODB_URI || process.env.DATABASE_URL;
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    const leagueId = 9; // Championship
    
    console.log(`\n=== Checking standings for League ID ${leagueId} ===`);
    
    const standings = await Standing.find({ league_id: leagueId })
      .sort({ season_name: -1 })
      .limit(5)
      .lean();
    
    if (standings.length === 0) {
      console.log('❌ No standings found for league ID', leagueId);
    } else {
      console.log(`✅ Found ${standings.length} standings records`);
      standings.forEach(s => {
        console.log(`\n  Season: ${s.season_name}`);
        console.log(`  League: ${s.league_name}`);
        console.log(`  Teams in table: ${s.table?.length || 0}`);
        console.log(`  Season ID: ${s.season_id}`);
        console.log(`  Has Current: ${s.has_current_season}`);
      });
      
      // Show a sample team entry
      if (standings[0]?.table?.length > 0) {
        console.log('\n  Sample team entry:');
        console.log(JSON.stringify(standings[0].table[0], null, 2));
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkStandings();
