require('dotenv').config();
const { connectDB } = require('./db/connect');
const Match = require('./models/Match');

async function debugMatchUpdateTriggers() {
  try {
    await connectDB(process.env.DBURI);
    console.log('Connected to database');
    
    console.log('\n=== CHECKING MATCH 19431929 HISTORY ===');
    
    // Get the match that should have triggered the update
    const match = await Match.findOne({ match_id: 19431929 }).lean();
    
    console.log('Match 19431929 details:', {
      match_id: match?.match_id,
      date: match?.match_info?.starting_at,
      status: match?.match_status?.state,
      status_name: match?.match_status?.name,
      short_name: match?.match_status?.short_name,
      home_team: match?.teams?.home?.team_name,
      away_team: match?.teams?.away?.team_name,
      home_team_id: match?.teams?.home?.team_id,
      away_team_id: match?.teams?.away?.team_id
    });
    
    console.log('\n=== TESTING updateTeamsForFinishedMatch FUNCTION ===');
    
    // Import the function from the Match model
    const { updateTeamsForFinishedMatch } = require('./models/Match');
    
    // Manually trigger the update function
    console.log('Manually triggering updateTeamsForFinishedMatch...');
    
    // We need to simulate the function call since it's internal
    // Let's create a test script that will trigger the update
    
    const Team = require('./models/Team');
    
    // Check current Southampton state before manual trigger
    const teamBefore = await Team.findOne({ id: 65 }).select('last_match next_match last_played_at next_game_at').lean();
    console.log('Southampton before manual trigger:', teamBefore);
    
    // Since updateTeamsForFinishedMatch is internal, let's manually run the logic
    const matchDoc = match;
    const state = matchDoc.match_status && (matchDoc.match_status.state || matchDoc.match_status.name || matchDoc.status);
    const s = String(state || '').toLowerCase();
    
    console.log('Match state analysis:', {
      raw_state: state,
      normalized_state: s,
      is_finished: s.includes('finished') || s.includes('ft') || s === 'ft',
      should_trigger: s.includes('finished') || s.includes('ft') || s === 'ft'
    });
    
    // Check if this match should have triggered an update
    if (s.includes('finished') || s.includes('ft') || s === 'ft') {
      console.log('✅ This match should have triggered an automatic update');
    } else {
      console.log('❌ This match would NOT trigger an automatic update');
      console.log('   The match status does not match the finished criteria');
    }
    
    console.log('\n=== CHECKING CRON JOB STATUS ===');
    
    // Check if there are any cron jobs running that might be fixing this
    console.log('Note: Check if these cron jobs are running properly:');
    console.log('- refreshTeamNextMatchInfo()');
    console.log('- validateAndFixTeamMatchReferences()'); 
    console.log('- Match model post-save/post-update hooks');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

debugMatchUpdateTriggers();