require('dotenv').config();
const { get } = require('./utils/sportmonks');
const Match = require('./models/Match');
const mongoose = require('mongoose');

async function updateMatch(matchId) {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB');
    
    console.log(`\n🔍 Fetching match ${matchId} from SportMonks API...`);
    
    const response = await get(`fixtures/${matchId}`, {
      include: 'state;participants;scores;venue;events;stage;league'
    });
    
    const data = response.data.data;
    
    console.log('📊 API Data received:', data.name);
    console.log('   Date:', data.starting_at);
    console.log('   Timestamp:', data.starting_at_timestamp);
    
    // Parse participants
    const homeTeam = data.participants?.find(p => p.meta?.location === 'home');
    const awayTeam = data.participants?.find(p => p.meta?.location === 'away');
    
    // Parse scores
    const homeScore = data.scores?.find(s => s.participant_id === homeTeam?.id)?.score?.goals || 0;
    const awayScore = data.scores?.find(s => s.participant_id === awayTeam?.id)?.score?.goals || 0;
    
    // Update the match in database
    const update = {
      match_id: data.id,
      'match_info.starting_at': data.starting_at,
      'match_info.starting_at_timestamp': data.starting_at_timestamp,
      'date': new Date(data.starting_at),
      'match_status.name': data.state?.state,
      'match_status.short_name': data.state?.short_name,
      'match_status.state': data.state?.state,
      'teams.home.team_id': homeTeam?.id,
      'teams.home.team_name': homeTeam?.name,
      'teams.home.logo': homeTeam?.image_path,
      'teams.away.team_id': awayTeam?.id,
      'teams.away.team_name': awayTeam?.name,
      'teams.away.logo': awayTeam?.image_path,
      'score.home': homeScore,
      'score.away': awayScore,
      'match_info.venue.id': data.venue?.id,
      'match_info.venue.name': data.venue?.name,
      'match_info.venue.city': data.venue?.city_name,
      'match_info.league.id': data.league_id,
      'match_info.league.name': data.league?.name,
      'match_info.stage.id': data.stage?.id,
      'match_info.stage.name': data.stage?.name,
      updated_at: new Date()
    };
    
    const result = await Match.updateOne(
      { match_id: matchId },
      { $set: update }
    );
    
    if (result.modifiedCount > 0) {
      console.log('\n✅ Match updated successfully!');
      
      // Verify the update
      const updated = await Match.findOne({ match_id: matchId });
      console.log('\n📊 Updated Database Values:');
      console.log('   starting_at:', updated.match_info?.starting_at);
      console.log('   starting_at_timestamp:', updated.match_info?.starting_at_timestamp);
      console.log('   date:', updated.date);
      
      if (updated.match_info?.starting_at_timestamp) {
        const date = new Date(updated.match_info.starting_at_timestamp * 1000);
        console.log('   Display time (local):', date.toLocaleString());
      }
    } else {
      console.log('\n⚠️ No changes made (match might already be up to date)');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  } finally {
    await mongoose.disconnect();
  }
}

// Update match 19432238
updateMatch(19432238);
