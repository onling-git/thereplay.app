const axios = require('axios');
const Team = require('../models/Team');
const { syncAllTeams } = require('./syncCatalogController'); // we’ll call directly for speed
const { ymd } = require('../utils/dates'); // small helper; see below
const SELF_BASE = process.env.SELF_BASE || 'http://localhost:8000';
const ADMIN_KEY = process.env.ADMIN_API_KEY;

async function postSelf(path, body = {}) {
  const { data } = await axios.post(`${SELF_BASE}${path}`, body, {
    headers: { 'x-api-key': ADMIN_KEY }
  });
  return data;
}

/**
 * POST /api/sync/full-season
 * Body:
 * {
 *   from: "YYYY-MM-DD",     // required (season start)
 *   to:   "YYYY-MM-DD",     // required (season end)
 *   pageStart?: 1, maxPages?: 999, delayMs?: 150, // optional knobs for team catalog
 *   filters?: {}            // optional: e.g. { country_id: 462 } if your plan supports
 * }
 */
exports.syncFullSeason = async (req, res) => {
  try {
    let { from, to, pageStart = 1, maxPages = 999, delayMs = 150, filters = {} } = req.body || {};
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to (YYYY-MM-DD) are required' });
    }

    // 1) Catalog teams (upserts into Team collection)
    await syncAllTeams({ body: { pageStart, maxPages, delayMs, filters } }, {
      json: () => {}
    });

    // 2) Fetch teams from DB
    const teams = await Team.find({}, 'name slug id').lean();

    // 3) For each team: sync fixtures in window, then recompute snapshot
    let synced = 0;
    for (const team of teams) {
      try {
        await postSelf(`/api/sync/team/${team.slug}/window`, { from, to });

        await postSelf(`/api/teams/${team.slug}/recompute`, {});
        synced++;
      } catch (e) {
        console.error(`[full-season] team failed: ${team.name}`, e?.response?.data || e.message);
      }
      // gentle throttle
      await new Promise(r => setTimeout(r, 250));
    }

    res.json({ ok: true, teams_seen: teams.length, teams_processed: synced, window: { from, to } });
  } catch (e) {
    console.error('syncFullSeason error:', e?.response?.data || e);
    res.status(500).json({ error: 'Full season sync failed', detail: e.message });
  }
};
