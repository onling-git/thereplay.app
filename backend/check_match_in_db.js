// check_match_in_db.js
require('dotenv').config();
const { connectDB, closeDB } = require('./db/connect');
const Match = require('./models/Match');

async function checkMatch(matchId) {
  try {
    await connectDB();
    
    const match = await Match.findOne({ match_id: matchId }).lean();
    
    if (!match) {
      console.log(`Match ${matchId} not found in database`);
      return;
    }
    
    console.log('\n=== Database Match Data ===\n');
    console.log('match_id:', match.match_id);
    console.log('match_info.starting_at:', match.match_info?.starting_at);
    console.log('match_info.starting_at_timestamp:', match.match_info?.starting_at_timestamp);
    console.log('date:', match.date);
    
    if (match.match_info?.starting_at_timestamp) {
      const ts = match.match_info.starting_at_timestamp;
      console.log('\nTimestamp analysis:');
      console.log('  As UTC Date:', new Date(ts * 1000).toISOString());
      console.log('  As UK Time (example):', new Date(ts * 1000).toLocaleString('en-GB', { timeZone: 'Europe/London' }));
      console.log('  As CEST (example):', new Date(ts * 1000).toLocaleString('en-GB', { timeZone: 'Europe/Paris' }));
    }
    
    await closeDB();
  } catch (error) {
    console.error('Error:', error);
    await closeDB();
    process.exit(1);
  }
}

const matchId = process.argv[2] || 19432260;
checkMatch(matchId);
