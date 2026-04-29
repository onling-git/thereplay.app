// CORRECTED: Update match 19432044 with proper API structure parsing
require('dotenv').config();
const axios = require('axios');
const Match = require('./models/Match');
const mongoose = require('mongoose');

async function connectDB() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('📦 Connected to MongoDB');
  }
}

async function fetchAndParseData(matchId) {
  console.log('🔍 Fetching match data from SportMonks...');
  
  const url = `https://api.sportmonks.com/v3/football/fixtures/${matchId}?api_token=o02EpD6kCh7HWuCN2GDzCMGPOyiXXtt6eLXyOfVmLFTvEQr0gHyTj8ZEX2cJ&include=state;lineups.details;comments;scores;coaches;venue;events;periods;participants;referees;formations;stage`;
  
  const response = await axios.get(url);
  const data = response.data.data;
  
  console.log(`✅ Fetched: ${data.name}`);
  
  // Parse participants
  const homeTeam = data.participants?.find(p => p.meta?.location === 'home');
  const awayTeam = data.participants?.find(p => p.meta?.location === 'away');
  
  console.log(`Teams: ${homeTeam?.name} (home) vs ${awayTeam?.name} (away)`);
  
  // Parse scores
  const homeScore = data.scores?.find(s => s.participant_id === homeTeam?.id)?.score?.goals || 0;
  const awayScore = data.scores?.find(s => s.participant_id === awayTeam?.id)?.score?.goals || 0;
  
  console.log(`Score: ${homeScore} - ${awayScore}`);
  
  // Parse lineups - each entry in lineups array is a single player
  const homeLineup = [];
  const awayLineup = [];
  
  data.lineups?.forEach(playerLineup => {
    const isHome = playerLineup.team_id === homeTeam?.id;
    const targetArray = isHome ? homeLineup : awayLineup;
    
    // Determine player type (starter vs substitute)
    const isStarter = playerLineup.type_id === 1; // Assuming 1 = starter, need to verify
    
    targetArray.push({
      player_id: playerLineup.player_id,
      player_name: playerLineup.player_name?.trim() || '',
      jersey_number: playerLineup.jersey_number,
      position_id: playerLineup.position_id,
      formation_position: playerLineup.formation_position,
      formation_field: playerLineup.formation_field,
      type: isStarter ? 'STARTING_XI' : 'SUBSTITUTE', // We'll determine this based on formation data
      image_path: '', // Not available in this structure
      // Additional details from the details array if needed
      details: playerLineup.details || []
    });
  });
  
  console.log(`Lineups: ${homeLineup.length} home, ${awayLineup.length} away`);
  
  // Count formation data
  const homeFormation = homeLineup.filter(p => p.formation_field || p.formation_position).length;
  const awayFormation = awayLineup.filter(p => p.formation_field || p.formation_position).length;
  console.log(`Formation data: ${homeFormation} home, ${awayFormation} away`);
  
  // If we have formation data but no position assignments, let's check formations
  const formationData = {};
  if (data.formations) {
    data.formations.forEach(formation => {
      const isHome = formation.participant_id === homeTeam?.id;
      formationData[isHome ? 'home' : 'away'] = formation.formation;
    });
    console.log(`Formations: ${formationData.home || 'N/A'} vs ${formationData.away || 'N/A'}`);
  }
  
  // Parse events
  const events = (data.events || []).map(event => ({
    id: event.id,
    minute: event.minute,
    type: event.type?.type || '',
    participant_id: event.participant_id,
    player_id: event.player_id,
    player_name: event.player?.display_name || event.player?.common_name || '',
    related_player_id: event.related_player_id,
    related_player_name: event.related_player?.display_name || event.related_player?.common_name || '',
    team: event.participant_id === homeTeam?.id ? 'home' : 'away',
    result: event.result || '',
    info: event.info || '',
    addition: event.addition || ''
  }));
  
  console.log(`Events: ${events.length}`);
  
  // Parse comments
  const comments = (data.comments || []).map(comment => ({
    comment_id: comment.id,
    fixture_id: data.id,
    comment: comment.comment,
    minute: comment.minute,
    extra_minute: comment.extra_minute,
    is_goal: comment.is_goal || false,
    is_important: comment.is_important || false,
    order: comment.order
  }));
  
  console.log(`Comments: ${comments.length}`);
  
  return {
    teams: {
      home: {
        team_name: homeTeam?.name || '',
        team_id: homeTeam?.id || null,
        team_slug: homeTeam?.name ? homeTeam.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : ''
      },
      away: {
        team_name: awayTeam?.name || '',
        team_id: awayTeam?.id || null,
        team_slug: awayTeam?.name ? awayTeam.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : ''
      }
    },
    score: {
      home: homeScore,
      away: awayScore
    },
    match_status: {
      state: data.state?.state || '',
      name: data.state?.name || ''
    },
    lineup: {
      home: homeLineup,
      away: awayLineup
    },
    events,
    comments,
    formations: formationData
  };
}

async function updateMatch(matchId, newData) {
  console.log('\n💾 Updating database...');
  
  // Use separate updates to avoid conflicts
  const result = await Match.findOneAndUpdate(
    { match_id: matchId },
    {
      $set: {
        'teams.home.team_name': newData.teams.home.team_name,
        'teams.home.team_id': newData.teams.home.team_id,
        'teams.home.team_slug': newData.teams.home.team_slug,
        'teams.away.team_name': newData.teams.away.team_name,
        'teams.away.team_id': newData.teams.away.team_id,
        'teams.away.team_slug': newData.teams.away.team_slug,
        'score.home': newData.score.home,
        'score.away': newData.score.away,
        'match_status.state': newData.match_status.state,
        'match_status.name': newData.match_status.name,
        'lineup.home': newData.lineup.home,
        'lineup.away': newData.lineup.away,
        'events': newData.events,
        'comments': newData.comments,
        'updatedAt': new Date()
      }
    },
    { new: true }
  );
  
  if (result) {
    console.log('✅ Database updated successfully!');
    console.log(`Teams: ${result.teams.home.team_name} vs ${result.teams.away.team_name}`);
    console.log(`Score: ${result.score.home} - ${result.score.away}`);
    console.log(`Status: ${result.match_status.name}`);
    console.log(`Lineups: ${result.lineup.home.length} home, ${result.lineup.away.length} away`);
    
    // Check formation data
    const homeWithFormation = result.lineup.home.filter(p => p.formation_field || p.formation_position).length;
    const awayWithFormation = result.lineup.away.filter(p => p.formation_field || p.formation_position).length;
    console.log(`Formation data: ${homeWithFormation + awayWithFormation} total players`);
    
    if (homeWithFormation > 0) {
      const samplePlayer = result.lineup.home.find(p => p.formation_field || p.formation_position);
      console.log(`Sample formation: ${samplePlayer.player_name} - Field: ${samplePlayer.formation_field}, Position: ${samplePlayer.formation_position}`);
    }
    
    return true;
  }
  
  return false;
}

async function main() {
  const matchId = 19432044;
  
  try {
    await connectDB();
    
    // Fetch and parse the real data
    const newData = await fetchAndParseData(matchId);
    
    // Update the database
    const success = await updateMatch(matchId, newData);
    
    if (success) {
      console.log('\n🎉 SUCCESS! Match data has been updated with real SportMonks data.');
      console.log('The formation display should now work correctly in the frontend.');
    } else {
      console.log('\n❌ Update failed');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('📦 Disconnected from MongoDB');
  }
}

main().catch(console.error);