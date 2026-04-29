const mongoose = require('mongoose');
require('dotenv').config();
const Match = require('./models/Match');

async function checkMatch() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB');

    const matchId = 19432230;
    const match = await Match.findOne({ match_id: matchId });

    if (!match) {
      console.log(`❌ Match ${matchId} not found in database`);
      return;
    }

    console.log('\n📊 Match Details:');
    console.log('Match ID:', match.match_id);
    console.log('Home Team:', match.teams?.home?.team_name);
    console.log('Away Team:', match.teams?.away?.team_name);
    
    console.log('\n⏰ Time Information:');
    console.log('starting_at:', match.match_info?.starting_at);
    console.log('starting_at_timestamp:', match.match_info?.starting_at_timestamp);
    
    if (match.match_info?.starting_at_timestamp) {
      const timestamp = match.match_info.starting_at_timestamp;
      const date = new Date(timestamp * 1000);
      console.log('Timestamp as Date (Local):', date.toLocaleString());
    }
    
    if (match.match_info?.starting_at) {
      const date = new Date(match.match_info.starting_at);
      console.log('starting_at as Date (Local):', date.toLocaleString());
    }
    
    // Check for consistency
    if (match.match_info?.starting_at_timestamp && match.match_info?.starting_at) {
      const timestampDate = new Date(match.match_info.starting_at_timestamp * 1000);
      const startingAtDate = new Date(match.match_info.starting_at);
      const diff = Math.abs(timestampDate.getTime() - startingAtDate.getTime());
      
      if (diff > 60000) {
        console.log(`\n⚠️  WARNING: ${Math.round(diff / 60000)} minute difference!`);
      } else {
        console.log('\n✅ Times are consistent!');
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkMatch();
