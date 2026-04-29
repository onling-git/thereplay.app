// Check match 19432244 for live data issues
const mongoose = require('mongoose');
require('dotenv').config();
const Match = require('./models/Match');

async function checkMatch19432244() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB\n');

    const matchId = 19432244;
    
    // Find the match
    const match = await Match.findOne({ match_id: matchId }).lean();
    
    if (!match) {
      console.log('❌ Match not found in database');
      process.exit(1);
    }

    console.log('📊 Match Information:');
    console.log('   ID:', match.match_id);
    console.log('   Home:', match.teams?.home?.team_name);
    console.log('   Away:', match.teams?.away?.team_name);
    console.log('   Score:', `${match.score?.home || 0} - ${match.score?.away || 0}`);
    console.log('   Status:', match.match_status?.state || match.match_status?.short_name);
    console.log('   Minute:', match.minute);
    console.log('\n');

    // Check for lineup data
    console.log('👥 Lineup Data:');
    if (match.lineup) {
      console.log('   ✅ Lineup exists');
      console.log('   Home players:', match.lineup.home?.length || 0);
      console.log('   Away players:', match.lineup.away?.length || 0);
    } else {
      console.log('   ❌ No lineup data');
    }
    console.log('\n');

    // Check for statistics
    console.log('📈 Statistics Data:');
    if (match.statistics) {
      console.log('   ✅ Statistics exists');
      console.log('   Home stats:', match.statistics.home?.length || 0);
      console.log('   Away stats:', match.statistics.away?.length || 0);
      if (match.statistics.home?.length > 0) {
        console.log('   Sample stats:');
        match.statistics.home.slice(0, 3).forEach(stat => {
          console.log(`      - ${stat.type}: ${stat.value}`);
        });
      }
    } else {
      console.log('   ❌ No statistics data');
    }
    console.log('\n');

    // Check for commentary
    console.log('💬 Commentary Data:');
    if (match.commentary && match.commentary.length > 0) {
      console.log('   ✅ Commentary exists');
      console.log('   Total comments:', match.commentary.length);
      console.log('   Recent comment:', match.commentary[match.commentary.length - 1]?.comment);
    } else {
      console.log('   ❌ No commentary data');
    }
    console.log('\n');

    // Check for events
    console.log('⚽ Events Data:');
    if (match.events && match.events.length > 0) {
      console.log('   ✅ Events exist');
      console.log('   Total events:', match.events.length);
      match.events.slice(0, 5).forEach(evt => {
        console.log(`      - ${evt.minute}' ${evt.type}: ${evt.player_name || evt.description}`);
      });
    } else {
      console.log('   ❌ No events data');
    }
    console.log('\n');

    // Check last update
    console.log('🕐 Update Information:');
    console.log('   Last updated:', match.updatedAt);
    console.log('   Created:', match.createdAt);
    
    const timeSinceUpdate = Date.now() - new Date(match.updatedAt).getTime();
    const minutesSinceUpdate = Math.floor(timeSinceUpdate / 60000);
    console.log('   Minutes since last update:', minutesSinceUpdate);
    console.log('\n');

    // Output full match object for debugging
    console.log('🔍 Full Match Object:');
    console.log(JSON.stringify(match, null, 2));

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

checkMatch19432244();
