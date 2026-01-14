// Update match 19432044 with real SportMonks data using exact working URL
require('dotenv').config();
const axios = require('axios');
const Match = require('./models/Match');
const mongoose = require('mongoose');

// Connect to MongoDB
async function connectDB() {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.DBURI);
      console.log('📦 Connected to MongoDB');
    }
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
}

// Fetch match data using the exact URL format that works in Postman
async function fetchMatchData(matchId) {
  try {
    console.log(`🔍 Fetching match ${matchId} from SportMonks API...`);
    
    // Use standard API token parameter format with your token
    const url = `https://api.sportmonks.com/v3/football/fixtures/${matchId}?api_token=o02EpD6kCh7HWuCN2GDzCMGPOyiXXtt6eLXyOfVmLFTvEQr0gHyTj8ZEX2cJ&include=state;lineups.details;comments;scores;coaches;venue;events;periods;participants;referees;formations`;
    
    console.log(`📡 Making request to SportMonks API...`);
    
    const response = await axios.get(url);
    
    if (!response.data || !response.data.data) {
      throw new Error('No match data received from API');
    }
    
    return response.data.data;
    
  } catch (error) {
    console.error('❌ Error fetching match data:', error.message);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    throw error;
  }
}

// Analyze the fetched data structure
function analyzeMatchData(matchData) {
  console.log('\n🔬 ANALYZING MATCH DATA STRUCTURE:');
  console.log('=====================================');
  
  // Basic match info
  console.log(`📊 Match ID: ${matchData.id}`);
  console.log(`📅 Date: ${matchData.starting_at}`);
  console.log(`🏟️  Venue: ${matchData.venue?.name || 'N/A'}`);
  console.log(`⚽ Status: ${matchData.state?.state || 'Unknown'} (${matchData.state?.name || 'Unknown'})`);
  
  // Teams analysis
  if (matchData.participants && matchData.participants.length >= 2) {
    const homeTeam = matchData.participants.find(p => p.meta?.location === 'home');
    const awayTeam = matchData.participants.find(p => p.meta?.location === 'away');
    
    console.log(`\n🏠 Home Team: ${homeTeam?.name} (ID: ${homeTeam?.id})`);
    console.log(`✈️  Away Team: ${awayTeam?.name} (ID: ${awayTeam?.id})`);
    
    if (matchData.scores && matchData.scores.length > 0) {
      const homeScore = homeTeam ? matchData.scores.find(s => s.participant_id === homeTeam.id) : null;
      const awayScore = awayTeam ? matchData.scores.find(s => s.participant_id === awayTeam.id) : null;
      console.log(`📈 Score: ${homeScore?.goals || 0} - ${awayScore?.goals || 0}`);
    }
  }
  
  // Data availability analysis
  console.log('\n📋 DATA AVAILABILITY:');
  console.log(`   📝 Comments: ${matchData.comments?.length || 0}`);
  console.log(`   👥 Lineups: ${matchData.lineups?.length || 0}`);
  console.log(`   ⚡ Events: ${matchData.events?.length || 0}`);
  console.log(`   📐 Formations: ${matchData.formations?.length || 0}`);
  console.log(`   👨‍💼 Coaches: ${matchData.coaches?.length || 0}`);
  console.log(`   👨‍⚖️ Referees: ${matchData.referees?.length || 0}`);
  console.log(`   ⏱️  Periods: ${matchData.periods?.length || 0}`);
  
  // Lineups detailed analysis
  if (matchData.lineups && matchData.lineups.length > 0) {
    console.log('\n👥 LINEUP ANALYSIS:');
    
    // Debug structure of first few lineup entries
    console.log('   First few lineup entries structure:');
    matchData.lineups.slice(0, 5).forEach((lineup, i) => {
      console.log(`     ${i+1}. Keys: ${Object.keys(lineup).join(', ')}`);
      console.log(`        participant_id: ${lineup.participant_id}`);
      console.log(`        team_id: ${lineup.team_id}`);
      console.log(`        player: ${lineup.player?.display_name || lineup.player?.common_name || 'N/A'}`);
      console.log(`        formation_position: ${lineup.formation_position}`);
      console.log(`        formation_field: ${lineup.formation_field}`);
    });
    
    const lineupsByTeam = {};
    matchData.lineups.forEach(lineup => {
      const teamId = lineup.participant_id || lineup.team_id || 'unknown';
      if (!lineupsByTeam[teamId]) lineupsByTeam[teamId] = [];
      lineupsByTeam[teamId].push(lineup);
    });
    
    Object.keys(lineupsByTeam).forEach(teamId => {
      const teamName = matchData.participants?.find(p => p.id.toString() === teamId.toString())?.name || `Team ${teamId}`;
      const players = lineupsByTeam[teamId];
      const starters = players.filter(p => p.formation_position && p.formation_position <= 11);
      const subs = players.filter(p => !p.formation_position || p.formation_position > 11);
      
      console.log(`   ${teamName}: ${players.length} total (${starters.length} starters, ${subs.length} subs)`);
      
      // Sample formation data
      const samplePlayer = starters[0];
      if (samplePlayer) {
        console.log(`     Sample: ${samplePlayer.player?.display_name} - Position: ${samplePlayer.formation_position}, Field: ${samplePlayer.formation_field}`);
      }
    });
  }
  
  // Events analysis
  if (matchData.events && matchData.events.length > 0) {
    console.log('\n⚡ EVENTS ANALYSIS:');
    const eventTypes = {};
    matchData.events.forEach(event => {
      const type = event.type?.type || 'Unknown';
      eventTypes[type] = (eventTypes[type] || 0) + 1;
    });
    
    Object.keys(eventTypes).forEach(type => {
      console.log(`   ${type}: ${eventTypes[type]}`);
    });
  }
  
  // Comments analysis  
  if (matchData.comments && matchData.comments.length > 0) {
    console.log('\n💬 COMMENTS ANALYSIS:');
    const importantComments = matchData.comments.filter(c => c.is_important);
    const goalComments = matchData.comments.filter(c => c.is_goal);
    console.log(`   Total: ${matchData.comments.length}`);
    console.log(`   Important: ${importantComments.length}`);
    console.log(`   Goal-related: ${goalComments.length}`);
    
    // Show first few important comments
    if (importantComments.length > 0) {
      console.log('   Sample important comments:');
      importantComments.slice(0, 3).forEach((comment, i) => {
        console.log(`     ${i+1}. Min ${comment.minute}: ${(comment.comment || '').substring(0, 60)}...`);
      });
    }
  }
}

