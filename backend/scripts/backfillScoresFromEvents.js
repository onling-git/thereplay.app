// scripts/backfillScoresFromEvents.js
require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('../models/Match');

function parseScoreString(s) {
  if (!s) return null;
  const m = String(s).match(/(\d+)\s*[-:]\s*(\d+)/);
  if (!m) return null;
  return { home: Number(m[1]), away: Number(m[2]) };
}

async function run() {
  const uri = process.env.DBURI;
  if (!uri) {
    console.error('DBURI missing');
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log('[backfill] Connected');

  // find candidates: 0-0 but events have any "result"
  const cursor = Match.find({ 'score.home': 0, 'score.away': 0, 'events.0': { $exists: true } })
    .cursor();

  let updated = 0, scanned = 0;
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    scanned++;
    const events = Array.isArray(doc.events) ? doc.events : [];
    const withResult = [...events].reverse().find(e => typeof e.result === 'string' && /(\d+)\s*[-:]\s*(\d+)/.test(e.result));
    if (!withResult) continue;

    const ps = parseScoreString(withResult.result);
    if (!ps) continue;

    doc.score = { home: ps.home, away: ps.away };
    await doc.save();
    updated++;
    if (updated % 50 === 0) console.log(`[backfill] updated ${updated} (scanned ${scanned})`);
  }

  console.log(`[backfill] DONE. scanned=${scanned}, updated=${updated}`);
  await mongoose.disconnect();
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
