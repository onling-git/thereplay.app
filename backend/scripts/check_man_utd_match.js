require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('../models/Match');

async function checkMatch() {
  await mongoose.connect(process.env.DBURI);
  
  const match = await Match.findOne({ match_id: 19427202 }).lean();
  
  if (!match) {
    console.log('Match not found');
    process.exit(1);
  }
  
  console.log('🏟️  Manchester United vs Brentford\n');
  console.log('Status:', match.match_status?.state, '-', match.match_status?.name);
  console.log('Score:', match.score?.home, '-', match.score?.away);
  console.log('FT Score:', match.score?.ft_score || 'N/A');
  console.log('Updated:', new Date(match.updatedAt).toISOString());
  console.log('\nTeam Names:');
  console.log('  home_team:', match.home_team);
  console.log('  away_team:', match.away_team);
  console.log('\nEvents:', match.events?.length || 0);
  console.log('Statistics:', Object.keys(match.statistics || {}).length);
  
  process.exit(0);
}

checkMatch();
