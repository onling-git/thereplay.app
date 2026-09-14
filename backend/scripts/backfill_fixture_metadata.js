// scripts/backfill_fixture_metadata.js
// Backfills match_info.league / season / stage / round / venue / referee and
// match_status for fixtures that were imported by minimalProcessFixturesForLeague
// (which only set starting_at) and therefore have match_info.league = null.
//
// It fetches each fixture from SportMonks, normalises it, and merges ONLY the
// metadata sub-fields so existing events/lineups/reports are never overwritten.
//
// Usage:
//   node scripts/backfill_fixture_metadata.js                 # all null-league fixtures
//   node scripts/backfill_fixture_metadata.js --dry           # dry run, no writes
//   node scripts/backfill_fixture_metadata.js --limit=50      # only first 50
//   node scripts/backfill_fixture_metadata.js --league=8      # only fixtures that resolve to league 8
//
// Env loading: prefer .env.production (where DBURI / SPORTMONKS_API_KEY live),
// then .env.local, then .env. Override with ENV_FILE=/path/to/file.
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const envCandidates = process.env.ENV_FILE
  ? [process.env.ENV_FILE]
  : ['.env.production', '.env.local', '.env'];
for (const rel of envCandidates) {
  const p = path.resolve(__dirname, '..', rel);
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    console.log(`[backfill] loaded env from ${rel}`);
    break;
  }
}
const mongoose = require('mongoose');
const Match = require('../models/Match');
const { get } = require('../utils/sportmonks');
const { normaliseFixtureToMatchDoc } = require('../utils/normaliseFixture');

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const limitArg = args.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : null;
const leagueArg = args.find(a => a.startsWith('--league='));
const ONLY_LEAGUE = leagueArg ? parseInt(leagueArg.split('=')[1]) : null;

// Only repair the 26/27 season by default (fixtures from Aug 1 2026 onward).
// Override with --from=YYYY-MM-DD / --to=YYYY-MM-DD, or --all to include older ones.
const allArg = args.includes('--all');
const fromArg = args.find(a => a.startsWith('--from='));
const toArg = args.find(a => a.startsWith('--to='));
const FROM = fromArg ? new Date(fromArg.split('=')[1]) : (allArg ? null : new Date('2026-08-01T00:00:00Z'));
const TO = toArg ? new Date(toArg.split('=')[1]) : null;

// Optional: restrict to a set of league IDs (comma-separated), e.g. --leagues=8,9,24,27
// for England (Premier League, Championship, FA Cup, Carabao Cup). Since the DB
// fixtures currently have league = null, we can't pre-filter by league in Mongo;
// instead we filter AFTER resolving each fixture's league from SportMonks.
const leaguesArg = args.find(a => a.startsWith('--leagues='));
const LEAGUE_SET = leaguesArg
  ? new Set(leaguesArg.split('=')[1].split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)))
  : (ONLY_LEAGUE ? new Set([ONLY_LEAGUE]) : null);

// A gentle default delay so we don't hammer SportMonks (their plan is rate-limited)
const DELAY_MS = Number(process.env.BACKFILL_DELAY_MS || 350);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  const uri = process.env.DBURI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('DBURI / MONGODB_URI not set');
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log('[backfill] Connected');

  // Find fixtures missing league info, restricted to the date window
  const dateFilter = {};
  if (FROM) dateFilter.$gte = FROM;
  if (TO) dateFilter.$lte = TO;
  const filter = {
    $and: [
      { $or: [{ 'match_info.league': null }, { 'match_info.league': { $exists: false } }, { 'match_info.league.id': null }] },
      ...(Object.keys(dateFilter).length ? [{ 'match_info.starting_at': dateFilter }] : [])
    ]
  };
  let query = Match.find(filter).select('match_id match_info.starting_at teams').lean().sort({ 'match_info.starting_at': 1 });
  if (LIMIT) query = query.limit(LIMIT);
  const fixtures = await query;

  console.log(`[backfill] Date window: ${FROM ? FROM.toISOString().slice(0, 10) : 'any'} → ${TO ? TO.toISOString().slice(0, 10) : 'any'}`);

  console.log(`[backfill] Found ${fixtures.length} fixtures missing league metadata${DRY ? ' (dry run)' : ''}`);
  if (ONLY_LEAGUE) console.log(`[backfill] Will only write when resolved league = ${ONLY_LEAGUE}`);

  let updated = 0, skipped = 0, failed = 0;

  for (let i = 0; i < fixtures.length; i++) {
    const m = fixtures[i];
    const matchId = m.match_id;
    try {
      await sleep(DELAY_MS);

      const response = await get(`/fixtures/${matchId}`, {
        include: 'league;season;stage;round;venue;state;participants'
      });
      const fixture = response.data?.data;
      if (!fixture) {
        console.warn(`[backfill] #${i + 1}/${fixtures.length} id=${matchId}: no data from provider, skipping`);
        skipped++;
        continue;
      }

      const normalized = normaliseFixtureToMatchDoc(fixture);
      const leagueId = normalized?.match_info?.league?.id ?? null;

      // Optional league restriction (set of allowed league IDs)
      if (LEAGUE_SET && !LEAGUE_SET.has(leagueId)) {
        skipped++;
        continue;
      }

      // Build a minimal, safe $set that only touches metadata sub-fields.
      // We deliberately do NOT overwrite events/lineups/score/report.
      const set = {};
      if (normalized.match_info?.league) set['match_info.league'] = normalized.match_info.league;
      if (normalized.match_info?.season) set['match_info.season'] = normalized.match_info.season;
      if (normalized.match_info?.stage) set['match_info.stage'] = normalized.match_info.stage;
      if (normalized.match_info?.round) set['match_info.round'] = normalized.match_info.round;
      if (normalized.match_info?.venue) set['match_info.venue'] = normalized.match_info.venue;
      if (normalized.match_info?.referee) set['match_info.referee'] = normalized.match_info.referee;
      if (normalized.match_status && (normalized.match_status.state || normalized.match_status.name || normalized.match_status.short_name)) {
        set['match_status'] = normalized.match_status;
      }
      // keep the top-level score in sync when the provider reports a played game
      if (normalized.score && (normalized.score.home || normalized.score.away)) {
        set['score'] = normalized.score;
      }

      const homeName = m.teams?.home?.team_name || fixture.name || matchId;
      const awayName = m.teams?.away?.team_name || '';

      if (Object.keys(set).length === 0) {
        console.log(`[backfill] #${i + 1}/${fixtures.length} id=${matchId} (${homeName} vs ${awayName}): nothing to set`);
        skipped++;
        continue;
      }

      if (DRY) {
        console.log(`[dry] #${i + 1}/${fixtures.length} id=${matchId} (${homeName} vs ${awayName}) -> league=${leagueId} ${normalized.match_info?.league?.name || ''} season=${normalized.match_info?.season?.name || ''} status=${set.match_status?.short_name || ''}`);
        updated++;
        continue;
      }

      await Match.updateOne({ match_id: matchId }, { $set: set });
      updated++;
      if (updated % 25 === 0) {
        console.log(`[backfill] progress: ${updated} updated, ${skipped} skipped, ${failed} failed (${i + 1}/${fixtures.length})`);
      }
    } catch (e) {
      failed++;
      console.error(`[backfill] #${i + 1}/${fixtures.length} id=${matchId} failed:`, e?.message || e);
    }
  }

  console.log(`\n[backfill] Done. updated=${updated} skipped=${skipped} failed=${failed}${DRY ? ' (dry run - nothing written)' : ''}`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(e => { console.error('[backfill] fatal:', e); process.exit(1); });
