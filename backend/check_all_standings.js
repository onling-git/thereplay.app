// Check what leagues are now in the database
require('dotenv').config();
const mongoose = require('mongoose');
const Standing = require('./models/Standing');

(async () => {
  try {
    const uri = process.env.DBURI || process.env.MONGODB_URI || process.env.DATABASE_URL;
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB\n');

    console.log('📊 Checking all standings in database...\n');
    
    // Get all unique league standings
    const standings = await Standing.find({})
      .select('league_id league_name season_name table')
      .sort({ league_id: 1, season_id: -1 })
      .lean();
    
    // Group by league
    const leagueMap = {};
    standings.forEach(s => {
      if (!leagueMap[s.league_id]) {
        leagueMap[s.league_id] = {
          name: s.league_name,
          seasons: []
        };
      }
      leagueMap[s.league_id].seasons.push({
        season: s.season_name,
        teams: s.table?.length || 0
      });
    });
    
    console.log('Available Leagues with Standings:');
    console.log('='.repeat(80));
    
    Object.entries(leagueMap).forEach(([id, data]) => {
      console.log(`\n🏆 ${data.name} (ID: ${id})`);
      data.seasons.forEach(s => {
        console.log(`   - ${s.season}: ${s.teams} teams`);
      });
    });
    
    console.log('\n' + '='.repeat(80));
    console.log(`Total leagues with standings: ${Object.keys(leagueMap).length}`);
    console.log(`Total standing records: ${standings.length}`);

  } catch (error) {
    console.error('❌ ERROR:', error.message);
  } finally {
    await mongoose.disconnect();
  }
})();
