// scripts/seedSeason.js
require('dotenv').config();
const axios = require('axios');

const BASE = process.env.SELF_BASE || 'http://localhost:8000';
const ADMIN_KEY = process.env.ADMIN_API_KEY;

// define the season window (UTC)
const SEASON_START = process.env.SEASON_START || '2025-07-01';
const SEASON_END   = process.env.SEASON_END   || '2026-06-30';

// limits / pacing
const MAX_DAYS_PER_CALL = 100;
const PER_TEAM_DELAY_MS = Number(process.env.SEED_TEAM_DELAY_MS || 1200);
const AFTER_CHUNK_DELAY_MS = Number(process.env.SEED_CHUNK_DELAY_MS || 300);

function ymd(d) {
  const pad = n => String(n).padStart(2,'0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;
}
function addDays(date, n) {
  const d = new Date(date); d.setUTCDate(d.getUTCDate() + n); return d;
}

async function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function seedTeam(slug, fromStr, toStr) {
  // Chunk the date range
  let from = new Date(fromStr + 'T00:00:00Z');
  const to  = new Date(toStr   + 'T00:00:00Z');

  let upserts = 0;
  while (from <= to) {
    const end = addDays(from, Math.min(MAX_DAYS_PER_CALL - 1, Math.floor((to - from)/(24*3600*1000))));
    const body = { from: ymd(from), to: ymd(end) };

    try {
      const { data } = await axios.post(
        `${BASE}/api/sync/team/${slug}/window`,
        body,
        { headers: { 'x-api-key': ADMIN_KEY } }
      );
      upserts += (data.upsertedCount || 0);
      // brief pause between chunks
      await sleep(AFTER_CHUNK_DELAY_MS);
    } catch (e) {
      const body = e?.response?.data || e.message;
      console.error(`[seed] team ${slug} chunk ${body.from}..${body.to} failed`, body);
      // basic cool-off on rate limit
      if (e?.response?.status === 429 || /rate limit/i.test(JSON.stringify(body))) {
        await sleep(60_000);
      }
    }

    from = addDays(end, 1);
  }

  // Recompute snapshots at the end
  try {
    await axios.post(
      `${BASE}/api/teams/${slug}/recompute`,
      {},
      { headers: { 'x-api-key': ADMIN_KEY } }
    );
  } catch (e) {
    console.error(`[seed] recompute failed for ${slug}`, e?.response?.data || e.message);
  }

  return upserts;
}

async function run() {
  console.log('[seed] start');
  const { data: teams } = await axios.get(`${BASE}/api/teams`);
  if (!Array.isArray(teams) || teams.length === 0) {
    console.log('[seed] no teams in DB. Run catalog sync first.');
    return;
  }

  let totalUpserts = 0;
  for (const team of teams) {
    console.log(`[seed] team ${team.name} (${team.slug})`);
    const u = await seedTeam(team.slug, SEASON_START, SEASON_END);
    console.log(`[seed] ${team.name}: upserts ${u}`);
    totalUpserts += u;
    await sleep(PER_TEAM_DELAY_MS);
  }

  console.log('[seed] DONE. total upserts:', totalUpserts);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
