// cron/cronOptimized.js (Fixed version addressing node-cron blocking issues)
"use strict";

const cron = require("node-cron");
const axios = require("axios");

const BASE = process.env.SELF_BASE || "http://localhost:8000";
const ADMIN_KEY = process.env.ADMIN_API_KEY;

// Shared axios instance for internal API calls (centralises headers/timeouts)
const api = axios.create({ 
  baseURL: BASE, 
  headers: { 'x-api-key': ADMIN_KEY }, 
  timeout: 30_000  // Reduced from potentially unlimited timeout
});

// Simple in-memory caching for league discovery to avoid repeated /api/leagues calls
const LEAGUES_TTL_MS = Number(process.env.CRON_LEAGUES_TTL_MS || 5 * 60 * 1000); // 5 minutes by default
let _cachedLeagues = { ts: 0, data: null };

// Event loop yielding helper - crucial for preventing blocking
function yieldEventLoop() {
  return new Promise(resolve => setImmediate(resolve));
}

// Chunked processing helper to prevent blocking
async function processInChunks(items, processor, chunkSize = 5) {
  const results = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(chunk.map(processor));
    results.push(...chunkResults);
    
    // Yield to event loop between chunks
    if (i + chunkSize < items.length) {
      await yieldEventLoop();
    }
  }
  return results;
}

async function getLeaguesWithFallback(force = false) {
  if (!force && _cachedLeagues.data && (Date.now() - _cachedLeagues.ts) < LEAGUES_TTL_MS) {
    return _cachedLeagues.data;
  }

  let leagueIds = [];
  try {
    const r = await api.get('/api/leagues');
    if (Array.isArray(r.data)) leagueIds = r.data.map(l => ({ id: Number(l.id), name: l.name, region: l.region, country: l.country || null })).filter(x => Number.isFinite(x.id));
  } catch (e) {
    console.warn('[cron] Failed to fetch /api/leagues; attempting catalog fallback', e?.response?.data || e.message);
    try {
      await api.post('/api/sync/catalog/all', { mode: 'leagues' }, { timeout: 60_000 });
      const r2 = await api.get('/api/leagues');
      if (Array.isArray(r2.data)) leagueIds = r2.data.map(l => ({ id: Number(l.id), name: l.name, region: l.region, country: l.country || null })).filter(x => Number.isFinite(x.id));
    } catch (e2) {
      console.warn('[cron] Catalog fallback failed to provide leagues:', e2?.response?.data || e2.message);
    }
  }

  _cachedLeagues = { ts: Date.now(), data: leagueIds };
  return leagueIds;
}

// Simple sliding-window rate limiter for internal cron->server posts to avoid bursting
const CRON_PROVIDER_MAX_CALLS_PER_MIN = Number(process.env.CRON_PROVIDER_MAX_CALLS_PER_MIN || 60);
let _cronPostTimestamps = [];

async function throttledApiPost(path, body, opts = {}) {
  // remove timestamps older than 60s
  const now = Date.now();
  _cronPostTimestamps = _cronPostTimestamps.filter(ts => (now - ts) < 60_000);
  if (_cronPostTimestamps.length >= CRON_PROVIDER_MAX_CALLS_PER_MIN) {
    const oldest = _cronPostTimestamps[0];
    const waitMs = Math.max(50, 60_000 - (now - oldest));
    console.log(`[cron] Rate limiter active: waiting ${waitMs}ms before posting ${path}`);
    await sleep(waitMs);
  }
  // record timestamp and perform request
  _cronPostTimestamps.push(Date.now());
  
  // Ensure shorter timeout for cron operations to prevent blocking
  const finalOpts = { timeout: 30_000, ...opts };
  return api.post(path, body, finalOpts);
}

// Simple concurrency runner with event loop yielding
async function runWithConcurrency(items, worker, concurrency = 1) {
  const results = [];
  let i = 0;
  const active = [];

  function enqueue() {
    if (i >= items.length) return null;
    const item = items[i++];
    const p = (async () => {
      try {
        const result = await worker(item);
        // Yield to event loop after each worker completes
        await yieldEventLoop();
        return result;
      } catch (e) {
        await yieldEventLoop();
        throw e;
      }
    })();
    active.push(p);
    // when done remove from active
    p.then(() => { const idx = active.indexOf(p); if (idx !== -1) active.splice(idx, 1); })
     .catch(() => { const idx = active.indexOf(p); if (idx !== -1) active.splice(idx, 1); });
    return p;
  }

  // kick off initial batch
  for (let j = 0; j < concurrency; j++) enqueue();

  while (active.length) {
    await Promise.race(active);
    // fill up to concurrency
    while (active.length < concurrency && i < items.length) enqueue();
  }
  return results;
}