// Transform SportMonks data to our database schema
function transformToSchema(sportMonksData) {
  console.log('\n🔄 TRANSFORMING DATA TO DATABASE SCHEMA...');
  
  const sm = sportMonksData;
  
  // Extract teams
  const homeParticipant = sm.participants?.find(p => p.meta?.location === 'home');
  const awayParticipant = sm.participants?.find(p => p.meta?.location === 'away');
  
  // Transform scores
  const homeScore = homeParticipant && sm.scores ? 
    sm.scores.find(s => s.participant_id === homeParticipant.id)?.goals || 0 : 0;
  const awayScore = awayParticipant && sm.scores ? 
    sm.scores.find(s => s.participant_id === awayParticipant.id)?.goals || 0 : 0;
  
  // Transform lineup with formation data
  const transformedLineup = { home: [], away: [] };
  const rawLineups = [];
  
  if (sm.lineups && sm.lineups.length > 0) {
    // Debug participant IDs
    console.log(`   Home participant ID: ${homeParticipant?.id}`);
    console.log(`   Away participant ID: ${awayParticipant?.id}`);
    
    // Sample first few lineup entries for debugging
    console.log(`   Sample lineup team IDs: ${sm.lineups.slice(0, 5).map(l => l.team_id).join(', ')}`);
    
    sm.lineups.forEach(lineup => {
      // Use team_id instead of participant_id for SportMonks lineup data
      const isHome = lineup.team_id === homeParticipant?.id;
      const side = isHome ? 'home' : 'away';
      
      // Debug first few assignments
      if (transformedLineup.home.length < 3 || transformedLineup.away.length < 3) {
        console.log(`   Player ${lineup.player_name || 'Unknown'} (team_id: ${lineup.team_id}) -> ${side}`);
      }
      
      const playerData = {
        player_id: lineup.player_id,
        player_name: lineup.player_name || lineup.player?.display_name || lineup.player?.common_name || '',
        jersey_number: lineup.jersey_number || null,
        position_id: lineup.position_id || null,
        rating: null, // Will be updated separately if available
        image_path: lineup.player?.image_path || null,
        position_name: lineup.details?.type?.name || null,
        formation_field: lineup.formation_field || null,
        formation_position: lineup.formation_position || null
      };
      
      transformedLineup[side].push(playerData);
      rawLineups.push({
        ...playerData,
        team_id: lineup.team_id, // Use team_id instead of participant_id
        type_id: lineup.details?.type_id || lineup.type_id
      });
    });
    
    // Debug lineup distribution
    console.log(`   Lineup distribution: home=${transformedLineup.home.length}, away=${transformedLineup.away.length}`);
  }
  
  // Transform events
  const transformedEvents = (sm.events || []).map(event => ({
    id: event.id,
    minute: event.minute,
    extra_minute: event.extra_minute,
    type: event.type?.type || '',
    player_id: event.player_id,
    player_name: event.player?.display_name || event.player?.common_name || '',
    related_player_id: event.related_player_id,
    related_player_name: event.related_player?.display_name || event.related_player?.common_name || '',
    participant_id: event.participant_id,
    team: event.participant_id === homeParticipant?.id ? 'home' : 'away',
    result: event.result || '',
    info: event.info || '',
    addition: event.addition || ''
  }));
  
  // Transform comments
  const transformedComments = (sm.comments || []).map(comment => ({
    comment_id: comment.id,
    fixture_id: sm.id,
    comment: comment.comment,
    minute: comment.minute,
    extra_minute: comment.extra_minute,
    is_goal: comment.is_goal || false,
    is_important: comment.is_important || false,
    order: comment.order
  }));
  
  // Build update object
  const updateData = {
    match_info: {
      starting_at: new Date(sm.starting_at),
      starting_at_timestamp: sm.starting_at_timestamp,
      venue: sm.venue ? {
        id: sm.venue.id,
        name: sm.venue.name || '',
        address: sm.venue.address || '',
        capacity: sm.venue.capacity,
        image_path: sm.venue.image_path || '',
        city_name: sm.venue.city_name || ''
      } : {},
      referee: sm.referees && sm.referees.length > 0 ? {
        id: sm.referees[0].id,
        name: sm.referees[0].display_name || sm.referees[0].common_name || '',
        common_name: sm.referees[0].common_name || '',
        firstname: sm.referees[0].firstname || '',
        lastname: sm.referees[0].lastname || '',
        image_path: sm.referees[0].image_path || ''
      } : {},
      minute: sm.minute
    },
    date: new Date(sm.starting_at),
    teams: {
      home: {
        team_name: homeParticipant?.name || '',
        team_id: homeParticipant?.id || null,
        team_slug: homeParticipant?.name ? homeParticipant.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : ''
      },
      away: {
        team_name: awayParticipant?.name || '',
        team_id: awayParticipant?.id || null,
        team_slug: awayParticipant?.name ? awayParticipant.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : ''
      }
    },
    score: {
      home: homeScore,
      away: awayScore
    },
    events: transformedEvents,
    comments: transformedComments,
    lineups: rawLineups,
    lineup: transformedLineup,
    match_status: sm.state ? {
      id: sm.state.id,
      state: sm.state.state || '',
      name: sm.state.name || '',
      short_name: sm.state.short_name || '',
      developer_name: sm.state.developer_name || ''
    } : {},
    // Keep existing player_ratings if any, as API might not include them
    $unset: {} // Will be used to remove corrupted fields if needed
  };
  
  console.log('✅ Transformation complete');
  console.log(`   Teams: ${updateData.teams.home.team_name} vs ${updateData.teams.away.team_name}`);
  console.log(`   Score: ${updateData.score.home} - ${updateData.score.away}`);
  console.log(`   Lineup structure: home=${updateData.lineup.home.length} players, away=${updateData.lineup.away.length} players`);
  console.log(`   Total lineups array: ${updateData.lineups.length} players`);
  console.log(`   Events: ${updateData.events.length} events`);
  console.log(`   Comments: ${updateData.comments.length} comments`);
  
  // Debug team assignments
  if (homeParticipant && awayParticipant) {
    console.log(`   Home team ID: ${homeParticipant.id}, Away team ID: ${awayParticipant.id}`);
    console.log(`   Sample home players: ${updateData.lineup.home.slice(0, 3).map(p => p.player_name).join(', ')}`);
    console.log(`   Sample away players: ${updateData.lineup.away.slice(0, 3).map(p => p.player_name).join(', ')}`);
  }
  
  return updateData;
}

