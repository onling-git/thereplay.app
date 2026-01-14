require('dotenv').config();
const { connectDB } = require('./db/connect');
const Match = require('./models/Match');

async function checkMatchScore() {
  try {
    await connectDB(process.env.DBURI);
    console.log('Connected to database');
    
    console.log('\n=== CHECKING MATCH 19431929 SCORE ===');
    const match = await Match.findOne({ match_id: 19431929 }).lean();
    
    if (!match) {
      console.log('❌ Match not found');
      return;
    }
    
    console.log('Match details:');
    console.log('Home team:', match.teams?.home?.team_name || match.home_team);
    console.log('Away team:', match.teams?.away?.team_name || match.away_team);
    console.log('Status:', match.match_status?.state || match.status);
    
    console.log('\nScore fields:');
    console.log('match.score:', match.score);
    console.log('match.scores:', match.scores);
    console.log('match.teams?.home?.score:', match.teams?.home?.score);
    console.log('match.teams?.away?.score:', match.teams?.away?.score);
    
    console.log('\nAll available score-related fields:');
    const scoreFields = {};
    for (const key in match) {
      if (key.toLowerCase().includes('score') || key.toLowerCase().includes('goal')) {
        scoreFields[key] = match[key];
      }
    }
    console.log(scoreFields);
    
    console.log('\nFull match object keys:');
    console.log(Object.keys(match));
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkMatchScore();