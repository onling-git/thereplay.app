require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');

// Copy the function locally for testing
function getCompetitionContext(match) {
  const league = match.match_info?.league;
  const stage = match.match_info?.stage;
  
  if (!league) {
    return {
      competition_name: 'Unknown Competition',
      affects_league_position: true, // Default to true for safety
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
                league.id === 27; // Carabao Cup ID
  
  const isLeagueCompetition = competitionName.toLowerCase().includes('premier league') || 
                             competitionName.toLowerCase().includes('championship') ||
                             competitionName.toLowerCase().includes('league one') ||
                             competitionName.toLowerCase().includes('league two');
  
  // Two-legged determination (typically semi-finals in cup competitions)
  const isTwoLegged = isCup && (
    stageName.toLowerCase().includes('semi') || 
    stageName.toLowerCase().includes('final') // Finals can be two-legged in some competitions
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

async function testCompetitionContext() {
  try {
    const uri = process.env.DBURI || process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay';
    await mongoose.connect(uri);
    
    const match = await Match.findOne({ match_id: 19631550 }).lean();
    
    console.log('=== TESTING COMPETITION CONTEXT ===');
    console.log('Match league:', match.match_info?.league?.name);
    console.log('Match stage:', match.match_info?.stage?.name);
    
    const context = getCompetitionContext(match);
    console.log('\nGenerated context:');
    console.log(JSON.stringify(context, null, 2));
    
    console.log('\n=== CONTEXT ANALYSIS ===');
    console.log('✅ Competition name:', context.competition_name);
    console.log('✅ Stage name:', context.stage_name); 
    console.log('✅ Is cup competition:', context.is_cup_competition);
    console.log('✅ Affects league position:', context.affects_league_position);
    console.log('✅ Is two-legged:', context.is_two_legged);
    console.log('✅ Context notes:', context.context_notes);
    
    if (context.is_cup_competition && !context.affects_league_position) {
      console.log('\n🎯 CORRECT: Cup competition correctly identified as NOT affecting league position');
    } else {
      console.log('\n⚠️ PROBLEM: Competition context may be incorrect');
    }
    
    mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testCompetitionContext();