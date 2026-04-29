require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('../models/Match');

async function checkMatch() {
  await mongoose.connect(process.env.DBURI);
  
  // Southampton vs Ipswich - Championship match
  const match = await Match.findOne({
    $or: [
      { home_team: 'Southampton', away_team: 'Ipswich Town' },
      { 'teams.home.team_name': 'Southampton', 'teams.away.team_name': 'Ipswich Town' }
    ],
    'match_status.state': 'FT'
  }).sort({ date: -1 }).lean();
  
  if (!match) {
    console.log('❌ Southampton vs Ipswich match not found');
    process.exit(1);
  }
  
  console.log('🏟️  Southampton vs Ipswich Town\n');
  console.log('Match ID:', match.match_id);
  console.log('Date:', match.date);
  console.log('Status:', match.match_status?.state);
  console.log('Score:', match.score?.home, '-', match.score?.away);
  console.log('\n📊 Data Check:\n');
  
  // Check reports
  console.log('Reports object:', match.reports ? 'EXISTS' : 'MISSING');
  if (match.reports) {
    console.log('  - home report:', typeof match.reports.home, match.reports.home ? 'HAS DATA' : 'null');
    console.log('  - away report:', typeof match.reports.away, match.reports.away ? 'HAS DATA' : 'null');
    console.log('  - generated_at:', match.reports.generated_at);
    console.log('  - model:', match.reports.model);
  }
  
  // Check POTM
  console.log('\nPOTM object:', match.potm ? 'EXISTS' : 'MISSING');
  if (match.potm) {
    console.log('  - home player:', match.potm.home?.player || 'null');
    console.log('  - home rating:', match.potm.home?.rating || 'null');
    console.log('  - away player:', match.potm.away?.player || 'null');
    console.log('  - away rating:', match.potm.away?.rating || 'null');
  }
  
  // Check comments/tweets
  console.log('\nComments:', match.comments?.length || 0);
  if (match.comments && match.comments.length > 0) {
    console.log('  Sample:', match.comments[0]);
  }
  
  // Check events
  console.log('\nEvents:', match.events?.length || 0);
  
  // Check player ratings
  console.log('\nPlayer Ratings:', match.player_ratings?.length || 0);
  if (match.player_ratings && match.player_ratings.length > 0) {
    const topRated = match.player_ratings.sort((a, b) => (b.rating || 0) - (a.rating || 0))[0];
    console.log('  Top rated:', topRated.player_name, '-', topRated.rating);
  }
  
  process.exit(0);
}

checkMatch();
