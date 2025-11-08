const axios = require('axios');

const BASE = process.env.SELF_BASE || 'http://localhost:8000';
const ADMIN_KEY = process.env.ADMIN_API_KEY;

if (!ADMIN_KEY) {
  console.error('ADMIN_API_KEY environment variable is required to run this script.');
  process.exit(1);
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async function main(){
  try {
    console.log('[oneoff] Discovering leagues via /api/leagues');
    let leagueResp;
    try {
      leagueResp = await axios.get(`${BASE}/api/leagues`, { headers: { 'x-api-key': ADMIN_KEY }, timeout: 30000 });
    } catch (e) {
      console.error('[oneoff] Failed to fetch /api/leagues:', e?.response?.data || e?.message || e);
      process.exit(2);
    }

    const leagues = Array.isArray(leagueResp.data) ? leagueResp.data : [];
    const ids = leagues.map(l => ({ id: Number(l.id), name: l.name, region: l.region, country: l.country })).filter(x => Number.isFinite(x.id));
    console.log('[oneoff] discovered', ids.length, 'leagues');

    // Best-effort Europe filter
    const europe = ids.filter(l => {
      try {
        if (l.region && String(l.region).toLowerCase().includes('europe')) return true;
        if (l.country && (l.country.continent || l.country.continent_name) && String(l.country.continent || l.country.continent_name).toLowerCase().includes('europe')) return true;
        if (String(l.name).toLowerCase().includes('europe')) return true;
      } catch (e) {}
      return false;
    });

    const candidates = (europe.length ? europe : ids).map(x => x.id);
    console.log('[oneoff] candidates count', candidates.length);

    const perLeagueDelay = Number(process.env.CRON_LEAGUE_DELAY_MS || 1500);
    const now = new Date();

    for (let offset = 0; offset < 21; offset++) {
      const dt = new Date(now.getTime() + offset * 24 * 3600 * 1000);
      const y = dt.getUTCFullYear();
      const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
      const d = String(dt.getUTCDate()).padStart(2, '0');
      console.log(`[oneoff] day ${offset} => ${y}-${m}-${d} (checking ${candidates.length} leagues)`);

      for (const lid of candidates) {
        try {
          const res = await axios.post(`${BASE}/api/sync/league/${lid}/window`, { pastDays: 0, futureDays: 0, date: `${y}-${m}-${d}` }, { headers: { 'x-api-key': ADMIN_KEY }, timeout: 5 * 60 * 1000 });
          console.log(`[oneoff] league ${lid} date ${y}-${m}-${d} OK: upserted=${res.data.upsertedCount || 'n/a'} fetched=${res.data.totalFetched || 'n/a'}`);
        } catch (e) {
          console.warn(`[oneoff] league ${lid} date ${y}-${m}-${d} failed`, e?.response?.data || e?.message);
        }
        await sleep(perLeagueDelay);
      }
    }

    console.log('[oneoff] Completed 3-week lookahead per-day per-league sync.');
  } catch (err) {
    console.error('[oneoff] Error', err?.response?.data || err?.message || err);
    process.exit(3);
  }
})();
