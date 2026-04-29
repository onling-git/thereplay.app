/**
 * Check a specific match in detail
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || process.env.DBURI;

async function checkMatch() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const Match = mongoose.model('Match', new mongoose.Schema({}, { strict: false, collection: 'matches' }));
    
    const match = await Match.findOne({ match_id: 19441830 }).lean();
    
    if (!match) {
      console.log('❌ Match 19441830 not found');
      return;
    }

    console.log('🏟️ Match 19441830 Details:\n');
    
    console.log('=== OLD FLAT STRUCTURE ===');
    console.log('home_team:', match.home_team);
    console.log('away_team:', match.away_team);
    console.log('home_team_id:', match.home_team_id);
    console.log('away_team_id:', match.away_team_id);
    
    console.log('\n=== NEW NESTED STRUCTURE ===');
    console.log('teams field type:', typeof match.teams);
    console.log('teams.home:', JSON.stringify(match.teams?.home, null, 2));
    console.log('teams.away:', JSON.stringify(match.teams?.away, null, 2));
    
    console.log('\n=== MATCH INFO ===');
    console.log('match_info.starting_at:', match.match_info?.starting_at);
    console.log('date:', match.date);
    console.log('state:', match.state);
    console.log('match_status:', JSON.stringify(match.match_status, null, 2));
    
    console.log('\n=== SCORES ===');
    console.log('score.home:', match.score?.home);
    console.log('score.away:', match.score?.away);
    
    console.log('\n=== ALL TOP-LEVEL KEYS ===');
    console.log(Object.keys(match).join(', '));

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkMatch();
