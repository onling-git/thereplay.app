require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');

// Copy the shortEvidence function locally
function getCompetitionContext(match) {
  const league = match.match_info?.league;
  const stage = match.match_info?.stage;
  
  if (!league) {
    return {
      competition_name: 'Unknown Competition',
      affects_league_position: true,
      is_cup_competition: false,
      is_two_legged: false,
      stage_name: 'Unknown Stage',
      context_notes: []
    };
  }

  const competitionName = league.name || 'Unknown Competition';
  const stageName = stage?.name || 'Unknown Stage';
  
  const isCup = competitionName.toLowerCase().includes('cup') || 
                competitionName.toLowerCase().includes('carabao') ||
                competitionName.toLowerCase().includes('fa cup') ||
                league.id === 27;
  
  const isLeagueCompetition = competitionName.toLowerCase().includes('premier league') || 
                             competitionName.toLowerCase().includes('championship') ||
                             competitionName.toLowerCase().includes('league one') ||
                             competitionName.toLowerCase().includes('league two');
  
  const isTwoLegged = isCup && (
    stageName.toLowerCase().includes('semi') || 
    stageName.toLowerCase().includes('final')
  );
  
  const contextNotes = [];
  if (isCup) {
    contextNotes.push('Cup competition - does NOT affect league standings or position');
    if (isTwoLegged) {
      contextNotes.push(`Two-legged ${stageName.toLowerCase()} - result affects progression to next round/final`);
    } else {
      contextNotes.push('Single elimination - result determines progression or elimination');
    }
  } else if (isLeagueCompetition) {
    contextNotes.push('League competition - result affects league position and points');
  }

  return {
    competition_name: competitionName,
    affects_league_position: !isCup,
    is_cup_competition: isCup,
    is_two_legged: isTwoLegged,
    stage_name: stageName,
    context_notes: contextNotes
  };
}

function shortEvidence(match, tweets = []) {
  const events = match.events || [];
  const stats = match.player_stats || [];
  const ratings = match.player_ratings || [];
  const comments = match.comments || [];
  const lineups = match.lineups || [];
  const normalizedLineup = match.lineup || null;
  const competitionContext = getCompetitionContext(match);

  return {
    match_summary: {
      match_id: match.match_id,
      date: match.date,
      home_team: match.home_team || (match.teams && match.teams.home && match.teams.home.team_name) || 'Home Team',
      away_team: match.away_team || (match.teams && match.teams.away && match.teams.away.team_name) || 'Away Team',
      score: match.score || {},
      competition: competitionContext
    },
    match_statistics: match.statistics || match.stats || null,
    events: events.slice(0, 5).map(e => ({
      minute: e.minute,
      type: e.type,
      player: e.player,
      team: 'team',
      result: e.result,
      info: e.info
    })),
    player_ratings: ratings.slice(0, 5).map(r => ({
      player: r.player || r.player_name,
      rating: r.rating,
      team_id: r.team_id,
      source: r.source
    }))
  };
}

async function testEvidence() {
  try {
    const uri = process.env.DBURI || process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay';
    await mongoose.connect(uri);
    
    const match = await Match.findOne({ match_id: 19631550 }).lean();
    
    console.log('=== TESTING EVIDENCE GENERATION ===');
    const evidence = shortEvidence(match, []);
    
    console.log('Evidence match_summary:');
    console.log(JSON.stringify(evidence.match_summary, null, 2));
    
    console.log('\\n=== COMPETITION CONTEXT IN EVIDENCE ===');
    console.log('Competition object:');
    console.log(JSON.stringify(evidence.match_summary.competition, null, 2));
    
    mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testEvidence();