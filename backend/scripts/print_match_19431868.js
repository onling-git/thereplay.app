// scripts/print_match_19431868.js
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Match = require('../models/Match');

function readDbUri() {
  const envPath = path.join(__dirname, '..', '.env');
  const content = fs.readFileSync(envPath, 'utf8');
  const m = content.match(/^DBURI\s*=\s*['"]?(.*)['"]?\s*$/m);
  if (m) return m[1];
  const m2 = content.match(/^MONGO_URI\s*=\s*['"]?(.*)['"]?\s*$/m);
  if (m2) return m2[1];
  throw new Error('DBURI not found in .env');
}

async function main() {
  const uri = readDbUri();
  console.log('Connecting to', uri);
  await mongoose.connect(uri);
  const doc = await Match.findOne({ match_id: 19431868 }).lean();
  if (!doc) {
    console.log('Match not found');
    await mongoose.disconnect();
    return;
  }
  const out = {
    match_id: doc.match_id,
    date: doc.date,
    home_team: doc.home_team,
    home_team_slug: doc.home_team_slug,
    away_team: doc.away_team,
    away_team_slug: doc.away_team_slug,
    lineup_home_count: (doc.lineup && doc.lineup.home) ? doc.lineup.home.length : 0,
    lineup_away_count: (doc.lineup && doc.lineup.away) ? doc.lineup.away.length : 0,
    lineup_home_sample: (doc.lineup && doc.lineup.home) ? (doc.lineup.home.slice(0,10)) : [],
    lineup_away_sample: (doc.lineup && doc.lineup.away) ? (doc.lineup.away.slice(0,10)) : [],
    player_ratings_count: (doc.player_ratings || []).length,
    player_ratings_sample: (doc.player_ratings || []).slice(0,20)
  };
  console.log(JSON.stringify(out, null, 2));
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
