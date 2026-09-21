// recompute_all_team_snapshots.js
// Local batch recompute of every team's cached last/next match snapshot.
// Mirrors the logic of the admin endpoint POST /api/teams/recompute-all,
// but runs directly against the DB (no server or API key needed).
//
// Usage:
//   node recompute_all_team_snapshots.js             # all teams
//   node recompute_all_team_snapshots.js --country=462   # one country (e.g. England)
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

for (const rel of ['.env.production', '.env.local', '.env']) {
  const p = path.resolve(__dirname, rel);
  if (fs.existsSync(p)) { dotenv.config({ path: p }); console.log(`[recompute] loaded env from ${rel}`); break; }
}

const mongoose = require('mongoose');
const Team = require('./models/Team');
const { recomputeTeamSnapshotInternal } = require('./controllers/teamController');

const args = process.argv.slice(2);
const countryArg = args.find(a => a.startsWith('--country='));
const COUNTRY = countryArg ? Number(countryArg.split('=')[1]) : null;

const PER_BATCH = 10;
const DELAY_MS = 200;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  const uri = process.env.DBURI || process.env.MONGODB_URI;
  if (!uri) { console.error('DBURI not set'); process.exit(1); }
  await mongoose.connect(uri);
  console.log('[recompute] Connected');

  const filter = COUNTRY ? { country_id: COUNTRY } : {};
  const teams = await Team.find(filter, { slug: 1, name: 1 }).lean();
  console.log(`[recompute] ${teams.length} teams to process${COUNTRY ? ` (country ${COUNTRY})` : ''}`);

  let ok = 0, failed = 0;
  for (let i = 0; i < teams.length; i += PER_BATCH) {
    const batch = teams.slice(i, i + PER_BATCH);
    await Promise.all(batch.map(async (t) => {
      try {
        const r = await recomputeTeamSnapshotInternal(t.slug);
        ok++;
        const next = r.snapshot?.next_match_info;
        console.log(`  ✓ ${t.slug}: next=${next ? `${next.opponent_name} @ ${next.date ? new Date(next.date).toISOString().slice(0,10) : '?'}` : 'none'}`);
      } catch (e) {
        failed++;
        console.error(`  ✗ ${t.slug}: ${e?.message || e}`);
      }
    }));
    await sleep(DELAY_MS);
  }

  console.log(`\n[recompute] Done. ok=${ok} failed=${failed}`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(e => { console.error('[recompute] fatal:', e); process.exit(1); });
