// Debug and fix the database update for match 19432044
require('dotenv').config();
const axios = require('axios');
const Match = require('./models/Match');
const mongoose = require('mongoose');

async function connectDB() {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('📦 Connected to MongoDB');
    }
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
}

async function debugCurrentState(matchId) {
  console.log(`🔍 CURRENT STATE OF MATCH ${matchId}:`);
  const match = await Match.findOne({ match_id: matchId });
  
  if (!match) {
    console.log('❌ Match not found!');
    return null;
  }
  
  console.log(`Teams: ${match.teams?.home?.team_name} vs ${match.teams?.away?.team_name}`);
  console.log(`Score: ${match.score?.home || 'N/A'} - ${match.score?.away || 'N/A'}`);
  console.log(`Status: ${match.match_status?.name || match.match_status?.state || 'N/A'}`);
  console.log(`Events: ${match.events?.length || 0}`);
  console.log(`Comments: ${match.comments?.length || 0}`);
  console.log(`Home lineup: ${match.lineup?.home?.length || 0} players`);
  console.log(`Away lineup: ${match.lineup?.away?.length || 0} players`);
  
  // Check formation data
  if (match.lineup?.home) {
    const homeWithFormation = match.lineup.home.filter(p => p.formation_field || p.formation_position);
    console.log(`Home players with formation data: ${homeWithFormation.length}`);
    if (homeWithFormation.length > 0) {
      console.log(`Sample: ${homeWithFormation[0].player_name} - Field: ${homeWithFormation[0].formation_field}, Position: ${homeWithFormation[0].formation_position}`);
    }
  }
  
  return match;
}

async function fetchAndTransformData(matchId) {
  console.log('\n🔄 FETCHING FRESH DATA FROM SPORTMONKS...');
  
  const url = `https://api.sportmonks.com/v3/football/fixtures/${matchId}?api_token=o02EpD6kCh7HWuCN2GDzCMGPOyiXXtt6eLXyOfVmLFTvEQr0gHyTj8ZEX2cJ&include=state;lineups.details;comments;scores;coaches;venue;events;periods;participants;referees;formations`;
  
  const response = await axios.get(url);
  const sm = response.data.data;
  
  console.log(`✅ Fetched data for: ${sm.participants?.[0]?.name} vs ${sm.participants?.[1]?.name}`);
  console.log(`Score: ${sm.scores?.find(s => s.participant_id === sm.participants?.[0]?.id)?.score?.goals || 0} - ${sm.scores?.find(s => s.participant_id === sm.participants?.[1]?.id)?.score?.goals || 0}`);
  console.log(`Status: ${sm.state?.state}`);
  console.log(`Events: ${sm.events?.length || 0}`);
  console.log(`Comments: ${sm.comments?.length || 0}`);
  console.log(`Lineups: ${sm.lineups?.length || 0} teams`);
  
  // Transform the data
  const homeParticipant = sm.participants?.find(p => p.meta?.location === 'home');
  const awayParticipant = sm.participants?.find(p => p.meta?.location === 'away');
  
  const homeScore = sm.scores?.find(s => s.participant_id === homeParticipant?.id)?.score?.goals || 0;
  const awayScore = sm.scores?.find(s => s.participant_id === awayParticipant?.id)?.score?.goals || 0;
  
  // Transform lineups with formation data
  const homeLineup = [];
  const awayLineup = [];
  
  if (sm.lineups) {
    sm.lineups.forEach(lineup => {
      const isHome = lineup.participant_id === homeParticipant?.id;
      const targetArray = isHome ? homeLineup : awayLineup;
      
      lineup.details?.forEach(detail => {
        if (detail.player) {
          targetArray.push({
            player_id: detail.player.id,
            player_name: detail.player.display_name || detail.player.common_name,
            jersey_number: detail.jersey_number,
            position_id: detail.position?.id || detail.position_id,
            formation_position: detail.formation_position,
            formation_field: detail.formation_field,
            type: detail.type, // STARTING_XI, SUBSTITUTE
            image_path: detail.player.image_path || ''
          });
        }
      });
    });
  }
  
  console.log(`✅ Transformed lineups: ${homeLineup.length} home, ${awayLineup.length} away`);
  console.log(`Home formation players: ${homeLineup.filter(p => p.formation_field).length}`);
  console.log(`Away formation players: ${awayLineup.filter(p => p.formation_field).length}`);
  
  return {
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
    match_status: {
      state: sm.state?.state || '',
      name: sm.state?.name || sm.state?.state || ''
    },
    lineup: {
      home: homeLineup,
      away: awayLineup
    },
    events: (sm.events || []).map(event => ({
      id: event.id,
      minute: event.minute,
      type: event.type?.type || '',
      participant_id: event.participant_id,
      player_id: event.player_id,
      player_name: event.player?.display_name || event.player?.common_name || '',
      related_player_id: event.related_player_id,
      related_player_name: event.related_player?.display_name || event.related_player?.common_name || '',
      team: event.participant_id === homeParticipant?.id ? 'home' : 'away',
      result: event.result || '',
      info: event.info || '',
      addition: event.addition || ''
    })),
    comments: (sm.comments || []).map(comment => ({
      comment_id: comment.id,
      fixture_id: sm.id,
      comment: comment.comment,
      minute: comment.minute,
      extra_minute: comment.extra_minute,
      is_goal: comment.is_goal || false,
      is_important: comment.is_important || false,
      order: comment.order
    }))
  };
}

async function forceUpdate(matchId, newData) {
  console.log('\n💾 FORCE UPDATING DATABASE...');
  
  try {
    // Use findOneAndUpdate with upsert to ensure it works
    const result = await Match.findOneAndUpdate(
      { match_id: matchId },
      {
        $set: {
          'teams.home': newData.teams.home,
          'teams.away': newData.teams.away,
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
      { 
        new: true, // Return updated document
        upsert: false // Don't create if not exists
      }
    );
    
    if (result) {
      console.log('✅ DATABASE UPDATE SUCCESSFUL!');
      console.log(`Teams: ${result.teams.home.team_name} vs ${result.teams.away.team_name}`);
      console.log(`Score: ${result.score.home} - ${result.score.away}`);
      console.log(`Home lineup: ${result.lineup.home.length} players`);
      console.log(`Away lineup: ${result.lineup.away.length} players`);
      
      const homeWithFormation = result.lineup.home.filter(p => p.formation_field || p.formation_position);
      const awayWithFormation = result.lineup.away.filter(p => p.formation_field || p.formation_position);
      console.log(`Formation data: ${homeWithFormation.length + awayWithFormation.length} players`);
      
      if (homeWithFormation.length > 0) {
        console.log(`Sample formation: ${homeWithFormation[0].player_name} - Field: ${homeWithFormation[0].formation_field}, Position: ${homeWithFormation[0].formation_position}`);
      }
      
      return true;
    } else {
      console.log('❌ No document was updated');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Update failed:', error.message);
    return false;
  }
}

async function main() {
  const matchId = 19432044;
  
  try {
    await connectDB();
    
    // Debug current state
    await debugCurrentState(matchId);
    
    // Fetch and transform fresh data
    const newData = await fetchAndTransformData(matchId);
    
    // Force update
    const success = await forceUpdate(matchId, newData);
    
    if (success) {
      console.log('\n🎉 MATCH DATA SUCCESSFULLY UPDATED!');
      
      // Verify the update
      console.log('\n🔍 VERIFICATION:');
      await debugCurrentState(matchId);
    } else {
      console.log('\n❌ UPDATE FAILED');
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(console.error);