// Simple job lock to avoid overlapping runs of the same cron job (in-process)
const jobLocks = new Set();
async function runIfNotRunning(name, fn) {
  if (jobLocks.has(name)) {
    console.log(`[cron] Skipping ${name} because previous run still in progress`);
    return;
  }
  jobLocks.add(name);
  try {
    await fn();
  } catch (err) {
    throw err;
  } finally {
    jobLocks.delete(name);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function startCrons() {
  // Keep references to scheduled tasks so we can stop them during shutdown
  const scheduledTasks = [];

  // 1) Live sync — every 2 minutes (OPTIMIZED)
  const liveNowTask = cron.schedule("*/2 * * * *", async () => {
    await runIfNotRunning('live-now', async () => {
      try {
        // Shorter timeout to prevent blocking
        const { data } = await api.post('/api/sync/live-now', {}, { timeout: 15_000 });
        console.log('[cron] live-now sync ok', { foundLive: data.foundLive, upserts: data.upsertedCount });
      } catch (e) {
        const body = e?.response?.data || e.message;
        console.error('[cron] live-now sync failed', body);
        const is429 = e?.response?.status === 429 || /rate limit/i.test(JSON.stringify(body || ''));
        if (is429) {
          const COOL_OFF_MS = Number(process.env.CRON_PROVIDER_COOLDOWN_MS || 30_000); // Reduced cooldown
          console.warn(`[cron] live-now rate-limited. Cooling off for ${COOL_OFF_MS}ms before next run.`);
          await sleep(COOL_OFF_MS);
        }
      }
    });
  });
  scheduledTasks.push(liveNowTask);

  // Daily date sync - single day only to reduce load
  const dailyDateTask = cron.schedule('5 3 * * *', async () => {
    try {
      const today = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const y = today.getUTCFullYear();
      const m = pad(today.getUTCMonth() + 1);
      const d = pad(today.getUTCDate());
      
      // Shorter timeout for daily tasks
      const { data } = await axios.post(`${BASE}/api/sync/date/${y}/${m}/${d}`, {}, { 
        headers: { 'x-api-key': ADMIN_KEY },
        timeout: 60_000  // Reduced from potential unlimited timeout
      });
      console.log('[cron] daily/date sync ok', { date: `${y}-${m}-${d}`, upserts: data.upsertedCount });
    } catch (e) {
      const body = e?.response?.data || e.message;
      console.error('[cron] daily/date sync failed', body);
    }
  });
  scheduledTasks.push(dailyDateTask);

  // 2) OPTIMIZED League-window sync with chunked processing
  const leagueWindowCron = process.env.CRON_LEAGUE_WINDOW_CRON || '0 3 * * *';
  const leagueWindowTask = cron.schedule(leagueWindowCron, async () => {
    await runIfNotRunning('league-window', async () => {
      console.log("[cron] Starting optimized league window sync batch...");
      try {
        const leagueObjs = await getLeaguesWithFallback();
        const leagueIds = (leagueObjs || []).map(x => x.id).filter(Number.isFinite);

        if (!leagueIds || !leagueIds.length) {
          console.log('[cron] No league ids discovered; skipping league-window sync this run.');
          return;
        }

        // Significantly reduced batch size and increased delays
        const BATCH_SIZE = Number(process.env.CRON_BATCH_SIZE || 5); // Reduced from 10
        const PER_LEAGUE_DELAY_MS = Number(process.env.CRON_LEAGUE_DELAY_MS || 3000); // Increased from 1500

        const worker = async (lid) => {
          try {
            const body = { pastDays: 0, futureDays: 30, dateOnly: true, minimal: true };
            // Reduced timeout to prevent blocking
            const syncRes = await throttledApiPost(`/api/sync/league/${lid}/window`, body, { timeout: 2*60*1000 });
            console.log(`[cron] League forward-check: ${lid} (upserts=${syncRes.data.upsertedCount || 'n/a'} fetched=${syncRes.data.totalFetched || 'n/a'})`);
          } catch (e) {
            const body = e?.response?.data;
            const is429 = e?.response?.status === 429 || /rate limit/i.test(JSON.stringify(body || ''));
            console.error(`[cron] League ${lid} failed`, body || e.message);
            if (is429) {
              const COOL_OFF_MS = Number(process.env.CRON_COOL_OFF_MS || 60_000);
              console.warn(`[cron] Rate limited. Cooling off ${COOL_OFF_MS}ms.`);
              await sleep(COOL_OFF_MS);
              throw new Error('Rate limited'); // Stop processing this batch
            }
          }
          await sleep(PER_LEAGUE_DELAY_MS);
        };

        // Process leagues in small chunks with event loop yielding
        const targetLeagues = leagueIds.slice(0, BATCH_SIZE);
        await processInChunks(targetLeagues, worker, 2); // Process 2 at a time

        console.log(`[cron] League window sync processed ${targetLeagues.length} leagues this run.`);
      } catch (err) {
        console.error('[cron] League-window sync failed', err?.response?.data || err.message || err);
      }
    });
  });
  scheduledTasks.push(leagueWindowTask);

  // 3) OPTIMIZED Pre-match lineup fetch with chunking and event loop yielding
  const preMatchLineupTask = cron.schedule('*/5 * * * *', async () => {
    await runIfNotRunning('pre-match-lineup', async () => {
      try {
        const now = new Date();
        const lookaheadMin = Number(process.env.CRON_PREMATCH_LOOKAHEAD_MIN || 45);
        const lookaheadMax = Number(process.env.CRON_PREMATCH_LOOKAHEAD_MAX || 70);

        const windowStart = new Date(now.getTime() + (Math.max(0, lookaheadMin) * 60 * 1000));
        const windowEnd = new Date(now.getTime() + (Math.max(lookaheadMin + 1, lookaheadMax) * 60 * 1000));

        const SLACK_MS = Number(process.env.CRON_PREMATCH_SLACK_MS || (3 * 60 * 1000));
        windowStart.setTime(windowStart.getTime() - SLACK_MS);
        windowEnd.setTime(windowEnd.getTime() + SLACK_MS);

        const Match = require('../models/Match');
        const startTs = Math.floor(windowStart.getTime() / 1000);
        const endTs = Math.floor(windowEnd.getTime() / 1000);
        
        // Limit query to prevent large result sets
        const upcoming = await Match.find({
          $or: [
            { 'match_info.starting_at': { $gte: windowStart, $lte: windowEnd } },
            { date: { $gte: windowStart, $lte: windowEnd } },
            { 'match_info.starting_at_timestamp': { $gte: startTs, $lte: endTs } }
          ]
        }).limit(20).lean(); // Limit to 20 matches maximum

        const targetDescr = `${lookaheadMin}-${lookaheadMax}min`;
        if (!upcoming || !upcoming.length) {
          return console.log(`[cron] No matches due for lineup fetch in ${targetDescr} window.`);
        }

        console.log(`[cron] Found ${upcoming.length} matches to check for lineups in ${targetDescr} window`);

        const { fetchMatchStats } = require('../controllers/matchSyncController');
        const { normaliseFixtureToMatchDoc } = require('../utils/normaliseFixture');

        // Process matches in chunks to prevent blocking
        const worker = async (m) => {
          try {
            // Shorter timeout for individual match fetches
            const sm = await Promise.race([
              fetchMatchStats(m.match_id),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10_000))
            ]);
            
            if (!sm) return;
            
            const norm = normaliseFixtureToMatchDoc(sm) || {};
            let lineup = (norm && norm.lineup) ? norm.lineup : { home: [], away: [] };

            const lineupToSave = { 
              home: (lineup.home || []).map(p => ({ ...p, rating: null })), 
              away: (lineup.away || []).map(p => ({ ...p, rating: null })) 
            };

            const lineupsFlattened = [];
            const pushFlat = (arr, teamId) => {
              for (const p of (arr || [])) {
                lineupsFlattened.push({
                  player_id: p.player_id ?? null,
                  team_id: p.team_id ?? teamId ?? null,
                  player_name: p.player_name || p.name || p.player || '',
                  position_id: p.position_id ?? p.position ?? null,
                  formation_field: p.formation_field ?? null,
                  formation_position: p.formation_position ?? p.role ?? null,
                  jersey_number: p.jersey_number ?? p.number ?? null,
                  type_id: p.type_id ?? null,
                  details: []
                });
              }
            };
            pushFlat(lineupToSave.home || [], m.home_team_id || m.homeId || null);
            pushFlat(lineupToSave.away || [], m.away_team_id || m.awayId || null);

            await Match.findOneAndUpdate(
              { match_id: m.match_id }, 
              { $set: { lineup: lineupToSave, lineups: lineupsFlattened } }
            );
            console.log(`[cron] Persisted lineup for match ${m.match_id}`);
          } catch (e) {
            console.warn('[cron] Failed to fetch/persist lineup for match', m.match_id, e?.message || e);
          }
        };

        // Process in small chunks with delays
        await processInChunks(upcoming, worker, 3);
        
      } catch (err) {
        console.error('[cron] pre-match lineup fetch job failed', err?.response?.data || err.message || err);
      }
    });
  });
  scheduledTasks.push(preMatchLineupTask);

  // Reports task - unchanged but with timeout
  const reportsTask = cron.schedule('30 4 * * *', async () => {
    await runIfNotRunning('reports-daily', async () => {
      try {
        await autoGenerateReportsForFinishedMatches();
      } catch (e) {
        console.error('[cron] auto-generate reports failed', e?.message || e);
      }
    });
  });
  scheduledTasks.push(reportsTask);

  // OPTIMIZED Team match info refresh with chunked processing
  const teamMatchInfoTask = cron.schedule('0 5 * * *', async () => {
    await runIfNotRunning('team-match-info-refresh', async () => {
      try {
        console.log('[cron] Starting optimized team match info refresh...');
        await refreshStaleTeamMatchInfoOptimized();
        console.log('[cron] Completed optimized team match info refresh.');
      } catch (e) {
        console.error('[cron] team match info refresh failed', e?.message || e);
      }
    });
  });
  scheduledTasks.push(teamMatchInfoTask);

  // OPTIMIZED Three-week lookahead with better chunking
  const threeWeekLookaheadTask = cron.schedule('0 * * * *', async () => {
    await runIfNotRunning('3w-lookahead', async () => {
      console.log('[cron] Starting optimized 3-week lookahead...');
      try {
        const leagueObjs = await getLeaguesWithFallback();
        if (!leagueObjs || !leagueObjs.length) return console.log('[cron] No leagues for 3-week lookahead.');

        const europeFiltered = leagueObjs.filter(l => {
          try {
            if (l.region && String(l.region).toLowerCase().includes('europe')) return true;
            if (l.country && (l.country.continent || l.country.continent_name) && String(l.country.continent || l.country.continent_name).toLowerCase().includes('europe')) return true;
            if (String(l.name).toLowerCase().includes('europe')) return true;
          } catch (e) {}
          return false;
        });
        const candidates = (europeFiltered.length ? europeFiltered : leagueObjs).map(x => x.id);

        const CHUNKS_PER_DAY = Number(process.env.CRON_LOOKAHEAD_CHUNKS_PER_DAY || 24);
        const now = new Date();
        const chunkIndex = now.getUTCHours() % Math.max(1, CHUNKS_PER_DAY);

        const subset = candidates.filter((_, idx) => (idx % CHUNKS_PER_DAY) === chunkIndex);

        const utcTodayMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const dt = new Date(utcTodayMidnight.getTime() + 21 * 24 * 3600 * 1000);
        const y = dt.getUTCFullYear();
        const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
        const d = String(dt.getUTCDate()).padStart(2, '0');
        
        console.log(`[cron] Lookahead date => ${y}-${m}-${d} (chunk=${chunkIndex}, size=${subset.length})`);

        // Reduced concurrency and increased delays
        const worker = async (lid) => {
          try {
            const body = { pastDays: 0, futureDays: 0, date: `${y}-${m}-${d}` };
            const syncRes = await throttledApiPost(`/api/sync/league/${lid}/window`, body, { timeout: 2 * 60 * 1000 });
            console.log(`[cron] league ${lid} date ${y}-${m}-${d} OK: upserted=${syncRes.data.upsertedCount || 'n/a'}`);
          } catch (e) {
            console.warn(`[cron] league ${lid} date ${y}-${m}-${d} failed`, e?.response?.data || e.message || e);
          }
          await sleep(2500); // Increased delay
        };

        // Process in very small chunks
        await processInChunks(subset, worker, 1); // Process one at a time
        
        console.log('[cron] Completed optimized 3-week lookahead.');
      } catch (err) {
        console.error('[cron] 3-week lookahead job failed', err?.response?.data || err.message || err);
      }
    });
  });
  scheduledTasks.push(threeWeekLookaheadTask);

  // REMOVE THE TESTING PHASE CRON (it's adding significant load)
  // The testing seeding job is commented out to reduce load
  
  console.log("[cron] Optimized scheduler started.");

  // Expose a stopper for server shutdown
  async function stopCrons() {
    console.log('[cron] Stopping scheduled tasks...');
    for (const t of scheduledTasks) {
      try {
        if (t && typeof t.stop === 'function') t.stop();
      } catch (e) {
        console.warn('[cron] Failed to stop a task', e?.message || e);
      }
    }
  }

  module.exports.stopCrons = stopCrons;
}

