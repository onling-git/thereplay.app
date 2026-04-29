require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('../models/Match');

async function checkReportStructure() {
  await mongoose.connect(process.env.DBURI);
  
  const match = await Match.findOne({
    $or: [
      { home_team: 'Southampton', away_team: 'Ipswich Town' },
      { 'teams.home.team_name': 'Southampton', 'teams.away.team_name': 'Ipswich Town' }
    ],
    'match_status.state': 'FT'
  }).sort({ date: -1 }).lean();
  
  if (!match) {
    console.log('❌ Match not found');
    process.exit(1);
  }
  
  console.log('Match ID:', match.match_id);
  console.log('\n=== REPORTS STRUCTURE ===\n');
  
  if (match.reports) {
    console.log('reports.home type:', typeof match.reports.home);
    console.log('reports.home keys:', match.reports.home ? Object.keys(match.reports.home) : 'null');
    
    if (match.reports.home) {
      console.log('\nHome Report Structure:');
      console.log('  - content:', typeof match.reports.home.content, match.reports.home.content ? 'EXISTS' : 'null');
      console.log('  - embedded_tweets:', Array.isArray(match.reports.home.embedded_tweets) ? `Array(${match.reports.home.embedded_tweets.length})` : typeof match.reports.home.embedded_tweets);
      console.log('  - player_of_match:', match.reports.home.player_of_match || 'null');
      console.log('  - other fields:', Object.keys(match.reports.home).filter(k => !['content', 'embedded_tweets', 'player_of_match'].includes(k)));
    }
  } else {
    console.log('No reports object');
  }
  
  process.exit(0);
}

checkReportStructure();
