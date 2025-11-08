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
(async () => {
  const uri = readDbUri();
  await mongoose.connect(uri);
  const doc = await Match.findOne({ match_id: 19431868 }).lean();
  console.log('keys:', Object.keys(doc));
  console.log('player_ratings length:', (doc.player_ratings||[]).length);
  console.log('player_ratings sample:', JSON.stringify((doc.player_ratings||[]).slice(0,10), null, 2));
  console.log('lineups length:', (doc.lineups||[]).length);
  console.log('lineups sample:', JSON.stringify((doc.lineups||[]).slice(0,10), null, 2));
  await mongoose.disconnect();
})();