// Update database with the transformed data
async function updateDatabase(matchId, updateData) {
  try {
    console.log(`\n💾 Updating database for match ${matchId}...`);
    
    // Try to find the existing match
    const existingMatch = await Match.findOne({ match_id: matchId });
    let updatedMatch;
    
    if (existingMatch) {
      console.log(`   Found existing match: ${existingMatch.teams?.home?.team_name || 'Unknown'} vs ${existingMatch.teams?.away?.team_name || 'Unknown'}`);
      
      // Create complete update object preserving important existing fields
      const completeUpdate = {
        ...existingMatch.toObject(), // Start with existing data
        
        // Override with fresh API data
        match_id: matchId,
        date: updateData.date,
        teams: updateData.teams,
        score: updateData.score,
        match_info: updateData.match_info,
        match_status: updateData.match_status,
        events: updateData.events,
        comments: updateData.comments,
        lineups: updateData.lineups,
        lineup: updateData.lineup,
        updatedAt: new Date()
      };
      
      // Remove the _id from the update object to avoid conflicts
      delete completeUpdate._id;
      
      // Replace the entire document
      updatedMatch = await Match.replaceOne(
        { match_id: matchId },
        completeUpdate
      );
    } else {
      console.log('   Match not found, creating new match...');
      
      // Create new match document
      const newMatchData = {
        match_id: matchId,
        date: updateData.date,
        teams: updateData.teams,
        score: updateData.score,
        match_info: updateData.match_info,
        match_status: updateData.match_status,
        events: updateData.events,
        comments: updateData.comments,
        lineups: updateData.lineups,
        lineup: updateData.lineup,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const newMatch = new Match(newMatchData);
      updatedMatch = await newMatch.save();
      updatedMatch = { modifiedCount: 1 }; // Simulate modifiedCount for new documents
    }
    
    if (updatedMatch.modifiedCount > 0 || updatedMatch.upsertedCount > 0) {
      console.log('✅ Database update successful!');
      
      // Fetch the updated document to verify
      const verifyMatch = await Match.findOne({ match_id: matchId });
      
      if (verifyMatch) {
        console.log(`   Match: ${verifyMatch.teams.home.team_name} vs ${verifyMatch.teams.away.team_name}`);
        console.log(`   Score: ${verifyMatch.score.home} - ${verifyMatch.score.away}`);
        console.log(`   Status: ${verifyMatch.match_status.name || verifyMatch.match_status.state}`);
        console.log(`   Lineup: ${verifyMatch.lineup.home.length + verifyMatch.lineup.away.length} players`);
        console.log(`   Events: ${verifyMatch.events.length} events`);
        console.log(`   Comments: ${verifyMatch.comments.length} comments`);
        
        // Check formation data specifically
        const homeWithFormation = verifyMatch.lineup.home.filter(p => p.formation_field || p.formation_position);
        const awayWithFormation = verifyMatch.lineup.away.filter(p => p.formation_field || p.formation_position);
        console.log(`   Formation data: ${homeWithFormation.length + awayWithFormation.length} players with formation info`);
        
        if (homeWithFormation.length > 0) {
          console.log(`     Sample home formation: ${homeWithFormation[0].player_name} - Field: ${homeWithFormation[0].formation_field}, Position: ${homeWithFormation[0].formation_position}`);
        }
        
        console.log(`   Updated: ${new Date().toISOString()}`);
        return verifyMatch;
      }
    } else {
      console.log('❌ No documents were modified');
      return null;
    }
    
  } catch (error) {
    console.error('❌ Database update failed:', error.message);
    console.error('   Stack:', error.stack);
    return null;
  }
}

// Main execution function
async function main() {
  const matchId = 19432044;
  
  try {
    console.log('🚀 Starting match data restoration...\n');
    
    // Connect to database
    await connectDB();
    
    // Fetch match data with all includes at once
    const matchData = await fetchMatchData(matchId);
    
    if (!matchData) {
      console.log('❌ Failed to fetch match data');
      return;
    }
    
    // Analyze the data structure
    analyzeMatchData(matchData);
    
    // Transform to our schema
    const updateData = transformToSchema(matchData);
    
    // Update database
    const result = await updateDatabase(matchId, updateData);
    
    if (result) {
      console.log('\n🎉 Match restoration completed successfully!');
      console.log('   The frontend formation display should now work correctly');
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error.message);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('📦 Disconnected from MongoDB');
    }
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, fetchMatchData, transformToSchema, updateDatabase };