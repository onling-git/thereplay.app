// Force delete ALL matches with match_id 19432044 and recreate from scratch
require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');

async function connectDB() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('📦 Connected to MongoDB');
  }
}

async function forceDeleteAllMatches(matchId) {
  console.log(`🗑️ Force deleting ALL matches with match_id ${matchId}...`);
  
  // Delete using raw MongoDB operations to be sure
  const db = mongoose.connection.db;
  const result = await db.collection('matches').deleteMany({ match_id: matchId });
  console.log(`✅ Deleted ${result.deletedCount} match document(s) from raw MongoDB`);
  
  // Also try with Mongoose model
  const Match = require('./models/Match');
  const modelResult = await Match.deleteMany({ match_id: matchId });
  console.log(`✅ Deleted ${modelResult.deletedCount} additional match(es) via Mongoose model`);
  
  // Verify deletion
  const remaining = await Match.find({ match_id: matchId });
  console.log(`📊 Remaining matches: ${remaining.length}`);
  
  return remaining.length === 0;
}

async function createCleanMatch(matchId) {
  console.log('🔍 Fetching fresh SportMonks data...');
  
  const url = `https://api.sportmonks.com/v3/football/fixtures/${matchId}?api_token=o02EpD6kCh7HWuCN2GDzCMGPOyiXXtt6eLXyOfVmLFTvEQr0gHyTj8ZEX2cJ&include=state;lineups.details;comments;scores;coaches;venue;events;periods;participants;referees;formations;stage`;
  
  const response = await axios.get(url);
  const data = response.data.data;
  
  // Parse teams
  const homeTeam = data.participants?.find(p => p.meta?.location === 'home');
  const awayTeam = data.participants?.find(p => p.meta?.location === 'away');
  
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
      type: 'STARTING_XI',
      image_path: '',
      details: playerLineup.details || []
    });
  });
  
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
  
  console.log(`✅ Parsed data: ${homeTeam?.name} vs ${awayTeam?.name}`);
  console.log(`   Lineups: ${homeLineup.length} home + ${awayLineup.length} away = ${homeLineup.length + awayLineup.length} total`);
  console.log(`   Formation players: ${homeLineup.filter(p => p.formation_field).length + awayLineup.filter(p => p.formation_field).length}`);
  console.log(`   Events: ${events.length}, Comments: ${comments.length}`);
  
  // Create match document using raw MongoDB insert
  const db = mongoose.connection.db;
  const matchDoc = {
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
  };
  
  console.log('💾 Inserting new match via raw MongoDB...');
  const insertResult = await db.collection('matches').insertOne(matchDoc);
  console.log(`✅ Inserted match with _id: ${insertResult.insertedId}`);
  
  return insertResult.insertedId;
}

async function main() {
  const matchId = 19432044;
  
  try {
    await connectDB();
    
    // Force delete all existing matches
    const deleted = await forceDeleteAllMatches(matchId);
    
    if (!deleted) {
      console.log('❌ Failed to delete all matches. Exiting.');
      return;
    }
    
    // Create completely new match
    const insertedId = await createCleanMatch(matchId);
    
    console.log('\n🎉 SUCCESS! Match completely recreated from scratch.');
    console.log(`   New document ID: ${insertedId}`);
    
    // Final verification
    const Match = require('./models/Match');
    const verifyMatch = await Match.findOne({ match_id: matchId });
    if (verifyMatch) {
      console.log('✅ VERIFICATION:');
      console.log(`   Teams: ${verifyMatch.teams.home.team_name} vs ${verifyMatch.teams.away.team_name}`);
      console.log(`   Players: ${verifyMatch.lineup.home.length + verifyMatch.lineup.away.length}`);
      const formationPlayers = verifyMatch.lineup.home.filter(p => p.formation_field).length + 
                              verifyMatch.lineup.away.filter(p => p.formation_field).length;
      console.log(`   Formation players: ${formationPlayers}`);
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