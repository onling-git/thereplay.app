const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Match = require('../models/Match');
function readDbUri() {
  const envPath = path.join(__dirname, '..', '.env');
  const content = fs.readFileSync(envPath, 'utf8');
  const m = content.match(/^DBURI\s*=\s*(.*)$/m);
  if (m) return String(m[1]).replace(/^['\"]|['\"]$/g, '').trim();
  const m2 = content.match(/^MONGO_URI\s*=\s*(.*)$/m);
  if (m2) return String(m2[1]).replace(/^['\"]|['\"]$/g, '').trim();
  throw new Error('DBURI not found in .env');
}
(async ()=>{
  const uri = readDbUri();
  await mongoose.connect(uri);
  const doc = await Match.findOne({ match_id: 19431868 }).lean();
  if (!doc) { console.log('not found'); process.exit(0); }
  const map = {};
  for (const p of (doc.lineups||[])) {
    map[String(p.player_id)] = p.player_name || p.player || null;
  }
  console.log('map sample (first 40 entries):');
  console.log(JSON.stringify(map, null, 2));
  await mongoose.disconnect();
})();
