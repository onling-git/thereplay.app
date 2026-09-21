// One-off: backfill real final scores for matches whose status was corrected by
// resync_stuck_live_matches.js (which intentionally skipped scores). Targets any
// match updated in the last hour that is FT but whose score may be stale/frozen.
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
for (const rel of ['.env.production', '.env.local', '.env']) {
  const p = path.resolve(__dirname, rel);
  if (fs.existsSync(p)) { dotenv.config({ path: p }); console.log(`[backfill] loaded env from ${rel}`); break; }
}

const mongoose = require('mongoose');
const Match = require('./models/Match');
const { get } = require('./utils/sportmonks');

async function main() {
  const uri = process.env.DBURI || process.env.MONGODB_URI;
  if (!uri) { console.error('DBURI not set'); process.exit(1); }
  await mongoose.connect(uri);

  const since = new Date(Date.now() - 60 * 60 * 1000);
  const matches = await Match.find({
    updatedAt: { $gte: since },
    'match_status.state': 'FT'
  }).select('match_id teams score').lean();

  console.log(`[backfill] ${matches.length} recently-resynced FT matches to check`);

  let updated = 0, unchanged = 0, failed = 0;
  for (const m of matches) {
    try {
      const res = await get(`/fixtures/${m.match_id}`, { include: 'scores' });
      const fx = res?.data?.data;
      const scores = fx?.scores || [];
      const homeCurrent = scores.find(s => s.description === 'CURRENT' && s.score?.participant === 'home');
      const awayCurrent = scores.find(s => s.description === 'CURRENT' && s.score?.participant === 'away');

      if (!homeCurrent || !awayCurrent) {
        console.warn(`  ? id=${m.match_id}: no CURRENT score in response, skipping`);
        failed++;
        continue;
      }

      const home = homeCurrent.score.goals;
      const away = awayCurrent.score.goals;

      if (m.score?.home === home && m.score?.away === away) {
        unchanged++;
      } else {
        await Match.updateOne({ match_id: m.match_id }, { $set: { score: { home, away } } });
        updated++;
        console.log(`  ✓ id=${m.match_id} (${m.teams?.home?.team_name} vs ${m.teams?.away?.team_name}): ${m.score?.home}-${m.score?.away} -> ${home}-${away}`);
      }

      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      failed++;
      console.error(`  ✗ id=${m.match_id}: ${e?.message || e}`);
    }
  }

  console.log(`\n[backfill] Done. updated=${updated} unchanged=${unchanged} failed=${failed}`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(e => { console.error('[backfill] fatal:', e); process.exit(1); });
