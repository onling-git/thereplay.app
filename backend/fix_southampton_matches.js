require('dotenv').config();
const { connectDB } = require('./db/connect');
const Team = require('./models/Team');
const Match = require('./models/Match');

async function fixSouthamptonMatches() {
  try {
    await connectDB(process.env.DBURI);
    console.log('Connected to database');
    
    console.log('\n=== MANUALLY FIXING SOUTHAMPTON MATCHES ===');
    
    const teamId = 65;  // Southampton's team ID
    
    // Find the finished match that should be the last match
    const finishedMatch = await Match.findOne({ match_id: 19431929 }).lean();
    console.log('Finished match 19431929:', {
      match_id: finishedMatch?.match_id,
      date: finishedMatch?.match_info?.starting_at,
      status: finishedMatch?.match_status?.state,
      home: finishedMatch?.teams?.home?.team_name,
      away: finishedMatch?.teams?.away?.team_name
    });
    
    // Find the upcoming match that should be the next match
    const upcomingMatch = await Match.findOne({ match_id: 19431943 }).lean();
    console.log('Upcoming match 19431943:', {
      match_id: upcomingMatch?.match_id,
      date: upcomingMatch?.match_info?.starting_at,
      status: upcomingMatch?.match_status?.state,
      home: upcomingMatch?.teams?.home?.team_name,
      away: upcomingMatch?.teams?.away?.team_name
    });
    
    if (finishedMatch && upcomingMatch) {
      console.log('\n=== UPDATING SOUTHAMPTON TEAM RECORD ===');
      
      // Update Southampton's team record
      const updateResult = await Team.findOneAndUpdate(
        { id: teamId },
        {
          $set: {
            last_match: 19431929,
            next_match: 19431943,
            last_played_at: finishedMatch.match_info?.starting_at || finishedMatch.date,
            next_game_at: upcomingMatch.match_info?.starting_at || upcomingMatch.date
          }
        },
        { new: true }
      ).lean();
      
      console.log('Updated Southampton team record:', {
        last_match: updateResult?.last_match,
        next_match: updateResult?.next_match,
        last_played_at: updateResult?.last_played_at,
        next_game_at: updateResult?.next_game_at
      });
      
      console.log('\n✅ Southampton team matches have been fixed!');
    } else {
      console.log('❌ Could not find one or both matches');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixSouthamptonMatches();