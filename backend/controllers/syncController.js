// controllers/syncController.js
const { get } = require('../utils/sportmonks');
const { normaliseFixtureToMatchDoc } = require('../utils/normaliseFixture');
const Match = require('../models/Match');
const Team = require('../models/Team');

// Helper: remove undefined keys from an object (shallow) so $set won't overwrite
// existing DB fields with undefined values from provider payloads.
function cleanForUpsert(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}

// Small polite delay between extra provider calls to avoid rate bursts
const enrichDelayMs = 120;

async function tryFetchOne(path) {
  try {
    const res = await get(path);
    return res?.data?.data || res?.data || null;
  } catch (e) {
    console.warn('[enrich] failed fetch', path, e?.response?.data || e?.message || e);
    return null;
  }
}

/**
 * Enrich a fixture object with related provider objects if they're not present.
 * This will fetch referee, venue, season, and league by id when necessary.
 */
async function enrichFixtureRelated(fx) {
  if (!fx || typeof fx !== 'object') return fx;

  // referee
  const refId = fx.referee_id ?? fx.referee?.id ?? fx?.referee_id;
  if (!fx.referee && Number.isFinite(Number(refId))) {
    const ref = await tryFetchOne(`/referees/${Number(refId)}`);
    if (ref) fx.referee = ref;
    await new Promise(r => setTimeout(r, enrichDelayMs));
  }

  // venue
  const venueId = fx.venue_id ?? fx.venue?.id ?? fx?.venue_id;
  if (!fx.venue && Number.isFinite(Number(venueId))) {
    const v = await tryFetchOne(`/venues/${Number(venueId)}`);
    if (v) fx.venue = v;
    await new Promise(r => setTimeout(r, enrichDelayMs));
  }

  // season
  const seasonId = fx.season_id ?? fx.season?.id ?? fx?.season_id;
  if (!fx.season && Number.isFinite(Number(seasonId))) {
    const s = await tryFetchOne(`/seasons/${Number(seasonId)}`);
    if (s) fx.season = s;
    await new Promise(r => setTimeout(r, enrichDelayMs));
  }

  // league
  const leagueId = fx.league_id ?? fx.league?.id ?? fx?.league_id;
  if (!fx.league && Number.isFinite(Number(leagueId))) {
    const l = await tryFetchOne(`/leagues/${Number(leagueId)}`);
    if (l) fx.league = l;
    await new Promise(r => setTimeout(r, enrichDelayMs));
  }

  return fx;
}

// ----------------- helpers -----------------
const toSlug = (s) =>
  String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { mergeComments } = require('../utils/comments');

const ymd = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

/**
 * Generic pager for Sportmonks endpoints:
 * Calls GET {path} with { page, per_page, ...baseParams } until EMPTY page or maxPages.
 * Important: we **do not** stop on rows.length < per_page; only stop on EMPTY.
 */
async function pageThrough(
  path,
  { per_page = 25, startPage = 1, maxPages = 1000, delayMs = 150, baseParams = {} },
  onPage
) {
  let page = startPage;
  for (let i = 0; i < maxPages; i++) {
    const { data } = await get(path, { ...baseParams, page, per_page });
    const rows = Array.isArray(data?.data) ? data.data : [];
    if (!rows.length) break; // only stop on empty page
    await onPage(rows, page);
    page += 1;
    if (delayMs) await sleep(delayMs);
  }
}

  // Minimal processing: only upsert fixture start times (date/time) into Match documents
  async function minimalProcessFixturesForLeague(fixtures, leagueId) {
    let upserted = 0;
    let total = 0;
    for (const fx of fixtures) {
      total++;
      try {
        const matchId = Number(fx?.id || fx?.fixture_id);
        if (!Number.isFinite(matchId)) continue;

        // Try common fields for start time
        // Priority 1: Use starting_at_timestamp (UTC) if available
        let parsed;
        if (fx?.starting_at_timestamp && Number.isFinite(fx.starting_at_timestamp)) {
          // SportMonks timestamp is in seconds, JavaScript needs milliseconds
          parsed = new Date(fx.starting_at_timestamp * 1000);
        } else {
          // Priority 2: Try other date fields, but these are problematic as they're local times without timezone info
          const startCandidates = [fx?.starting_at, fx?.time?.starting_at, fx?.date, fx?.kickoff_at, fx?.starting_at_date];
          const startStr = startCandidates.find(s => s != null);
          if (!startStr) continue;
          
          console.warn(`⚠️  Using local time string for match ${fx?.id}: "${startStr}" - this may cause timezone issues`);
          
          // These are local times without timezone - we can't reliably convert them to UTC
          // without knowing the venue's timezone. For now, treat as UTC but log warning.
          if (typeof startStr === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(startStr)) {
            // Format: "YYYY-MM-DD HH:MM:SS" - we don't know the actual timezone
            parsed = new Date(startStr + 'Z'); // Assume UTC as fallback
          } else {
            parsed = new Date(startStr);
          }
        }
        if (isNaN(parsed.getTime())) continue;

        const parsedTs = Math.floor(parsed.getTime() / 1000);

        const existing = await Match.findOne({ match_id: matchId }).lean();
        let existingTs = null;
        try { existingTs = existing && existing.match_info && existing.match_info.starting_at ? Math.floor(new Date(existing.match_info.starting_at).getTime() / 1000) : null; } catch (e) { existingTs = null; }

        // If timestamps are equal, nothing to do
        if (existingTs === parsedTs) continue;

        const setObj = {
          match_info: {
            starting_at: parsed,
            starting_at_timestamp: parsedTs
          },
          date: parsed
        };

        await Match.findOneAndUpdate({ match_id: matchId }, { $set: cleanForUpsert(setObj) }, { upsert: true, new: true }).lean();
        upserted++;
      } catch (e) {
        console.error('minimalProcessFixturesForLeague failed for fixture', fx?.id || fx?.fixture_id, e?.message || e);
      }
    }
    return { totalFetched: total, upsertedCount: upserted };
  }

/** Upsert a batch of teams (Sportmonks team rows) */
async function upsertTeams(rows) {
  let upserts = 0;
  for (const t of rows) {
    if (t?.placeholder) continue;
    const id = Number(t?.id);
    if (!Number.isFinite(id)) continue;

    const name = t.name || t.short_code || `team-${id}`;
    const doc = {
      id,
      name,
      slug: toSlug(name),
      short_code: t.short_code || null,
      image_path: t.image_path || null,
      country_id: t.country_id ?? null,
      gender: t.gender || null,
      type: t.type || null,
    };
    await Team.findOneAndUpdate({ id }, { $set: doc }, { upsert: true });
    upserts++;
  }
  return upserts;
}

/** Discover leagues (works widely on v3) */
async function fetchAllLeagueIds({ per_page = 50, delayMs = 200, maxPages = 500 } = {}) {
  const ids = new Set();
  await pageThrough(
    '/leagues',
    { per_page, delayMs, maxPages },
    (rows) => rows.forEach((l) => Number.isFinite(+l?.id) && ids.add(+l.id))
  );
  return Array.from(ids);
}

/** Discover countries (sometimes plan-limited) */
async function fetchAllCountryIds({ per_page = 50, delayMs = 200, maxPages = 200 } = {}) {
  const ids = new Set();
  await pageThrough(
    '/countries',
    { per_page, delayMs, maxPages },
    (rows) => rows.forEach((c) => Number.isFinite(+c?.id) && ids.add(+c.id))
  );
  return Array.from(ids);
}

// --------------- core fixture upsert ---------------
async function syncFixtureInternal(fixtureId) {
  // Request richer includes to capture lineups and typed statistics when available.
  const include = 'events;participants;scores;periods;state;lineups;statistics.type;comments';
  const { data } = await get(`/fixtures/${fixtureId}`, { include });
  const fx = data?.data;
  if (!fx) throw new Error('Fixture not found from Sportmonks');

  // Enrich with related objects when not present
  await enrichFixtureRelated(fx);

  const doc = normaliseFixtureToMatchDoc(fx);
  if (!doc) throw new Error('Failed to normalise fixture');

  // Avoid overwriting existing events with an empty events array from the provider.
  // If provider returned events (non-empty), persist them. Otherwise keep existing DB events.
  const existing = await Match.findOne({ match_id: doc.match_id }).lean();
  const setObj = { ...doc };
  if (!Array.isArray(doc.events) || doc.events.length === 0) {
    // Preserve existing events if present
    if (existing && Array.isArray(existing.events) && existing.events.length) {
      delete setObj.events; // don't overwrite
    } else {
      // no existing events; ensure events is not set to undefined
      setObj.events = Array.isArray(doc.events) ? doc.events : [];
    }
  }
  // Merge incoming comments with existing to avoid losing history
  if (Array.isArray(doc.comments) && doc.comments.length) {
    setObj.comments = mergeComments(existing && existing.comments ? existing.comments : [], doc.comments);
  } else if (existing && Array.isArray(existing.comments) && existing.comments.length) {
    delete setObj.comments;
  } else {
    setObj.comments = Array.isArray(doc.comments) ? doc.comments : [];
  }

  // Prune placeholder or empty values so we don't overwrite rich DB state with
  // non-meaningful defaults from provider normalisation (e.g., 'Home'/'Away'
  // placeholders or empty match_status objects). This preserves teams set by
  // the daily fixture cron and avoids clearing match_status when provider omits it.
  //
  // Background: some provider payloads or normalisation logic populate team
  // fields with fallbacks like 'Home'/'Away' or an empty `match_status` object.
  // When we call findOneAndUpdate with $set including these, we inadvertently
  // clear the canonical team data previously written by the daily fixture cron
  // and can also wipe a valid `match_status`. To prevent that, remove those
  // fields from the update unless they contain meaningful values.
  try {
    // Helper: consider a team name meaningful when it's truthy and not a placeholder
    const isMeaningfulTeamName = (name) => !!(name && String(name).trim() && !['home', 'away', 'Home', 'Away'].includes(String(name)));
    const hasMeaningfulTeamId = (id) => (id != null && id !== '');

    // Home team
    if (!isMeaningfulTeamName(setObj.home_team) && !hasMeaningfulTeamId(setObj.home_team_id)) {
      delete setObj.home_team;
      delete setObj.home_team_id;
      delete setObj.home_team_slug;
    }
    // Away team
    if (!isMeaningfulTeamName(setObj.away_team) && !hasMeaningfulTeamId(setObj.away_team_id)) {
      delete setObj.away_team;
      delete setObj.away_team_id;
      delete setObj.away_team_slug;
    }

    // match_status: only set when provider supplied a non-empty status
    if (setObj.match_status && typeof setObj.match_status === 'object') {
      const ms = setObj.match_status;
      const hasAny = (ms.id != null && ms.id !== '') || (ms.short_name && String(ms.short_name).trim()) || (ms.state && String(ms.state).trim()) || (ms.name && String(ms.name).trim());
      if (!hasAny) delete setObj.match_status;
    }
  } catch (e) {
    // non-fatal - if pruning fails, continue with existing behaviour
    console.warn('prune setObj failed:', e?.message || e);
  }

  await Match.findOneAndUpdate(
    { match_id: doc.match_id },
    { $set: cleanForUpsert(setObj) },
    { upsert: true, new: true }
  ).lean();

  return doc.match_id;
}

// ====================== EXPORTS (route handlers) ======================

/**
 * POST /api/sync/fixture/:fixtureId
 * Pull a single fixture once.
 */
exports.syncFixture = async (req, res) => {
  try {
    const fixtureId = String(req.params.fixtureId || '');
    if (!fixtureId) return res.status(400).json({ error: 'fixtureId required' });

    const matchId = await syncFixtureInternal(fixtureId);
    res.json({ ok: true, match_id: matchId });
  } catch (e) {
    const detail = e?.response?.data || e.message || e;
    console.error('syncFixture error:', detail);
    res.status(500).json({
      error: 'Sync failed',
      detail: typeof detail === 'string' ? detail : JSON.stringify(detail),
    });
  }
};

exports.syncFixtureInternal = syncFixtureInternal;

/**
 * POST /api/sync/team/:teamSlug/window
 * Pull fixtures for a team in a date window.
 * Body: { from:'YYYY-MM-DD', to:'YYYY-MM-DD' } OR { pastDays:30, futureDays:14 }
 */
exports.syncTeamWindow = async (req, res) => {
  try {
    const teamSlug = toSlug(req.params.teamSlug);
    const team = await Team.findOne({ slug: teamSlug }).lean();
    if (!team) return res.status(404).json({ error: `Team not found: ${teamSlug}` });
    if (!Number.isFinite(+team.id))
      return res.status(400).json({ error: `Team "${teamSlug}" missing numeric id` });

  let { from, to, pastDays, futureDays } = req.body || {};
  const skipExisting = req.body?.skipExisting || req.query?.skipExisting || false;
    if (!from || !to) {
      const now = new Date();
      const fromD = new Date(now);
      fromD.setUTCDate(fromD.getUTCDate() - (Number.isFinite(+pastDays) ? +pastDays : 30));
      const toD = new Date(now);
      toD.setUTCDate(toD.getUTCDate() + (Number.isFinite(+futureDays) ? +futureDays : 14));
      from = ymd(fromD);
      to = ymd(toD);
    }

  const include = 'events;participants;scores;periods;state;lineups;statistics.type;comments';
    // v3 team + date range endpoint
    const { data } = await get(`/fixtures/between/${from}/${to}/${team.id}`, { include });
    const fixtures = Array.isArray(data?.data) ? data.data : [];

    let upsertedCount = 0;
    const match_ids = [];

    for (const fx of fixtures) {
      try {
        // Enrich related objects (venue/referee/season/league) when provider didn't include them
        try { await enrichFixtureRelated(fx); } catch (e) { console.warn('Enrichment failed for team fixture', fx?.id || fx?.fixture_id || '(unknown)', e?.message || e); }
        const doc = normaliseFixtureToMatchDoc(fx);
        if (!doc) continue;
        if (doc.home_team) doc.home_team_slug = toSlug(doc.home_team);
        if (doc.away_team) doc.away_team_slug = toSlug(doc.away_team);

        // Merge comments with existing DB comments to avoid losing history
        const existing = await Match.findOne({ match_id: doc.match_id }).lean();
        const setObj = { ...doc };
        if (Array.isArray(doc.comments) && doc.comments.length) {
          setObj.comments = mergeComments(existing && existing.comments ? existing.comments : [], doc.comments);
        } else if (existing && Array.isArray(existing.comments) && existing.comments.length) {
          delete setObj.comments;
        } else {
          setObj.comments = Array.isArray(doc.comments) ? doc.comments : [];
        }

        await Match.findOneAndUpdate(
          { match_id: doc.match_id },
          { $set: cleanForUpsert(setObj) },
          { upsert: true, new: true }
        ).lean();

        upsertedCount++;
        match_ids.push(doc.match_id);
      } catch (errUpsert) {
        console.error('Upsert failed for team fixture', fx?.id, errUpsert?.message || errUpsert);
      }
    }

    res.json({
      ok: true,
      team: { slug: teamSlug, id: team.id, name: team.name },
      requested: { from, to },
      totalFetched: fixtures.length,
      upsertedCount,
      match_ids,
    });
  } catch (e) {
    const detail = e?.response?.data || e.message || e;
    console.error('syncTeamWindow error:', detail);
    res.status(500).json({
      error: 'Team window sync failed',
      detail: typeof detail === 'string' ? detail : JSON.stringify(detail),
    });
  }
};

/**
 * POST /api/sync/live-now
 * Pull all live fixtures now (use with cron every 1–2 minutes).
 */
exports.syncLiveNow = async (req, res) => {
  try {
  const include = 'events;participants;scores;periods;state;lineups;statistics.type;comments';
    // Prefer the inplay endpoint to only fetch currently-live fixtures (more efficient)
    const { data } = await get('/livescores/inplay', { include }); // v3 livescores inplay
    const fixtures = Array.isArray(data?.data) ? data.data : [];

    let upsertedCount = 0;
    const match_ids = [];

    for (const fx of fixtures) {
      try {
        // Enrich related objects (venue/referee/season/league) when provider didn't include them
        try { await enrichFixtureRelated(fx); } catch (e) { console.warn('Enrichment failed for live fixture', fx?.id || fx?.fixture_id || '(unknown)', e?.message || e); }
        // If the inplay aggregation didn't include comments, fetch the single-fixture
        // to try and obtain comments (SportMonks sometimes omits comments from inplay).
        const hasCommentsRaw = fx?.comments && (Array.isArray(fx.comments.data) ? fx.comments.data.length : fx.comments.length);
        if (!hasCommentsRaw) {
          try {
            console.log(`[sync][comments] inplay fixture ${fx.id || fx.fixture_id} missing comments — fetching full fixture`);
            const full = await tryFetchOne(`/fixtures/${fx.id || fx.fixture_id}`);
            if (full) {
              // prefer full.comments.data shape if present
              fx.comments = Array.isArray(full.comments)
                ? full.comments
                : Array.isArray(full.comments?.data)
                ? full.comments.data
                : fx.comments || [];
              console.log(`[sync][comments] fetched full fixture ${fx.id || fx.fixture_id}, full.comments=${(Array.isArray(fx.comments)?fx.comments.length:0)}`);
            }
          } catch (e) {
            console.warn('failed to fetch full fixture for comments', fx?.id || fx?.fixture_id, e?.message || e);
          }
          await sleep(enrichDelayMs);
        }

        const doc = normaliseFixtureToMatchDoc(fx);
        if (!doc) continue;

        // Merge incoming comments with existing DB comments
        const existing = await Match.findOne({ match_id: doc.match_id }).lean();
        const setObj = { ...doc };
        if (Array.isArray(doc.comments) && doc.comments.length) {
          setObj.comments = mergeComments(existing && existing.comments ? existing.comments : [], doc.comments);
        } else if (existing && Array.isArray(existing.comments) && existing.comments.length) {
          delete setObj.comments;
        } else {
          setObj.comments = Array.isArray(doc.comments) ? doc.comments : [];
        }

        await Match.findOneAndUpdate(
          { match_id: doc.match_id },
          { $set: cleanForUpsert(setObj) },
          { upsert: true, new: true }
        ).lean();

        upsertedCount++;
        match_ids.push(doc.match_id);
      } catch (errUpsert) {
        console.error('live upsert failed', fx?.id, errUpsert?.message || errUpsert);
      }
    }

    res.json({ ok: true, foundLive: fixtures.length, upsertedCount, match_ids });
  } catch (e) {
    const detail = e?.response?.data || e.message || e;
    console.error('syncLiveNow error:', detail);
    res.status(500).json({
      error: 'live-now failed',
      detail: typeof detail === 'string' ? detail : JSON.stringify(detail),
    });
  }
};

/**
 * POST /api/sync/date/:y/:m/:d
 * Pull all fixtures for a specific date (UTC).
 */
exports.syncByDate = async (req, res) => {
  try {
    const { y, m, d } = req.params;
    const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const include = 'events;participants;scores;periods;state;lineups;statistics.type;comments';
    const { data } = await get(`/fixtures/date/${date}`, { include });
    const fixtures = Array.isArray(data?.data) ? data.data : [];

    let upsertedCount = 0;
    const match_ids = [];

    for (const fx of fixtures) {
      try {
        // Enrich related objects when provider didn't include them
        await enrichFixtureRelated(fx);
        const doc = normaliseFixtureToMatchDoc(fx);
        if (!doc) continue;

        if (doc.home_team) doc.home_team_slug = doc.home_team_slug || toSlug(doc.home_team);
        if (doc.away_team) doc.away_team_slug = doc.away_team_slug || toSlug(doc.away_team);

        // For by-date upserts, merge comments and perform upsert
        const existing2 = await Match.findOne({ match_id: doc.match_id }).lean();
        const setObj2 = { ...doc };
        if (Array.isArray(doc.comments) && doc.comments.length) {
          setObj2.comments = mergeComments(existing2 && existing2.comments ? existing2.comments : [], doc.comments);
        } else if (existing2 && Array.isArray(existing2.comments) && existing2.comments.length) {
          delete setObj2.comments;
        } else {
          setObj2.comments = Array.isArray(doc.comments) ? doc.comments : [];
        }

        await Match.findOneAndUpdate(
          { match_id: doc.match_id },
          { $set: cleanForUpsert(setObj2) },
          { upsert: true, new: true }
        ).lean();

        upsertedCount++;
        match_ids.push(doc.match_id);
      } catch (e) {
        console.error('Upsert failed for date fixture', fx?.id, e?.message || e);
      }
    }

    res.json({ ok: true, date, totalFetched: fixtures.length, upsertedCount, match_ids });
  } catch (e) {
    const status = e?.response?.status;
    const detail = e?.response?.data || e.message || e;
    console.error('syncByDate error:', detail);

    if (status === 429) {
      // Provider rate-limited us — surface 429 to caller with provider detail
      const body = typeof detail === 'string' ? detail : JSON.stringify(detail);
      return res.status(429).json({ error: 'date sync rate limited', detail: body });
    }

    res.status(500).json({
      error: 'date sync failed',
      detail: typeof detail === 'string' ? detail : JSON.stringify(detail),
    });
  }
};

/**
 * POST /api/sync/league/:leagueId/window
 * Pull fixtures for a league in a date window.
 * Body: { from:'YYYY-MM-DD', to:'YYYY-MM-DD' } OR { pastDays:30, futureDays:14 }
 */
exports.syncLeagueWindow = async (req, res) => {
  try {
    const leagueIdRaw = req.params.leagueId;
    const leagueId = Number(leagueIdRaw);
    if (!Number.isFinite(leagueId)) return res.status(400).json({ error: 'leagueId must be numeric' });

  let { from, to, pastDays, futureDays } = req.body || {};
  const minimal = req.body?.minimal || req.query?.minimal || false;
  const dateOnly = req.body?.dateOnly || req.query?.dateOnly || false;
  const skipExisting = req.body?.skipExisting || req.query?.skipExisting || false;
    if (!from || !to) {
      const now = new Date();
      const fromD = new Date(now);
      fromD.setUTCDate(fromD.getUTCDate() - (Number.isFinite(+pastDays) ? +pastDays : 30));
      const toD = new Date(now);
      toD.setUTCDate(toD.getUTCDate() + (Number.isFinite(+futureDays) ? +futureDays : 14));
      from = ymd(fromD);
      to = ymd(toD);
    }

  const include = 'events;participants;scores;periods;state;lineups;statistics.type;comments';
    // First attempt: try fetching fixtures directly filtered by league (more efficient when supported)
    try {
      const collected = [];
      // SportMonks API v3 uses filters[fieldname]=value format, not the old colon syntax
      // Try the modern filter format first
      await pageThrough(
        '/fixtures',
        { per_page: 50, delayMs: 150, maxPages: 500, baseParams: { include, [`filters[league_id]`]: leagueId } },
        async (rows) => {
          collected.push(...rows);
        }
      );

      if (collected.length) {
        if (minimal || dateOnly) {
          const stats = await minimalProcessFixturesForLeague(collected, leagueId);
          return res.json({ ok: true, leagueId, requested: { from, to }, totalFetched: stats.totalFetched, upsertedCount: stats.upsertedCount, match_ids: [] });
        }
        // process collected fixtures (same as per-date processing)
        for (const fx of collected) {
          try {
            // If caller asked to skip fixtures already present in DB, do a quick existence check by fixture id
            if (skipExisting) {
              try {
                const exists = await Match.exists({ match_id: Number(fx.id || fx.fixture_id) });
                if (exists) continue; // skip processing this fixture
              } catch (e) {}
            }
            try { await enrichFixtureRelated(fx); } catch (e) { console.warn('Enrichment failed for league fixture', fx?.id || fx?.fixture_id || '(unknown)', e?.message || e); }
            const doc = normaliseFixtureToMatchDoc(fx);
            if (!doc) continue;
            if (doc.home_team) doc.home_team_slug = doc.home_team_slug || toSlug(doc.home_team);
            if (doc.away_team) doc.away_team_slug = doc.away_team_slug || toSlug(doc.away_team);

            const existing = await Match.findOne({ match_id: doc.match_id }).lean();
            const setObj = { ...doc };
            if (Array.isArray(doc.comments) && doc.comments.length) {
              setObj.comments = mergeComments(existing && existing.comments ? existing.comments : [], doc.comments);
            } else if (existing && Array.isArray(existing.comments) && existing.comments.length) {
              delete setObj.comments;
            } else {
              setObj.comments = Array.isArray(doc.comments) ? doc.comments : [];
            }

            await Match.findOneAndUpdate(
              { match_id: doc.match_id },
              { $set: cleanForUpsert(setObj) },
              { upsert: true, new: true }
            ).lean();

            upsertedCount++;
            match_ids.push(doc.match_id);
          } catch (errUpsert) {
            console.error('Upsert failed for league fixture', fx?.id, errUpsert?.message || errUpsert);
          }
        }

        totalFetched = collected.length;
        return res.json({ ok: true, leagueId, requested: { from, to }, totalFetched, upsertedCount, match_ids });
      }
    } catch (e) {
      // If direct league paging fails (endpoint not supported / plan-limited), fall back to date-by-date
      console.warn('[syncLeagueWindow] direct /fixtures?filters[league_id] failed, falling back to date iteration', e?.response?.data || e?.message || e);
    }

    // We'll iterate each date in the window and fetch fixtures by date, filtering by league id.
    const fromDate = new Date(from + 'T00:00:00Z');
    const toDate = new Date(to + 'T00:00:00Z');
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) return res.status(400).json({ error: 'invalid from/to dates' });

    const dates = [];
    for (let d = new Date(fromDate); d <= toDate; d.setUTCDate(d.getUTCDate() + 1)) {
      dates.push(ymd(new Date(d)));
    }

    let totalFetched = 0;
    let upsertedCount = 0;
    const match_ids = [];

    for (const date of dates) {
      try {
        const { data } = await get(`/fixtures/date/${date}`, { include });
        const fixtures = Array.isArray(data?.data) ? data.data : [];
        const filtered = fixtures.filter(fx => Number(fx?.league_id ?? fx?.league?.id) === leagueId);
        totalFetched += filtered.length;
        // If caller requested minimal/dateOnly processing, only update start times
        if (minimal || dateOnly) {
          try {
            const stats = await minimalProcessFixturesForLeague(filtered, leagueId);
            upsertedCount += stats.upsertedCount || 0;
            // don't push match ids in minimal mode
            continue;
          } catch (e) {
            console.error('minimalProcessFixturesForLeague failed for date', date, e?.message || e);
          }
        }

        for (const fx of filtered) {
          try {
            if (skipExisting) {
              try {
                const exists = await Match.exists({ match_id: Number(fx.id || fx.fixture_id) });
                if (exists) continue;
              } catch (e) {}
            }
            try { await enrichFixtureRelated(fx); } catch (e) { console.warn('Enrichment failed for league fixture', fx?.id || fx?.fixture_id || '(unknown)', e?.message || e); }
            const doc = normaliseFixtureToMatchDoc(fx);
            if (!doc) continue;
            if (doc.home_team) doc.home_team_slug = doc.home_team_slug || toSlug(doc.home_team);
            if (doc.away_team) doc.away_team_slug = doc.away_team_slug || toSlug(doc.away_team);

            const existing = await Match.findOne({ match_id: doc.match_id }).lean();
            const setObj = { ...doc };
            if (Array.isArray(doc.comments) && doc.comments.length) {
              setObj.comments = mergeComments(existing && existing.comments ? existing.comments : [], doc.comments);
            } else if (existing && Array.isArray(existing.comments) && existing.comments.length) {
              delete setObj.comments;
            } else {
              setObj.comments = Array.isArray(doc.comments) ? doc.comments : [];
            }

            await Match.findOneAndUpdate(
              { match_id: doc.match_id },
              { $set: cleanForUpsert(setObj) },
              { upsert: true, new: true }
            ).lean();

            upsertedCount++;
            match_ids.push(doc.match_id);
          } catch (errUpsert) {
            console.error('Upsert failed for league fixture', fx?.id, errUpsert?.message || errUpsert);
          }
        }
      } catch (e) {
        console.error('Error fetching fixtures for date', date, e?.message || e);
      }
    }

    res.json({ ok: true, leagueId, requested: { from, to }, totalFetched, upsertedCount, match_ids });
  } catch (e) {
    const detail = e?.response?.data || e.message || e;
    console.error('syncLeagueWindow error:', detail);
    res.status(500).json({ error: 'league window sync failed', detail: typeof detail === 'string' ? detail : JSON.stringify(detail) });
  }
};

