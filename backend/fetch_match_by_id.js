// Fetch specific match by ID using SportMonks API v3/football/fixtures/{ID}
require('dotenv').config();
const { get } = require('./utils/sportmonks');
const Match = require('./models/Match');

// Transform SportMonks data to match our schema format
function transformToMatchSchema(sportMonksData) {
  if (!sportMonksData) return null;
  
  const sm = sportMonksData;
  
  // Extract teams from participants
  const homeParticipant = sm.participants?.find(p => p.meta?.location === 'home');
  const awayParticipant = sm.participants?.find(p => p.meta?.location === 'away');
  
  // Transform lineup data with ratings integrated
  const transformedLineup = {
    home: [],
    away: []
  };
  
  const rawLineups = [];
  
  if (sm.lineups && sm.lineups.length > 0) {
    sm.lineups.forEach(lineup => {
      const side = lineup.participant_id === homeParticipant?.id ? 'home' : 'away';
      
      // Find matching rating for this player - handle different possible rating sources
      const playerRating = (sm.ratings || sm.playerratings || []).find(r => 
        r.player_id === lineup.player_id || 
        r.player?.id === lineup.player_id
      );
      
      const playerData = {
        player_id: lineup.player_id,
        player_name: lineup.player?.display_name || lineup.player?.common_name || '',
        jersey_number: lineup.jersey_number || null,
        position_id: lineup.position_id || null,
        rating: playerRating?.rating || null,
        image_path: lineup.player?.image_path || null,
        position_name: lineup.type?.name || null,
        formation_field: lineup.formation_field || null,
        formation_position: lineup.formation_position || null
      };
      
      transformedLineup[side].push(playerData);
      
      // Also add to raw lineups array (legacy format)
      rawLineups.push({
        ...playerData,
        team_id: lineup.participant_id,
        type_id: lineup.type_id
      });
    });
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
    result: event.result?.result || '',
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
  
  // Transform player ratings (keep raw format) - may be empty if not available
  const transformedRatings = (sm.ratings || sm.playerratings || []).map(rating => ({
    player_id: rating.player_id,
    player_name: rating.player?.display_name || rating.player?.common_name || '',
    rating: rating.rating,
    participant_id: rating.participant_id
  }));
  
  // Transform statistics - organize by team (home/away)
  const transformedStatistics = {
    home: [],
    away: []
  };
  
  if (sm.statistics && sm.statistics.length > 0) {
    sm.statistics.forEach(stat => {
      const statData = {
        type_id: stat.type_id,
        type: stat.type?.name || '',
        value: stat.value,
        participant_id: stat.participant_id
      };
      
      if (stat.participant_id === homeParticipant?.id) {
        transformedStatistics.home.push(statData);
      } else if (stat.participant_id === awayParticipant?.id) {
        transformedStatistics.away.push(statData);
      }
    });
  }
  
  // Build final match object according to schema
  return {
    match_id: sm.id,
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
      referee: sm.referee ? {
        id: sm.referee.id,
        name: sm.referee.display_name || sm.referee.common_name || '',
        common_name: sm.referee.common_name || '',
        firstname: sm.referee.firstname || '',
        lastname: sm.referee.lastname || '',
        image_path: sm.referee.image_path || ''
      } : {},
      season: sm.season ? {
        id: sm.season.id,
        name: sm.season.name || '',
        is_current: sm.season.is_current || false,
        starting_at: sm.season.starting_at ? new Date(sm.season.starting_at) : null,
        ending_at: sm.season.ending_at ? new Date(sm.season.ending_at) : null
      } : {},
      league: sm.league ? {
        id: sm.league.id,
        name: sm.league.name || '',
        short_code: sm.league.short_code || '',
        image_path: sm.league.image_path || '',
        country_id: sm.league.country_id
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
      home: homeParticipant?.result?.result || 0,
      away: awayParticipant?.result?.result || 0
    },
    events: transformedEvents,
    comments: transformedComments,
    lineups: rawLineups,
    lineup: transformedLineup,
    player_ratings: transformedRatings,
    statistics: transformedStatistics,
    match_status: sm.state ? {
      id: sm.state.id,
      state: sm.state.state || '',
      name: sm.state.name || '',
      short_name: sm.state.short_name || '',
      developer_name: sm.state.developer_name || ''
    } : {}
  };
}

async function fetchMatchById(matchId) {
  try {
    console.log(`🔍 Fetching match ${matchId} using /v3/football/fixtures/${matchId}...\n`);

    // Use the established SportMonks utility with comprehensive includes for full match data
    const response = await get(`fixtures/${matchId}`, {
      include: [
        'lineups.detailedposition',
        'lineups',
        'formations',
        'participants',
        'statistics.type',
        'events',
        'comments',
        'venue',
        'league',
        'round',
        'state',
        'stage'
      ].join(';')
    });

    if (!response.data || !response.data.data) {
      console.error(`❌ No match data found for ID ${matchId}`);
      return null;
    }

    const matchData = response.data.data;
    
    console.log(`✅ Successfully fetched match data:`);
    console.log(`   Match ID: ${matchData.id}`);
    console.log(`   Date: ${matchData.starting_at}`);
    console.log(`   Status: ${matchData.state?.state || 'Unknown'}`);
    
    // Display participants
    if (matchData.participants && matchData.participants.length >= 2) {
      const homeTeam = matchData.participants[0];
      const awayTeam = matchData.participants[1];
      console.log(`   Teams: ${homeTeam.name} vs ${awayTeam.name}`);
      console.log(`   Score: ${homeTeam.meta?.location === 'home' ? homeTeam.result?.result : awayTeam.result?.result} - ${homeTeam.meta?.location === 'away' ? homeTeam.result?.result : awayTeam.result?.result}`);
    }

    // Display lineup information if available
    if (matchData.lineups && matchData.lineups.length > 0) {
      console.log(`\n📋 Lineup data found:`);
      console.log(`   Total lineup entries: ${matchData.lineups.length}`);
      
      // Group lineups by team
      const lineupsByTeam = {};
      matchData.lineups.forEach(lineup => {
        const teamId = lineup.participant_id;
        if (!lineupsByTeam[teamId]) {
          lineupsByTeam[teamId] = [];
        }
        lineupsByTeam[teamId].push(lineup);
      });

      Object.keys(lineupsByTeam).forEach(teamId => {
        const teamLineup = lineupsByTeam[teamId];
        const teamName = matchData.participants?.find(p => p.id.toString() === teamId.toString())?.name || `Team ${teamId}`;
        
        console.log(`\n   ${teamName} (${teamLineup.length} players):`);
        teamLineup.slice(0, 5).forEach(player => {
          console.log(`     - ${player.player?.display_name || 'Unknown'} (Formation: ${player.formation_field || 'N/A'}, Position: ${player.formation_position || 'N/A'})`);
        });
        if (teamLineup.length > 5) {
          console.log(`     ... and ${teamLineup.length - 5} more players`);
        }
      });
    }

    // Display formation data if available
    if (matchData.formations && matchData.formations.length > 0) {
      console.log(`\n📐 Formation data found:`);
      matchData.formations.forEach(formation => {
        const teamName = matchData.participants?.find(p => p.id === formation.participant_id)?.name || `Team ${formation.participant_id}`;
        console.log(`   ${teamName}: ${formation.formation || 'Unknown formation'}`);
      });
    }

    // Display events if available
    if (matchData.events && matchData.events.length > 0) {
      console.log(`\n⚽ Events found: ${matchData.events.length} total`);
      const keyEvents = matchData.events.filter(event => 
        ['GOAL', 'YELLOWCARD', 'REDCARD', 'SUBSTITUTION'].includes(event.type?.type)
      );
      console.log(`   Key events: ${keyEvents.length}`);
      
      if (keyEvents.length > 0) {
        console.log('   Recent key events:');
        keyEvents.slice(0, 5).forEach(event => {
          console.log(`     ${event.minute || '?'}' - ${event.type?.type}: ${event.player?.display_name || 'Unknown player'}`);
        });
      }
    }

    // Display player ratings if available
    const ratingsData = matchData.ratings || matchData.playerratings || [];
    if (ratingsData.length > 0) {
      console.log(`\n⭐ Player ratings found:`);
      console.log(`   Total rated players: ${ratingsData.length}`);
      
      // Group ratings by team
      const ratingsByTeam = {};
      ratingsData.forEach(rating => {
        const teamId = rating.participant_id;
        if (!ratingsByTeam[teamId]) {
          ratingsByTeam[teamId] = [];
        }
        ratingsByTeam[teamId].push(rating);
      });

      Object.keys(ratingsByTeam).forEach(teamId => {
        const teamRatings = ratingsByTeam[teamId];
        const teamName = matchData.participants?.find(p => p.id.toString() === teamId.toString())?.name || `Team ${teamId}`;
        
        console.log(`\n   ${teamName} ratings (${teamRatings.length} players):`);
        // Show top 5 rated players
        const topRated = teamRatings
          .filter(r => r.rating != null)
          .sort((a, b) => (b.rating || 0) - (a.rating || 0))
          .slice(0, 5);
          
        topRated.forEach(rating => {
          console.log(`     - ${rating.player?.display_name || 'Unknown'}: ${rating.rating}`);
        });
        
        if (teamRatings.length > topRated.length) {
          console.log(`     ... and ${teamRatings.length - topRated.length} more players`);
        }
      });
    } else {
      console.log(`\n⭐ Player ratings: Not available or match not completed`);
    }

    // Display comments if available
    if (matchData.comments && matchData.comments.length > 0) {
      console.log(`\n💬 Comments found: ${matchData.comments.length} total`);
      const importantComments = matchData.comments.filter(comment => 
        comment.is_important || comment.is_goal
      );
      console.log(`   Important/Goal comments: ${importantComments.length}`);
      
      if (importantComments.length > 0) {
        console.log('   Recent important comments:');
        importantComments.slice(0, 3).forEach(comment => {
          console.log(`     ${comment.minute || '?'}': ${(comment.comment || '').substring(0, 80)}...`);
        });
      }
    }

    console.log(`\n💾 Raw match data structure:`);
    console.log(`   Keys: ${Object.keys(matchData).join(', ')}`);
    
    // Display match status if available
    if (matchData.state) {
      console.log(`\n📊 Match status:`);
      console.log(`   State: ${matchData.state.state || 'Unknown'}`);
      console.log(`   Name: ${matchData.state.name || 'Unknown'}`);
      console.log(`   Short Name: ${matchData.state.short_name || 'Unknown'}`);
    }
    
    return matchData;
    
  } catch (error) {
    console.error(`❌ Error fetching match ${matchId}:`, error.message);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return null;
  }
}

// Main execution
async function main() {
  // The match ID that was overwritten (Southampton vs Millwall from Jan 1, 2026)
  const targetMatchId = 19432044;
  
  console.log('🚀 Starting match fetch by ID...\n');
  
  const matchData = await fetchMatchById(targetMatchId);
  
  if (matchData) {
    console.log('\n🎯 Match fetch completed successfully!');
    
    // Check if this is actually Southampton vs Millwall
    if (matchData.participants && matchData.participants.length >= 2) {
      const teamNames = matchData.participants.map(p => p.name.toLowerCase());
      const hasSouthampton = teamNames.some(name => name.includes('southampton'));
      const hasMillwall = teamNames.some(name => name.includes('millwall'));
      
      if (hasSouthampton && hasMillwall) {
        console.log('✅ Confirmed: This is Southampton vs Millwall match!');
        
        // Transform data to match schema
        console.log('\n🔄 Transforming data to match database schema...');
        const transformedData = transformToMatchSchema(matchData);
        
        console.log('✅ Data transformation completed');
        console.log(`   Lineup players: ${transformedData.lineup.home.length + transformedData.lineup.away.length}`);
        console.log(`   Player ratings: ${transformedData.player_ratings.length}`);
        console.log(`   Events: ${transformedData.events.length}`);
        console.log(`   Comments: ${transformedData.comments.length}`);
        
        // Option to save to database
        console.log('\n💡 Ready to update database with real match data!');
        console.log('   Use updateDatabaseWithRealMatch() function to save this data');
        
        return transformedData;
      } else {
        console.log('⚠️  Warning: This does not appear to be Southampton vs Millwall');
        console.log(`   Found teams: ${matchData.participants.map(p => p.name).join(' vs ')}`);
        return null;
      }
    }
    
    console.log('\n💡 Next steps:');
    console.log('   - Verify this is the correct Southampton vs Millwall match');
    console.log('   - If correct, we can update the database with this real match data');
    console.log('   - The lineup and formation data is now available for frontend display');
    
    return matchData;
  } else {
    console.log('\n❌ Failed to fetch match data');
    return null;
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

// Function to update the database with real match data
async function updateDatabaseWithRealMatch(transformedData) {
  try {
    console.log(`\n💾 Updating database for match ${transformedData.match_id}...`);
    
    // Build update object to avoid conflicts
    const updateData = {
      match_info: transformedData.match_info,
      date: transformedData.date,
      'teams.home.team_name': transformedData.teams.home.team_name,
      'teams.home.team_id': transformedData.teams.home.team_id,
      'teams.home.team_slug': transformedData.teams.home.team_slug,
      'teams.away.team_name': transformedData.teams.away.team_name,
      'teams.away.team_id': transformedData.teams.away.team_id,
      'teams.away.team_slug': transformedData.teams.away.team_slug,
      'score.home': transformedData.score.home,
      'score.away': transformedData.score.away,
      events: transformedData.events,
      comments: transformedData.comments,
      lineups: transformedData.lineups,
      lineup: transformedData.lineup,
      player_ratings: transformedData.player_ratings,
      match_status: transformedData.match_status,
      updatedAt: new Date()
    };
    
    const updatedMatch = await Match.findOneAndUpdate(
      { match_id: transformedData.match_id },
      { $set: updateData },
      { 
        new: true, 
        upsert: false // Don't create if doesn't exist
      }
    );
    
    if (updatedMatch) {
      console.log('✅ Database updated successfully!');
      console.log(`   Match: ${updatedMatch.teams.home.team_name} vs ${updatedMatch.teams.away.team_name}`);
      console.log(`   Score: ${updatedMatch.score.home} - ${updatedMatch.score.away}`);
      console.log(`   Status: ${updatedMatch.match_status.name || updatedMatch.match_status.state}`);
      console.log(`   Players with ratings: ${updatedMatch.player_ratings.length}`);
      return updatedMatch;
    } else {
      console.log('❌ Match not found in database - cannot update');
      return null;
    }
    
  } catch (error) {
    console.error('❌ Database update failed:', error.message);
    return null;
  }
}

module.exports = { fetchMatchById, transformToMatchSchema, updateDatabaseWithRealMatch };