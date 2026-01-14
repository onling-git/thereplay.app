// Delete and recreate match 19432044 with clean SportMonks data
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

async function deleteExistingMatch(matchId) {
  console.log(`🗑️ Deleting existing match ${matchId}...`);
  const result = await Match.deleteOne({ match_id: matchId });
  console.log(`✅ Deleted ${result.deletedCount} match(es)`);
}

async function fetchAndCreateMatch(matchId) {
  console.log('🔍 Fetching fresh data from SportMonks...');
  
  const url = `https://api.sportmonks.com/v3/football/fixtures/${matchId}?api_token=o02EpD6kCh7HWuCN2GDzCMGPOyiXXtt6eLXyOfVmLFTvEQr0gHyTj8ZEX2cJ&include=state;lineups.details;comments;scores;coaches;venue;events;periods;participants;referees;formations`;
  
  const response = await axios.get(url);
  const data = response.data.data;
  
  // Parse teams
  const homeTeam = data.participants?.find(p => p.meta?.location === 'home');
  const awayTeam = data.participants?.find(p => p.meta?.location === 'away');
  
  console.log(`Teams: ${homeTeam?.name} (home) vs ${awayTeam?.name} (away)`);
  
  // Parse scores
  const homeScore = data.scores?.find(s => s.participant_id === homeTeam?.id)?.score?.goals || 0;
  const awayScore = data.scores?.find(s => s.participant_id === awayTeam?.id)?.score?.goals || 0;
  
  // Parse lineups
  const homeLineup = [];
  const awayLineup = [];
  
  data.lineups?.forEach(playerLineup => {
    const isHome = playerLineup.team_id === homeTeam?.id;
    const targetArray = isHome ? homeLineup : awayLineup;
    
    targetArray.push({
      player_id: playerLineup.player_id,
      player_name: playerLineup.player_name?.trim() || '',
      jersey_number: playerLineup.jersey_number,
      position_id: playerLineup.position_id,
      formation_position: playerLineup.formation_position,
      formation_field: playerLineup.formation_field,
      type: 'STARTING_XI', // We'll determine this better later
      image_path: '',
      details: playerLineup.details || []
    });
  });
  
  console.log(`Lineups: ${homeLineup.length} home, ${awayLineup.length} away`);
  
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
  
  // Create new match document
  const newMatch = new Match({
    match_id: matchId,
    date: new Date(data.starting_at),
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
    match_info: {
      starting_at: new Date(data.starting_at),
      starting_at_timestamp: data.starting_at_timestamp,
      venue: data.venue ? {
        id: data.venue.id,
        name: data.venue.name || '',
        capacity: data.venue.capacity,
        image_path: data.venue.image_path || ''
      } : {}
    },
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  console.log('💾 Creating new match document...');
  const savedMatch = await newMatch.save();
  
  console.log('✅ Match created successfully!');
  console.log(`Teams: ${savedMatch.teams.home.team_name} vs ${savedMatch.teams.away.team_name}`);
  console.log(`Score: ${savedMatch.score.home} - ${savedMatch.score.away}`);
  console.log(`Total players: ${savedMatch.lineup.home.length + savedMatch.lineup.away.length}`);
  
  // Check formation data
  const homeWithFormation = savedMatch.lineup.home.filter(p => p.formation_field || p.formation_position).length;
  const awayWithFormation = savedMatch.lineup.away.filter(p => p.formation_field || p.formation_position).length;
  console.log(`Formation data: ${homeWithFormation + awayWithFormation} players`);
  
  if (homeWithFormation > 0) {
    const sample = savedMatch.lineup.home.find(p => p.formation_field);
    console.log(`Sample: ${sample.player_name} - Field: ${sample.formation_field}, Position: ${sample.formation_position}`);
  }
  
  return savedMatch;
}

async function main() {
  const matchId = 19432044;
  
  try {
    await connectDB();
    
    // Delete existing match
    await deleteExistingMatch(matchId);
    
    // Create new match from scratch
    await fetchAndCreateMatch(matchId);
    
    console.log('\n🎉 SUCCESS! Match has been completely recreated with clean SportMonks data.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('📦 Disconnected from MongoDB');
  }
}

main().catch(console.error);