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

async function main() {
  const uri = readDbUri();
  await mongoose.connect(uri);
  const doc = await Match.findOne({ match_id: 19431868 }).lean();
  if (!doc) { console.log('Match not found'); await mongoose.disconnect(); return; }
  console.log('lineups length:', Array.isArray(doc.lineups) ? doc.lineups.length : 0);
  const sample = (Array.isArray(doc.lineups) ? doc.lineups.slice(0,10) : []);
  console.log(JSON.stringify(sample, null, 2));
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