// OPTIMIZED auto-generate reports with chunking
async function autoGenerateReportsForFinishedMatches() {
  try {
    const Match = require('../models/Match');
    const twoDaysAgo = new Date(Date.now() - (2 * 24 * 3600 * 1000));
    const now = new Date();

    // Limit to 50 matches to prevent blocking
    const matches = await Match.find({
      'match_info.starting_at': { $gte: twoDaysAgo, $lte: now },
      $or: [
        { 'reports.home': { $exists: false } },
        { 'reports.away': { $exists: false } },
        { reports: { $exists: false } }
      ]
    }).limit(50).lean();

    if (!matches || !matches.length) return console.log('[cron] No finished matches needing reports.');

    const worker = async (m) => {
      try {
        const ADMIN_KEY = process.env.ADMIN_API_KEY;
        const BASE = process.env.SELF_BASE || 'http://localhost:8000';
        
        await axios.post(`${BASE}/api/reports/v2/${m.home_team_slug || m.home_team.toLowerCase().replace(/\s+/g,'-')}/match/${m.match_id}/generate-both`, {}, {
          headers: { 'x-api-key': ADMIN_KEY },
          timeout: 30_000  // Timeout to prevent blocking
        });
        console.log(`[cron] Generated reports for match ${m.match_id}`);
      } catch (e) {
        console.error('[cron] report generation failed for', m.match_id, e?.response?.data || e.message || e);
      }
    };

    // Process reports in small chunks
    await processInChunks(matches, worker, 3);
    
  } catch (err) {
    console.error('[cron] autoGenerateReportsForFinishedMatches error', err);
  }
}

