/*
  run_cron_now.js
  Utility script to mimic the cron league-window run synchronously for testing.
  - Discovers leagues via GET /api/leagues
  - Calls POST /api/sync/league/:id/window for up to CRON_BATCH_SIZE leagues
  - Prints concise results
*/

const axios = require('axios');

const BASE = process.env.SELF_BASE || 'http://localhost:8000';
const ADMIN_KEY = process.env.ADMIN_API_KEY;

// Simple CLI arg parser for --leagueId, --from, --to
const argv = require('minimist')(process.argv.slice(2));
const CLI_LEAGUE_ID = argv.leagueId || argv.l;
const CLI_FROM = argv.from;
const CLI_TO = argv.to;

if (!ADMIN_KEY) {
  console.error('ADMIN_API_KEY environment variable is required to run this test script.');
  process.exit(1);
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  try {
    console.log('[run_cron_now] Discovering leagues via /api/leagues');
    let leagueIds = [];
    try {
      const r = await axios.get(`${BASE}/api/leagues`, { headers: { 'x-api-key': ADMIN_KEY }, timeout: 30000 });
      const leagues = Array.isArray(r.data) ? r.data : [];
      leagueIds = leagues.map(l => l.id).filter(Boolean);
    } catch (e) {
      console.warn('[run_cron_now] /api/leagues not available or failed:', e?.response?.data || e.message || e);
      // Try seeding catalog with leagues (server-side) then fall back to SportMonks directly
      try {
        console.log('[run_cron_now] Attempting catalog fallback: POST /api/sync/catalog/all {mode: "leagues"}');
        await axios.post(`${BASE}/api/sync/catalog/all`, { mode: 'leagues', perPage: 50, delayMs: 150 }, { headers: { 'x-api-key': ADMIN_KEY }, timeout: 120000 });
      } catch (e2) {
        console.warn('[run_cron_now] Catalog fallback failed or returned error:', e2?.response?.data || e2?.message || e2);
      }

      // If still no internal endpoint, try SportMonks API directly using SPORTMONKS_BASE and SPORTMONKS_API_KEY
      const SM_BASE = process.env.SPORTMONKS_BASE || 'https://api.sportmonks.com/v3/football';
      const SM_KEY = process.env.SPORTMONKS_API_KEY;
      if (!SM_KEY) {
        console.error('[run_cron_now] SPORTMONKS_API_KEY missing; cannot discover leagues directly. Exiting.');
        return;
      }

      console.log('[run_cron_now] Paging SportMonks /leagues directly to discover league ids');
      const sm = axios.create({ baseURL: SM_BASE.replace(/\/+$/,''), timeout: 30000, params: { api_token: SM_KEY } });
      let page = 1;
      const maxPages = 200;
      const discovered = new Set();
      while (page <= maxPages) {
        try {
          const resp = await sm.get(`/leagues`, { params: { page } });
          const rows = Array.isArray(resp?.data?.data) ? resp.data.data : [];
          if (!rows.length) break;
          for (const r of rows) if (r && (r.id || r.league_id)) discovered.add(r.id || r.league_id);
          page += 1;
          // polite delay
          await sleep(150);
        } catch (err) {
          console.warn('[run_cron_now] SportMonks /leagues paging failed on page', page, err?.response?.data || err.message || err);
          break;
        }
      }
      leagueIds = Array.from(discovered);
    }

    if (!leagueIds.length) {
      console.log('[run_cron_now] No leagues discovered; will try SportMonks API as a fallback.');
      // Try SportMonks directly
      try {
        const SM_BASE = process.env.SPORTMONKS_BASE || 'https://api.sportmonks.com/v3/football';
        const SM_KEY = process.env.SPORTMONKS_API_KEY;
        if (SM_KEY) {
          console.log('[run_cron_now] Fetching leagues directly from SportMonks');
          const sm = axios.create({ baseURL: SM_BASE.replace(/\/+$/,''), timeout: 30000, params: { api_token: SM_KEY } });
          const resp = await sm.get('/leagues');
          const rows = Array.isArray(resp?.data?.data) ? resp.data.data : [];
          leagueIds = rows.map(r => r.id).filter(Boolean);
        }
      } catch (e) {
        console.warn('[run_cron_now] SportMonks fallback failed:', e?.response?.data || e?.message || e);
      }
    }

    // If we still have few leagues but expected more, attempt SportMonks fallback as well
    const expectedLeagues = Number(process.env.EXPECTED_LEAGUES || 27);
    if (leagueIds.length < expectedLeagues) {
      console.log(`[run_cron_now] Only discovered ${leagueIds.length} leagues (< expected ${expectedLeagues}); attempting SportMonks fallback to discover more.`);
      try {
        const SM_BASE = process.env.SPORTMONKS_BASE || 'https://api.sportmonks.com/v3/football';
        const SM_KEY = process.env.SPORTMONKS_API_KEY;
        if (SM_KEY) {
          const sm = axios.create({ baseURL: SM_BASE.replace(/\/+$/,''), timeout: 30000, params: { api_token: SM_KEY } });
          let page = 1;
          const discovered = new Set(leagueIds.map(String));
          while (true) {
            const resp = await sm.get('/leagues', { params: { page } });
            const rows = Array.isArray(resp?.data?.data) ? resp.data.data : [];
            if (!rows.length) break;
            for (const r of rows) if (r && (r.id || r.league_id)) discovered.add(String(r.id || r.league_id));
            page += 1;
            await new Promise(r => setTimeout(r, 150));
            if (discovered.size >= expectedLeagues) break;
          }
          leagueIds = Array.from(discovered).map(x => Number(x));
        }
      } catch (e) {
        console.warn('[run_cron_now] SportMonks paging fallback failed:', e?.response?.data || e?.message || e);
      }
    }

    // If CLI asked for a single league, restrict to that
    if (CLI_LEAGUE_ID) {
      console.log('[run_cron_now] CLI league override:', CLI_LEAGUE_ID);
      if (!leagueIds.includes(Number(CLI_LEAGUE_ID))) leagueIds.unshift(Number(CLI_LEAGUE_ID));
      // only process the provided id
      leagueIds.length = 1;
    }
    const perLeagueDelayMs = Number(process.env.CRON_LEAGUE_DELAY_MS || 1500);

  console.log(`[run_cron_now] Found ${leagueIds.length} leagues. Running all discovered leagues now.`);

    // per-league POST timeout (increase to 10 minutes to allow long-running syncs)
    const perLeaguePostTimeout = Number(process.env.CRON_LEAGUE_POST_TIMEOUT_MS || 10 * 60 * 1000);
    const maxAttempts = Number(process.env.CRON_LEAGUE_MAX_ATTEMPTS || 2);

    for (const lid of leagueIds) {
      let attempt = 0;
      let success = false;
      while (attempt < maxAttempts && !success) {
        attempt += 1;
        try {
          console.log(`[run_cron_now] Calling /api/sync/league/${lid}/window (attempt ${attempt})`);
          const res = await axios.post(`${BASE}/api/sync/league/${lid}/window`, { pastDays: 30, futureDays: 14, skipExisting: true }, { headers: { 'x-api-key': ADMIN_KEY }, timeout: perLeaguePostTimeout });
          console.log(`[run_cron_now] league ${lid} OK: upserted=${res.data.upsertedCount || 'n/a'} fetched=${res.data.totalFetched || 'n/a'}`);
          success = true;
        } catch (e) {
          const body = e?.response?.data;
          console.error(`[run_cron_now] league ${lid} ERROR on attempt ${attempt}`, body || e.message);
          if (attempt < maxAttempts) {
            const backoff = attempt * 2000;
            console.log(`[run_cron_now] retrying league ${lid} after ${backoff}ms`);
            await sleep(backoff);
          }
          if (e?.response?.status === 429) {
            console.warn('[run_cron_now] Rate limited; cooling off and continuing to next league.');
            break;
          }
        }
      }
      await sleep(perLeagueDelayMs);
    }
    console.log(`[run_cron_now] Processed ${leagueIds.length} leagues.`);
  } catch (err) {
    console.error('[run_cron_now] Error running cron now', err?.response?.data || err.message || err);
    process.exitCode = 2;
  }
}

run();