/**
 * POST /api/sync/catalog/all
 * Seed ALL teams available on your plan.
 * Modes:
 *  - "global": pages /teams until empty (fallback; recommended baseline)
 *  - "countries": tries /teams/countries/{id} (use filters=populate optionally)
 *  - "leagues": tries /teams/leagues/{id}
 *  - "both": tries countries then leagues
 * If the chosen mode fails (404), we fallback to "global".
 *
 * Body example to force the straightforward global pager:
 * { "mode": "global", "perPage": 25, "delayMs": 150, "maxPages": 1000 }
 */
exports.syncCatalogAll = async (req, res) => {
  try {
    const {
      mode = 'global',     // 'global' | 'countries' | 'leagues' | 'both'
      countryIds = [],     // optional, e.g. [462]
      leagueIds = [],      // optional
      perPage = 25,        // many endpoints ignore larger; global pager doesn't rely on it
      delayMs = 150,
      maxPages = 1000,
      usePopulate = false, // if true, adds filters=populate on country/league endpoints
    } = req.body || {};

    let totalSeen = 0;
    let totalUpserts = 0;
    const batches = [];

    // Helper to run one paged path and record stats
    const runPath = async (label, path, params = {}) => {
      let seen = 0;
      let upserts = 0;
      await pageThrough(
        path,
        { per_page: perPage, delayMs, maxPages, baseParams: params },
        async (rows) => {
          seen += rows.length;
          upserts += await upsertTeams(rows);
        }
      );
      batches.push({ mode: label, path, seen, upserts });
      totalSeen += seen;
      totalUpserts += upserts;
    };

    const tryCountries = async () => {
      const list = countryIds.length ? countryIds.map(Number).filter(Number.isFinite) : [462]; // England default
      for (const cid of list) {
        const params = {};
        if (usePopulate) params.filters = 'populate';
        await runPath(`country:${cid}`, `/teams/countries/${cid}`, params);
      }
    };

    const tryLeagues = async () => {
      const list =
        leagueIds.length ? leagueIds.map(Number).filter(Number.isFinite) : await fetchAllLeagueIds({});
      for (const lid of list) {
        const params = {};
        if (usePopulate) params.filters = 'populate';
        await runPath(`league:${lid}`, `/teams/leagues/${lid}`, params);
      }
    };

    let didPlannedMode = false;
    try {
      if (mode === 'countries') {
        await tryCountries();
        didPlannedMode = true;
      } else if (mode === 'leagues') {
        await tryLeagues();
        didPlannedMode = true;
      } else if (mode === 'both') {
        await tryCountries();
        await tryLeagues();
        didPlannedMode = true;
      }
    } catch (e) {
      console.warn('[catalog] planned mode failed, will fallback to global', e?.response?.data || e.message);
    }

    // Global fallback (or explicit mode): page /teams until empty
    if (mode === 'global' || !didPlannedMode) {
      await runPath('global', '/teams'); // <- should always exist on football v3
    }

    return res.json({
      ok: true,
      mode,
      perPage,
      delayMs,
      maxPages,
      total_seen: totalSeen,
      upserts: totalUpserts,
      batches,
    });
  } catch (e) {
    const detail = e?.response?.data || e.message || e;
    console.error('syncCatalogAll error:', detail);
    res.status(500).json({
      error: 'Catalog all sync failed',
      detail: typeof detail === 'string' ? detail : JSON.stringify(detail),
    });
  }
};

// Export enrichment helper for scripts that fetch fixtures directly
exports.enrichFixtureRelated = enrichFixtureRelated;
