// Check what matches exist in the database
require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');

async function main() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/thefinalplay');
    console.log('✅ Connected to MongoDB');

    // Look for matches with Southampton
    console.log('🔍 Searching for Southampton matches...');
    
    const southamptonMatches = await Match.find({
      $or: [
        { 'teams.home.team_name': /southampton/i },
        { 'teams.away.team_name': /southampton/i },
        { home_team: /southampton/i },
        { away_team: /southampton/i }
      ]
    }).sort({ date: -1 }).limit(10);

    console.log(`\n📊 Found ${southamptonMatches.length} Southampton matches:`);
    
    southamptonMatches.forEach((match, i) => {
      console.log(`${i + 1}. Match ID: ${match.match_id}`);
      console.log(`   Teams: ${match.teams?.home?.team_name || match.home_team} vs ${match.teams?.away?.team_name || match.away_team}`);
      console.log(`   Date: ${match.date || match.match_info?.starting_at}`);
      console.log(`   Score: ${match.score?.home || 0} - ${match.score?.away || 0}`);
      console.log(`   Status: ${match.match_status?.name || match.status || 'Unknown'}`);
      console.log('');
    });

    // Also check for match with ID 19432044 specifically
    console.log('🎯 Checking specifically for match ID 19432044...');
    const targetMatch = await Match.findOne({ match_id: 19432044 });
    
    if (targetMatch) {
      console.log('✅ Found match 19432044:');
      console.log(`   Teams: ${targetMatch.teams?.home?.team_name || targetMatch.home_team} vs ${targetMatch.teams?.away?.team_name || targetMatch.away_team}`);
      console.log(`   Date: ${targetMatch.date || targetMatch.match_info?.starting_at}`);
      console.log(`   Has lineup data: ${targetMatch.lineup ? 'Yes' : 'No'}`);
      console.log(`   Lineup structure: ${JSON.stringify(Object.keys(targetMatch.lineup || {}))}`);
    } else {
      console.log('❌ Match ID 19432044 not found in database');
      console.log('💡 The match may need to be created first, or there may be a different ID');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

if (require.main === module) {
  main().catch(console.error);
}