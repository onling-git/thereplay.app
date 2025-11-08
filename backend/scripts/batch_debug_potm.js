#!/usr/bin/env node
// Batch script to compute POTM for multiple matches and print a concise summary
const db = require('../db/connect');
const Match = require('../models/Match');
let computePotm = null;
try {
  // prefer canonical implementation from reportController
  const rc = require('../controllers/reportController');
  if (typeof rc.computePotmFromRatings === 'function') computePotm = rc.computePotmFromRatings;
} catch (e) {
  // ignore
}
if (!computePotm) {
  // fallback to local debug implementation
  try {
    const dbg = require('./debugPotm');
    computePotm = dbg.computePotmFromRatings;
  } catch (e) {
    console.error('No computePotmFromRatings available from controller or debug script');
    process.exit(2);
  }
}

async function runBatch(matchIds = [], limit = 20, uri) {
  await db.connectDB(uri);
  try {
    let matches = [];
    if (matchIds && matchIds.length) {
      matches = await Match.find({ match_id: { $in: matchIds.map(Number) } }).lean();
    } else {
      // fetch recent matches that have player_ratings present
      matches = await Match.find({ player_ratings: { $exists: true, $ne: [] } }).sort({ date: -1 }).limit(limit).lean();
    }
    if (!matches.length) {
      console.log('No matches found for given criteria');
      return;
    }
    for (const m of matches) {
      try {
        const out = await computePotm(m);
        console.log(`${m.match_id} | ${m.home_team || 'HOME'} ${m.score ? (m.score.home || 0) : ''}-${m.score ? (m.score.away || 0) : ''} ${m.away_team || 'AWAY'} | POTM home: ${out.home.player || 'null'} (${out.home.rating ?? 'n/a'}) | away: ${out.away.player || 'null'} (${out.away.rating ?? 'n/a'})`);
      } catch (e) {
        console.warn('Failed for match', m.match_id, e?.message || e);
      }
    }
  } finally {
    await db.closeDB();
  }
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const ids = argv.filter(a => /^\d+$/.test(a));
  const uri = argv.find(a => typeof a === 'string' && (a.startsWith('mongodb://') || a.startsWith('mongodb+srv://')));
  const limitArg = argv.find(a => /^--limit=/.test(a));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : 20;
  runBatch(ids, limit, uri).catch(e => { console.error(e); process.exit(1); });
}
