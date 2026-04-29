require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('../models/Match');

async function checkLastUpdates() {
  await mongoose.connect(process.env.DBURI);
  
  const recent = await Match.find({})
    .sort({updatedAt: -1})
    .limit(10)
    .select('match_id home_team away_team updatedAt match_status date')
    .lean();
  
  console.log('Last 10 updated matches:\n');
  recent.forEach((m, i) => {
    const updated = new Date(m.updatedAt);
    const ago = Math.floor((Date.now() - updated.getTime()) / 1000 / 60);
    console.log(`${i+1}. ${m.home_team} vs ${m.away_team}`);
    console.log(`   Match ID: ${m.match_id}`);
    console.log(`   Status: ${m.match_status?.state || 'unknown'}`);
    console.log(`   Updated: ${ago} minutes ago (${updated.toISOString()})`);
    console.log('');
  });
  
  process.exit(0);
}

checkLastUpdates();
