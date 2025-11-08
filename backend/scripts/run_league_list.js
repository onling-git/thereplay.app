const axios = require('axios');

const BASE = process.env.SELF_BASE || 'http://localhost:8000';
const ADMIN_KEY = process.env.ADMIN_API_KEY;

if (!ADMIN_KEY) {
  console.error('ADMIN_API_KEY environment variable is required to run this script.');
  process.exit(1);
}

// Accept league IDs via env LEAGUE_IDS (comma-separated) or CLI: --leagues="1,2,3"
const argv = require('minimist')(process.argv.slice(2));
const raw = process.env.LEAGUE_IDS || argv.leagues || argv.l || '';
if (!raw) {
  console.error('No leagues provided. Set LEAGUE_IDS env or pass --leagues="id,id,..."');
  process.exit(2);
}

const leagues = String(raw).split(/[ ,]+/).map(s => Number(s)).filter(Number.isFinite);
if (!leagues.length) {
  console.error('Parsed no valid league ids from:', raw);
  process.exit(3);
}

const perLeagueDelayMs = Number(process.env.CRON_LEAGUE_DELAY_MS || 1500);
const perLeaguePostTimeout = Number(process.env.CRON_LEAGUE_POST_TIMEOUT_MS || 10 * 60 * 1000);
const maxAttempts = Number(process.env.CRON_LEAGUE_MAX_ATTEMPTS || 2);

async function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

(async function(){
  console.log('[run_league_list] Running', leagues.length, 'leagues');
  for (const lid of leagues) {
    let attempt = 0;
    let success = false;
    while (attempt < maxAttempts && !success) {
      attempt += 1;
      try {
        console.log(`[run_league_list] Calling /api/sync/league/${lid}/window (attempt ${attempt})`);
        const res = await axios.post(`${BASE}/api/sync/league/${lid}/window`, { pastDays: 30, futureDays: 14, skipExisting: true }, { headers: { 'x-api-key': ADMIN_KEY }, timeout: perLeaguePostTimeout });
        console.log(`[run_league_list] league ${lid} OK: upserted=${res.data.upsertedCount || 'n/a'} fetched=${res.data.totalFetched || 'n/a'}`);
        success = true;
      } catch (e) {
        console.error(`[run_league_list] league ${lid} ERROR on attempt ${attempt}`, e?.response?.data || e?.message || e);
        if (attempt < maxAttempts) {
          const backoff = attempt * 2000;
          console.log(`[run_league_list] retrying league ${lid} after ${backoff}ms`);
          await sleep(backoff);
        }
        if (e?.response?.status === 429) {
          console.warn('[run_league_list] Rate limited on league', lid, '; continuing to next.');
          break;
        }
      }
    }
    await sleep(perLeagueDelayMs);
  }
  console.log('[run_league_list] Completed run for provided leagues');
})();
