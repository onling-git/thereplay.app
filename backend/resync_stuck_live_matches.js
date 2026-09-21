// resync_stuck_live_matches.js
// Re-fetch matches stuck in a "live" state with a past kickoff, and persist
// their true final status (FT etc.) from SportMonks. One-off cleanup.
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
for (const rel of ['.env.production', '.env.local', '.env']) {
  const p = path.resolve(__dirname, rel);
  if (fs.existsSync(p)) { dotenv.config({ path: p }); console.log(`[resync] loaded env from ${rel}`); break; }
}

const mongoose = require('mongoose');
const Match = require('./models/Match');
const { get } = require('./utils/sportmonks');

const LIVE = ['live', '1H', '2H', 'HT', 'INPLAY_1ST_HALF', 'INPLAY_2ND_HALF', 'INPLAY_HALF_TIME', 'LIVE', 'ET', 'BT', 'P', 'SUSP'];

async function main() {
  const uri = process.env.DBURI || process.env.MONGODB_URI;
  if (!uri) { console.error('DBURI not set'); process.exit(1); }
  await mongoose.connect(uri);

  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const stuck = await Match.find({
    'match_status.state': { $in: LIVE },
    'match_info.starting_at': { $lt: threeHoursAgo }
  }).select('match_id teams match_info.starting_at').lean();

  console.log(`[resync] ${stuck.length} stuck live matches to re-fetch`);

  let updated = 0, failed = 0;
  for (const m of stuck) {
    try {
      const res = await get(`/fixtures/${m.match_id}`, { include: 'state;scores' });
      const fx = res?.data?.data;
      if (!fx) { console.warn(`  id=${m.match_id}: no data`); failed++; continue; }

      const state = fx.state || {};
      const newStatus = {
        id: state.id ?? null,
        state: state.state ?? state.developer_name ?? '',
        name: state.name ?? '',
        short_name: state.short_name ?? '',
        developer_name: state.developer_name ?? ''
      };

      // Try to extract final score if present
      let scoreSet = {};
      const scores = fx.scores?.data || fx.scores || [];
      const descScore = scores.find(s => (s.description || '').toUpperCase().includes('CURRENT') || (s.description || '').toUpperCase().includes('FULL'));
      if (descScore && descScore.score?.goals !== undefined) {
        // provider shape varies; skip score if ambiguous
      }

      await Match.updateOne({ match_id: m.match_id }, { $set: { match_status: newStatus, ...scoreSet } });
      updated++;
      console.log(`  ✓ id=${m.match_id} (${m.teams?.home?.team_name} vs ${m.teams?.away?.team_name}) -> ${newStatus.state || newStatus.short_name}`);

      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      failed++;
      console.error(`  ✗ id=${m.match_id}: ${e?.message || e}`);
    }
  }

  console.log(`\n[resync] Done. updated=${updated} failed=${failed}`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(e => { console.error('[resync] fatal:', e); process.exit(1); });
