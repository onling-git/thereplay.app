require('dotenv').config();
const { get } = require('./utils/sportmonks');
const Match = require('./models/Match');
const mongoose = require('mongoose');

async function updateMatch19432230() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB');
    
    const matchId = 19432230;
    console.log(`\n🔍 Fetching match ${matchId} from SportMonks API...`);
    
    const response = await get(`fixtures/${matchId}`, {
      include: 'state;participants;scores;venue;stage;league'
    });
    
    const data = response.data.data;
    
    console.log('📊 API Data:');
    console.log('Match:', data.name);
    console.log('starting_at:', data.starting_at);
    console.log('starting_at_timestamp:', data.starting_at_timestamp);
    
    if (data.starting_at_timestamp) {
      const date = new Date(data.starting_at_timestamp * 1000);
      console.log('Timestamp display (local):', date.toLocaleString());
    }
    
    // Parse participants
    const homeTeam = data.participants?.find(p => p.meta?.location === 'home');
    const awayTeam = data.participants?.find(p => p.meta?.location === 'away');
    
    // Parse scores
    const homeScore = data.scores?.find(s => s.participant_id === homeTeam?.id)?.score?.goals || 0;
    const awayScore = data.scores?.find(s => s.participant_id === awayTeam?.id)?.score?.goals || 0;
    
    // Update
    const update = {
      'match_info.starting_at': data.starting_at,
      'match_info.starting_at_timestamp': data.starting_at_timestamp,
      'date': new Date(data.starting_at),
      'match_status.name': data.state?.state,
      'match_status.short_name': data.state?.short_name,
      'match_status.state': data.state?.state,
      'score.home': homeScore,
      'score.away': awayScore,
      'updated_at': new Date()
    };
    
    const result = await Match.updateOne(
      { match_id: matchId },
      { $set: update }
    );
    
    if (result.modifiedCount > 0) {
      console.log('\n✅ Match updated successfully!');
      
      // Verify
      const updated = await Match.findOne({ match_id: matchId });
      console.log('\n📊 Updated Database Values:');
      console.log('starting_at:', updated.match_info?.starting_at);
      console.log('starting_at_timestamp:', updated.match_info?.starting_at_timestamp);
      
      if (updated.match_info?.starting_at_timestamp) {
        const date = new Date(updated.match_info.starting_at_timestamp * 1000);
        console.log('Display time (local):', date.toLocaleString());
      }
    } else {
      console.log('\n⚠️ No changes made');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

updateMatch19432230();
