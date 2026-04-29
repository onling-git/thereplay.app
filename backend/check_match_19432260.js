require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');

async function checkMatch() {
  await mongoose.connect(process.env.DBURI);
  const match = await Match.findOne({ match_id: 19432260 }).lean();
  
  console.log('Match:', match.teams.home.team_name, 'vs', match.teams.away.team_name);
  console.log('League:', JSON.stringify(match.match_info.league, null, 2));
  console.log('Starting at:', match.match_info.starting_at);
  console.log('Timestamp:', match.match_info.starting_at_timestamp);
  
  await mongoose.disconnect();
}

checkMatch();