// OPTIMIZED team match info refresh with chunking and yielding
async function refreshStaleTeamMatchInfoOptimized() {
  try {
    const Team = require('../models/Team');
    const { getDynamicTeamMatchInfo } = require('../utils/teamMatchUtils');
    
    // Smaller batch sizes and longer delays
    const BATCH_SIZE = Number(process.env.CRON_TEAM_BATCH_SIZE || 20); // Reduced from 50
    const DELAY_MS = Number(process.env.CRON_TEAM_DELAY_MS || 200); // Increased

    let skip = 0;
    let processed = 0;
    let updated = 0;
    let errors = 0;

    while (true) {
      const teams = await Team.find({})
        .select('id slug name last_match_info next_match_info last_played_at next_game_at')
        .skip(skip)
        .limit(BATCH_SIZE)
        .lean();

      if (!teams || teams.length === 0) break;

      console.log(`[cron] Processing team match info batch: ${skip + 1}-${skip + teams.length}`);

      // Process teams in chunks with event loop yielding
      const worker = async (team) => {
        try {
          const currentInfo = await getDynamicTeamMatchInfo(team.slug, team.name);
          
          const needsUpdate = (
            (currentInfo.last_match_info?.date?.getTime() !== team.last_match_info?.date?.getTime()) ||
            (currentInfo.next_match_info?.date?.getTime() !== team.next_match_info?.date?.getTime()) ||
            (!currentInfo.last_match_info !== !team.last_match_info) ||
            (!currentInfo.next_match_info !== !team.next_match_info)
          );

          if (needsUpdate) {
            await Team.findOneAndUpdate(
              { slug: team.slug },
              {
                $set: {
                  last_match_info: currentInfo.last_match_info,
                  next_match_info: currentInfo.next_match_info,
                  last_played_at: currentInfo.last_played_at,
                  next_game_at: currentInfo.next_game_at
                }
              }
            );
            updated++;
            console.log(`[cron] Updated team match info: ${team.slug}`);
          }

          processed++;
          await sleep(DELAY_MS);
        } catch (e) {
          errors++;
          console.error(`[cron] Failed to refresh match info for team ${team.slug}:`, e?.message || e);
        }
      };

      // Process teams in small chunks with event loop yielding
      await processInChunks(teams, worker, 5);

      skip += BATCH_SIZE;
      
      // Yield to event loop between batches
      await yieldEventLoop();
    }

    console.log(`[cron] Team match info refresh complete: ${processed} processed, ${updated} updated, ${errors} errors`);
  } catch (err) {
    console.error('[cron] refreshStaleTeamMatchInfoOptimized error', err?.message || err);
  }
}

module.exports = { startCrons };