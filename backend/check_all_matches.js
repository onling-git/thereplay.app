// Check all matches in the database
require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');

async function main() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/thefinalplay');
    console.log('✅ Connected to MongoDB');

    // Get total count
    const totalMatches = await Match.countDocuments();
    console.log(`📊 Total matches in database: ${totalMatches}`);

    if (totalMatches === 0) {
      console.log('🚨 Database appears to be empty!');
      return;
    }

    // Get recent matches
    console.log('\n🔍 Recent matches:');
    const recentMatches = await Match.find({})
      .sort({ date: -1, createdAt: -1 })
      .limit(10)
      .select('match_id home_team away_team teams date score match_status status');

    recentMatches.forEach((match, i) => {
      console.log(`${i + 1}. Match ID: ${match.match_id}`);
      console.log(`   Teams: ${match.teams?.home?.team_name || match.home_team} vs ${match.teams?.away?.team_name || match.away_team}`);
      console.log(`   Date: ${match.date || match.match_info?.starting_at}`);
      console.log(`   Score: ${match.score?.home || 0} - ${match.score?.away || 0}`);
      console.log('');
    });

    // Look for any matches with ID around 19432044
    console.log('🎯 Looking for matches with similar IDs to 19432044...');
    const similarIdMatches = await Match.find({
      match_id: { 
        $gte: 19432040, 
        $lte: 19432050 
      }
    });

    console.log(`Found ${similarIdMatches.length} matches with similar IDs:`);
    similarIdMatches.forEach(match => {
      console.log(`   Match ID: ${match.match_id} - ${match.teams?.home?.team_name || match.home_team} vs ${match.teams?.away?.team_name || match.away_team}`);
    });

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