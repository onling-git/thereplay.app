// scripts/backfillAllTeams.js
require('dotenv').config();
const axios = require('axios');

const BASE = process.env.SELF_BASE || 'http://localhost:8000';
const ADMIN_KEY = process.env.ADMIN_API_KEY;

const HEADERS = { 'x-api-key': ADMIN_KEY };

const SLEEP = (ms) => new Promise(r => setTimeout(r, ms));

// keep window ≤ 100 days to satisfy Sportmonks
const PAST_DAYS = 90;
const FUTURE_DAYS = 30;

// throttle to respect rate limits
const PER_TEAM_DELAY_MS = 600; // bump up if you see 429s

(async function run() {
  try {
    console.log('[backfill] fetching teams…');
    const { data: teams } = await axios.get(`${BASE}/api/teams`);
    if (!Array.isArray(teams) || teams.length === 0) {
      console.log('[backfill] no teams found. Did you seed /sync/catalog/all first?');
      return;
    }

    let ok = 0, fail = 0;

    // OPTIONAL: narrow down to a country or top N while testing
    // const work = teams.filter(t => t.country_id === 462).slice(0, 50);
    const work = teams;

    for (const team of work) {
      try {
        // A) pull fixtures window into Matches
        await axios.post(
          `${BASE}/api/sync/team/${team.slug}/window`,
          { pastDays: PAST_DAYS, futureDays: FUTURE_DAYS },
          { headers: HEADERS }
        );

        // B) recompute team snapshot (last/next fields)
        await axios.post(
          `${BASE}/api/teams/${team.slug}/recompute`,
          {},
          { headers: HEADERS }
        );

        ok++;
        console.log(`[backfill] ✓ ${team.name}`);
      } catch (e) {
        fail++;
        console.error(`[backfill] ✗ ${team.name}`, e?.response?.data || e.message);
      }

      // gentle throttle
      await SLEEP(PER_TEAM_DELAY_MS);
    }

    console.log(`[backfill] done. success=${ok} fail=${fail}`);
  } catch (err) {
    console.error('[backfill] fatal', err?.response?.data || err.message);
  }
})();
