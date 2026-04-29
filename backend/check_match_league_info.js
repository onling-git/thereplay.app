// Check if matches have league info
require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');

async function checkMatchLeagueInfo() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB\n');

    // Get a few recent matches
    const matches = await Match.find({})
      .sort({ date: -1 })
      .limit(5)
      .lean();

    console.log('📊 Checking match_info.league structure in recent matches:\n');

    matches.forEach((match, i) => {
      console.log(`${i + 1}. Match ID: ${match.match_id}`);
      console.log(`   Teams: ${match.teams?.home?.team_name} vs ${match.teams?.away?.team_name}`);
      console.log(`   Has match_info: ${!!match.match_info}`);
      console.log(`   Has league: ${!!match.match_info?.league}`);
      console.log(`   League ID: ${match.match_info?.league?.id || 'MISSING'}`);
      console.log(`   League name: ${match.match_info?.league?.name || 'N/A'}`);
      console.log('   Full league object:', JSON.stringify(match.match_info?.league, null, 2));
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

checkMatchLeagueInfo().catch(console.error);
