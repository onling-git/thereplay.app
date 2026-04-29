const mongoose = require('mongoose');
require('dotenv').config();
const Match = require('./models/Match');

async function checkMatch() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB');

    const matchId = 19432238;
    const match = await Match.findOne({ match_id: matchId });

    if (!match) {
      console.log(`❌ Match ${matchId} not found in database`);
      return;
    }

    console.log('\n📊 Match Details:');
    console.log('Match ID:', match.match_id);
    console.log('Home Team:', match.teams?.home?.team_name);
    console.log('Away Team:', match.teams?.away?.team_name);
    console.log('Status:', match.match_status?.name, `(${match.match_status?.short_name})`);
    
    console.log('\n⏰ Time Information:');
    console.log('starting_at (ISO):', match.match_info?.starting_at);
    console.log('starting_at_timestamp:', match.match_info?.starting_at_timestamp);
    
    if (match.match_info?.starting_at_timestamp) {
      const timestamp = match.match_info.starting_at_timestamp;
      const date = new Date(timestamp * 1000);
      console.log('Timestamp as Date (UTC):', date.toUTCString());
      console.log('Timestamp as Date (Local):', date.toLocaleString());
      console.log('Timestamp as Date (ISO):', date.toISOString());
    }
    
    if (match.match_info?.starting_at) {
      const date = new Date(match.match_info.starting_at);
      console.log('starting_at as Date (UTC):', date.toUTCString());
      console.log('starting_at as Date (Local):', date.toLocaleString());
      console.log('starting_at as Date (ISO):', date.toISOString());
    }
    
    console.log('Legacy date field:', match.date);
    
    console.log('\n🏆 Competition:');
    console.log('League:', match.match_info?.league?.name);
    console.log('Stage:', match.match_info?.stage?.name);
    console.log('Round:', match.match_info?.round?.name);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkMatch();
