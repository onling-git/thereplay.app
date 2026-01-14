// list_existing_matches.js
const mongoose = require('mongoose');
const Match = require('./models/Match');

async function listMatches() {
  require('dotenv').config();
  const uri = process.env.DBURI || process.env.MONGODB_URI || "mongodb://localhost:27017/thefinalplay";
  await mongoose.connect(uri);
  console.log('📊 Connected to database:', uri.substring(0, 50) + '...');

  try {
    const totalCount = await Match.countDocuments({});
    console.log(`Total matches: ${totalCount}`);
    
    if (totalCount > 0) {
      const matches = await Match.find({})
        .sort({ _id: -1 })
        .limit(10)
        .lean();
        
      console.log(`\nRecent matches:`);
      matches.forEach(m => {
        const homeTeam = m.teams?.home?.team_name || 'Unknown';
        const awayTeam = m.teams?.away?.team_name || 'Unknown';
        console.log(`- ID: ${m.match_id} | ${homeTeam} vs ${awayTeam} | Status: ${m.match_status}`);
        console.log(`  Lineup: Home(${m.lineup?.home?.length || 0}) Away(${m.lineup?.away?.length || 0})`);
        
        // Check formation data briefly
        if (m.lineup?.home?.length > 0) {
          const homeWithFormation = m.lineup.home.filter(p => p.formation_position != null || p.formation_field != null);
          console.log(`  Formation data: ${homeWithFormation.length}/${m.lineup.home.length} home players`);
        }
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Done');
  }
}

listMatches().catch(console.error);