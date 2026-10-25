// services/coverageCatalog.js
// Dynamic Sportmonks coverage catalogue (countries + leagues) and season membership sync.
// Read-only towards the provider; all writes go to the local DB catalogue.

const COVERAGE_CONFIG_ID = 'public-coverage';
const LAUNCH_LEAGUE_IDS = Object.freeze([8, 9, 12, 14, 17]);
const LAUNCH_COMPETITION_IDS = Object.freeze([24, 27]);
const LAUNCH_IDS = Object.freeze([...LAUNCH_LEAGUE_IDS, ...LAUNCH_COMPETITION_IDS]);
const ENGLAND_COUNTRY_ID = 462;
const ENGLAND_ANCHOR_LEAGUE_ID = 8;

const DEFAULT_OPTIONS = Object.freeze({
  perPage: 50,
  maxPages: 200,
  delayMs: 250,
  leagueDelayMs: 500,
  rateLimitThreshold: 5,
  maxRateLimitWaitMs: 60000
});

class CoverageCatalogError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CoverageCatalogError';
    this.code = code;
    if (details.stats) this.stats = details.stats;
    // Keep only sanitised provider details: raw axios errors carry the api_token in config.
    if (details.cause) {
      const c = details.cause;
      this.cause = c instanceof CoverageCatalogError ? c : {
        name: c?.name || 'Error',
        code: c?.code || null,
        status: c?.response?.status || null,
        message: c?.response?.data?.message || c?.message || String(c)
      };
    }
  }
}

const launchRoleFor = (id) => {
  if (LAUNCH_LEAGUE_IDS.includes(id)) return 'league';
  if (LAUNCH_COMPETITION_IDS.includes(id)) return 'competition';
  return null;
};

// Provider League.type is unreliable (cups are reported as "league"), so only explicit
// cup signals mark a competition; everything that is not clearly domestic stays a competition
// so it can never feed team-membership promotion without an admin override.
function inferCoverageRole(provider) {
  const explicit = launchRoleFor(Number(provider?.id));
  if (explicit) return explicit;
  if (provider?.is_cup === true) return 'competition';
  const subType = String(provider?.sub_type || '').toLowerCase();
  if (/cup|play-?off|friendl|super|international/.test(subType)) return 'competition';
  if (subType === 'domestic') return 'league';
  return 'competition';
}

// Baseline slug method (pre-teamSlug.js behaviour of models/Team.js).
const baselineSlugify = (str) =>
  String(str || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

const isNil = (v) => v === null || v === undefined;
const toNum = (v) => (isNil(v) || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const toDate = (v) => {
  if (isNil(v) || v === '') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const errorInfo = (err) => ({
  code: err?.code || null,
  status: err?.response?.status || null,
  message: err?.response?.data?.message || err?.message || String(err)
});

function compact(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out;
}

function createCoverageCatalogService(deps = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...(deps.options || {}) };
  const sleep = deps.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const now = deps.now || (() => new Date());
  const logger = deps.logger || console;

  let getFn = deps.get;
  let models = deps.models;
  const providerGet = (...args) => {
    if (!getFn) getFn = require('../utils/sportmonks').get;
    return getFn(...args);
  };
  const m = () => {
    if (!models) {
      models = {
        League: require('../models/League'),
        Country: require('../models/Country'),
        Team: require('../models/Team'),
        TeamMembership: require('../models/TeamMembership'),
        CoverageConfig: require('../models/CoverageConfig')
      };
    }
    return models;
  };

  let catalogRunning = false;
  let membershipRunning = false;

  async function respectRateLimit(body) {
    const rl = body?.rate_limit;
    const remaining = toNum(rl?.remaining);
    if (remaining === null || remaining > opts.rateLimitThreshold) return 0;
    const resetsMs = Math.max(0, (toNum(rl?.resets_in_seconds) || 1) * 1000);
    const waitMs = Math.min(resetsMs, opts.maxRateLimitWaitMs);
    if (waitMs > 0) await sleep(waitMs);
    return waitMs;
  }

  // Fetches every page of a Sportmonks v3 collection. Throws on any provider error,
  // malformed page, page mismatch or page-limit overflow: callers never get partial data.
  async function fetchAllPages(path, params = {}) {
    const items = [];
    const seen = new Set();
    let page = 1;
    let pages = 0;
    let rateLimitWaitMs = 0;
    while (true) {
      if (pages >= opts.maxPages) {
        throw new CoverageCatalogError('PAGINATION_LIMIT', `${path}: exceeded ${opts.maxPages} pages`);
      }
      let res;
      try {
        res = await providerGet(path, { ...params, page, per_page: opts.perPage });
      } catch (err) {
        throw new CoverageCatalogError('PROVIDER_ERROR', `${path} page ${page}: ${errorInfo(err).message}`, { cause: err });
      }
      pages += 1;
      const body = res?.data;
      if (!body || typeof body !== 'object') {
        throw new CoverageCatalogError('INVALID_RESPONSE', `${path} page ${page}: empty body`);
      }
      const pagination = body.pagination || body.meta?.pagination || null;
      if (isNil(body.data)) {
        // Sportmonks answers "No result(s) found" without data on empty collections.
        if (page === 1 && !pagination?.has_more) break;
        throw new CoverageCatalogError('INVALID_RESPONSE', `${path} page ${page}: missing data`);
      }
      if (!Array.isArray(body.data)) {
        throw new CoverageCatalogError('INVALID_RESPONSE', `${path} page ${page}: data is not an array`);
      }
      if (pagination && !isNil(pagination.current_page) && Number(pagination.current_page) !== page) {
        throw new CoverageCatalogError('PAGINATION_MISMATCH', `${path}: requested page ${page}, got ${pagination.current_page}`);
      }
      for (const item of body.data) {
        const id = toNum(item?.id);
        if (id === null || seen.has(id)) continue;
        seen.add(id);
        items.push(item);
      }
      rateLimitWaitMs += await respectRateLimit(body);
      if (pagination?.has_more === true) {
        page += 1;
        if (opts.delayMs) await sleep(opts.delayMs);
        continue;
      }
      break;
    }
    return { items, pages, rateLimitWaitMs };
  }

  async function getConfig() {
    const { CoverageConfig } = m();
    return CoverageConfig.findOne({ _id: COVERAGE_CONFIG_ID }).lean();
  }

  async function updateConfig(update) {
    const { CoverageConfig } = m();
    await CoverageConfig.updateOne({ _id: COVERAGE_CONFIG_ID }, update, { upsert: true });
  }

  function buildCountryDoc(c) {
    return compact({
      name: c.name || undefined,
      official_name: c.official_name ?? undefined,
      fifa_name: c.fifa_name ?? undefined,
      iso2: c.iso2 ?? undefined,
      iso3: c.iso3 ?? undefined,
      continent_id: toNum(c.continent_id) ?? undefined,
      continent_name: c.continent?.name ?? undefined,
      flag_path: c.image_path ?? undefined
    });
  }

  async function writeCountries(countryMap, checkedAt) {
    const { Country } = m();
    const ops = [];
    const stats = { fetched: countryMap.size, upserted: 0, modified: 0, skipped: 0 };
    for (const [id, c] of countryMap) {
      const doc = buildCountryDoc(c);
      if (!doc.name) { stats.skipped += 1; continue; }
      ops.push({ updateOne: {
        filter: { id },
        // `enabled` is an admin choice: only defaulted on insert, never overwritten.
        update: { $set: doc, $setOnInsert: { id, enabled: false } },
        upsert: true
      } });
    }
    if (ops.length) {
      const r = await Country.bulkWrite(ops, { ordered: false });
      stats.upserted = r?.upsertedCount || 0;
      stats.modified = r?.modifiedCount || 0;
    }
    stats.checked_at = checkedAt;
    return stats;
  }

  async function writeLeagues(providerLeagues, checkedAt) {
    const { League } = m();
    const ids = providerLeagues.map((l) => Number(l.id));
    const existing = await League.find({ id: { $in: ids } }).lean();
    const existingById = new Map(existing.map((l) => [Number(l.id), l]));
    const stats = { fetched: providerLeagues.length, inserted: 0, updated: 0, skipped: 0, roles_assigned: 0, skipped_ids: [] };
    const ops = [];
    for (const p of providerLeagues) {
      const id = Number(p.id);
      const prev = existingById.get(id);
      const countryId = toNum(p.country_id) ?? toNum(p.country?.id) ?? toNum(prev?.country_id);
      if (!p.name || countryId === null) {
        stats.skipped += 1;
        stats.skipped_ids.push(id);
        continue;
      }
      const set = compact({
        name: p.name,
        short_code: p.short_code ?? undefined,
        image_path: p.image_path ?? undefined,
        country_id: countryId,
        type: p.type ?? undefined,
        sub_type: p.sub_type ?? undefined,
        last_played_at: toDate(p.last_played_at) ?? undefined,
        category: toNum(p.category) ?? undefined,
        has_jerseys: typeof p.has_jerseys === 'boolean' ? p.has_jerseys : undefined,
        is_cup: typeof p.is_cup === 'boolean' ? p.is_cup : undefined,
        available: true,
        availability_status: p.active === false ? 'inactive' : 'available',
        last_seen_at: checkedAt,
        last_checked_at: checkedAt
      });
      if (Object.prototype.hasOwnProperty.call(p, 'currentseason')) {
        set.current_season_id = toNum(p.currentseason?.id);
      } else if (Object.prototype.hasOwnProperty.call(p, 'currentSeason')) {
        set.current_season_id = toNum(p.currentSeason?.id);
      }
      // Preserve any existing role (admin override); only fill when missing.
      if (!prev?.coverage_role) {
        set.coverage_role = inferCoverageRole(p);
        stats.roles_assigned += 1;
      }
      const setOnInsert = { id, enabled: false, reports_enabled: false, priority: 0 };
      ops.push({ updateOne: { filter: { id }, update: { $set: set, $setOnInsert: setOnInsert }, upsert: true } });
      if (prev) stats.updated += 1; else stats.inserted += 1;
    }
    if (ops.length) await League.bulkWrite(ops, { ordered: false });
    return stats;
  }

  async function bootstrapLaunch({ providerById, countryIds, checkedAt }) {
    const { League, Country } = m();
    const config = await getConfig();
    if (config?.launch_initialized) {
      return { requested: true, performed: false, reason: 'already_initialized', initialized_at: config.launch_initialized_at || null };
    }
    const missing = LAUNCH_IDS.filter((id) => !providerById.has(id));
    if (missing.length) {
      throw new CoverageCatalogError('LAUNCH_LEAGUES_UNAVAILABLE', `Launch leagues not accessible: ${missing.join(', ')}`);
    }
    const stored = await League.find({ id: { $in: LAUNCH_IDS } }).lean();
    const storedIds = new Set(stored.map((l) => Number(l.id)));
    const notStored = LAUNCH_IDS.filter((id) => !storedIds.has(id));
    if (notStored.length) {
      throw new CoverageCatalogError('LAUNCH_LEAGUES_NOT_STORED', `Launch leagues missing from catalogue: ${notStored.join(', ')}`);
    }
    const anchor = providerById.get(ENGLAND_ANCHOR_LEAGUE_ID);
    const englandId = toNum(anchor?.country_id) ?? toNum(anchor?.country?.id) ?? ENGLAND_COUNTRY_ID;
    if (!countryIds.has(englandId)) {
      throw new CoverageCatalogError('LAUNCH_COUNTRY_UNAVAILABLE', `England country ${englandId} not in provider catalogue`);
    }
    await League.bulkWrite(LAUNCH_IDS.map((id) => ({ updateOne: {
      filter: { id },
      // reports_start_at = initialisation time so no historical report backlog is auto-generated.
      update: { $set: { enabled: true, reports_enabled: true, reports_start_at: checkedAt, coverage_role: launchRoleFor(id) } }
    } })), { ordered: false });
    await Country.updateOne({ id: englandId }, { $set: { enabled: true } });
    // First explicit bootstrap establishes the exact launch scope, clearing legacy flags.
    const leaguesDisabled = await League.updateMany(
      { id: { $nin: [...LAUNCH_IDS] } },
      { $set: { enabled: false, reports_enabled: false } }
    );
    const countriesDisabled = await Country.updateMany(
      { id: { $ne: englandId } },
      { $set: { enabled: false } }
    );
    await updateConfig({
      $set: { launch_initialized: true, launch_initialized_at: checkedAt },
      $inc: { revision: 1 }
    });
    return {
      requested: true,
      performed: true,
      league_ids: [...LAUNCH_IDS],
      country_id: englandId,
      leagues_disabled: leaguesDisabled?.modifiedCount || 0,
      countries_disabled: countriesDisabled?.modifiedCount || 0
    };
  }

  /**
   * Refreshes the countries + leagues catalogue from Sportmonks.
   * Throws CoverageCatalogError on any provider/pagination failure before any DB write.
   */
  async function refreshCoverageCatalog({ bootstrapLaunch: doBootstrap = false } = {}) {
    if (catalogRunning) throw new CoverageCatalogError('ALREADY_RUNNING', 'Coverage catalogue refresh already running');
    catalogRunning = true;
    const startedAt = now();
    try {
      const leaguesRes = await fetchAllPages('/leagues', { include: 'country;currentseason' });
      if (!leaguesRes.items.length) {
        throw new CoverageCatalogError('EMPTY_CATALOGUE', 'Provider returned no leagues; refusing to update availability');
      }
      // Football API has no /countries endpoint (core API only): derive countries from the
      // included league.country objects. Every league must resolve to a country before writes.
      const countryMap = new Map();
      const unresolved = [];
      for (const l of leaguesRes.items) {
        const cid = toNum(l.country_id) ?? toNum(l.country?.id);
        const included = l.country && toNum(l.country.id) === cid && l.country.name ? l.country : null;
        if (cid === null || !included) {
          unresolved.push(Number(l.id));
          continue;
        }
        if (!countryMap.has(cid)) countryMap.set(cid, included);
      }
      if (unresolved.length) {
        throw new CoverageCatalogError(
          'UNRESOLVED_COUNTRY',
          `Leagues without a resolvable included country: ${unresolved.join(', ')}`
        );
      }
      const providerById = new Map(leaguesRes.items.map((l) => [Number(l.id), l]));

      const checkedAt = now();
      const countryStats = await writeCountries(countryMap, checkedAt);
      const leagueStats = await writeLeagues(leaguesRes.items, checkedAt);

      // Only reached after a fully successful read: flag leagues no longer accessible.
      const { League } = m();
      const seenIds = [...providerById.keys()];
      const revoked = await League.updateMany(
        { id: { $nin: seenIds } },
        { $set: { available: false, availability_status: 'unavailable', last_checked_at: checkedAt } }
      );
      leagueStats.marked_unavailable = revoked?.modifiedCount || 0;

      const stats = {
        ok: true,
        started_at: startedAt,
        finished_at: null,
        leagues: { ...leagueStats, pages: leaguesRes.pages },
        countries: { ...countryStats, source: 'league.country' },
        rate_limit_wait_ms: leaguesRes.rateLimitWaitMs,
        bootstrap: { requested: Boolean(doBootstrap), performed: false }
      };

      if (doBootstrap) {
        try {
          stats.bootstrap = await bootstrapLaunch({ providerById, countryIds: new Set(countryMap.keys()), checkedAt });
        } catch (err) {
          stats.ok = false;
          stats.bootstrap = { requested: true, performed: false, error: errorInfo(err) };
          await updateConfig({ $set: { last_catalog_refresh_at: checkedAt, last_catalog_stats: stats }, $inc: { revision: 1 } });
          throw new CoverageCatalogError(err.code || 'BOOTSTRAP_FAILED', err.message, { stats, cause: err });
        }
      }

      stats.finished_at = now();
      await updateConfig({ $set: { last_catalog_refresh_at: checkedAt, last_catalog_stats: stats }, $inc: { revision: 1 } });
      return stats;
    } catch (err) {
      if (err instanceof CoverageCatalogError) {
        if (!err.stats) err.stats = { ok: false, started_at: startedAt, error: errorInfo(err) };
        throw err;
      }
      throw new CoverageCatalogError('CATALOG_REFRESH_FAILED', errorInfo(err).message, {
        cause: err, stats: { ok: false, started_at: startedAt, error: errorInfo(err) }
      });
    } finally {
      catalogRunning = false;
    }
  }

  async function upsertTeams(providerTeams) {
    const { Team } = m();
    const ids = providerTeams.map((t) => Number(t.id));
    const existing = await Team.find({ id: { $in: ids } }).lean();
    const existingById = new Map(existing.map((t) => [Number(t.id), t]));
    const stats = { created: 0, filled: 0, unchanged: 0, skipped: 0 };
    const ops = [];
    const toCreate = [];

    for (const t of providerTeams) {
      const id = Number(t.id);
      const provider = compact({
        name: t.name || undefined,
        short_code: t.short_code ?? undefined,
        image_path: t.image_path ?? undefined,
        country_id: toNum(t.country_id) ?? undefined,
        venue_id: toNum(t.venue_id) ?? undefined,
        gender: t.gender ?? undefined,
        founded: toNum(t.founded) ?? undefined,
        type: t.type ?? undefined
      });
      const prev = existingById.get(id);
      if (prev) {
        // Provider metadata can change; editorial fields and stored slugs are untouched.
        const fill = {};
        for (const [k, v] of Object.entries(provider)) {
          if (v !== null && v !== undefined && v !== '' && prev[k] !== v) fill[k] = v;
        }
        const venue = require('../utils/venue').normalizeVenue(t.venue);
        if (venue) fill.venue = {
          ...(prev.venue || {}),
          ...Object.fromEntries(Object.entries(venue).filter(([, value]) => value !== null && value !== ''))
        };
        fill.profile_synced_at = now();
        if (Object.keys(fill).length) {
          ops.push({ updateOne: { filter: { id }, update: { $set: fill } } });
          stats.filled += 1;
        } else stats.unchanged += 1;
      } else if (provider.name) {
        const venue = require('../utils/venue').normalizeVenue(t.venue);
        toCreate.push({ id, provider: { ...provider, ...(venue ? { venue } : {}) } });
      } else {
        stats.skipped += 1;
      }
    }

    if (toCreate.length) {
      const bases = toCreate.map(({ id, provider }) => baselineSlugify(provider.name) || `team-${id}`);
      const taken = await Team.find({ slug: { $in: bases } }).lean();
      const takenSlugs = new Set(taken.map((t) => t.slug));
      toCreate.forEach(({ id, provider }, i) => {
        let slug = bases[i];
        if (takenSlugs.has(slug)) slug = `${slug}-${id}`;
        takenSlugs.add(slug);
        ops.push({ updateOne: {
          filter: { id },
          update: { $setOnInsert: {
            ...provider, id, slug, profile_synced_at: now()
          } },
          upsert: true
        } });
        stats.created += 1;
      });
    }
    if (ops.length) await Team.bulkWrite(ops, { ordered: false });
    return stats;
  }

  async function syncLeagueMembership(league, syncedAt) {
    const { TeamMembership, League } = m();
    const leagueId = Number(league.id);
    const seasonId = Number(league.current_season_id);
    const { items, pages, rateLimitWaitMs } = await fetchAllPages(`/teams/seasons/${seasonId}`, { include: 'venue' });
    if (!items.length) {
      throw new CoverageCatalogError('EMPTY_PARTICIPANTS', `Season ${seasonId} for league ${leagueId} returned no teams`);
    }
    const teamStats = await upsertTeams(items);
    const teamIds = items.map((t) => Number(t.id));
    await TeamMembership.bulkWrite(teamIds.map((teamId) => ({ updateOne: {
      filter: { team_id: teamId, league_id: leagueId, season_id: seasonId },
      update: {
        $set: { active: true, synced_at: syncedAt, source: 'sportmonks' },
        $setOnInsert: { first_seen_at: syncedAt }
      },
      upsert: true
    } })), { ordered: false });
    // Only after a complete participant list: retire departed teams and older seasons.
    const departed = await TeamMembership.updateMany(
      { league_id: leagueId, season_id: seasonId, active: true, team_id: { $nin: teamIds } },
      { $set: { active: false, synced_at: syncedAt } }
    );
    const oldSeasons = await TeamMembership.updateMany(
      { league_id: leagueId, season_id: { $ne: seasonId }, active: true },
      { $set: { active: false, synced_at: syncedAt } }
    );
    await League.updateOne(
      { id: leagueId },
      { $set: { membership_synced_at: syncedAt, membership_season_id: seasonId } }
    );
    return {
      league_id: leagueId,
      season_id: seasonId,
      teams: teamIds.length,
      pages,
      rate_limit_wait_ms: rateLimitWaitMs,
      deactivated: (departed?.modifiedCount || 0) + (oldSeasons?.modifiedCount || 0),
      team_upserts: teamStats
    };
  }

  /**
   * Syncs current-season participants for enabled domestic leagues (coverage_role 'league').
   * Never throws for per-league provider failures: returns ok=false with explicit errors and
   * leaves that league's memberships untouched. Initialises config only on a complete full sync.
   */
  async function syncSeasonMemberships({ leagueIds = null } = {}) {
    if (membershipRunning) throw new CoverageCatalogError('ALREADY_RUNNING', 'Membership sync already running');
    membershipRunning = true;
    const startedAt = now();
    try {
      const { League, Country } = m();
      const filter = { enabled: true, coverage_role: 'league' };
      if (Array.isArray(leagueIds) && leagueIds.length) filter.id = { $in: leagueIds.map(Number) };
      const candidates = await League.find(filter).lean();
      // Country gate: leagues in disabled countries are out of public scope, never fetched.
      const enabledCountries = await Country.find({ enabled: true }).lean();
      const enabledCountryIds = new Set(enabledCountries.map((c) => Number(c.id)));
      const leagues = [];
      const countrySkipped = [];
      for (const l of candidates) {
        if (enabledCountryIds.has(Number(l.country_id))) leagues.push(l);
        else countrySkipped.push({ league_id: Number(l.id), country_id: toNum(l.country_id), reason: 'country_disabled' });
      }
      const result = {
        ok: true, complete: false, started_at: startedAt, finished_at: null,
        leagues_considered: candidates.length, leagues_requested: leagues.length, leagues_synced: 0, leagues: [],
        skipped: countrySkipped, errors: [],
        config_initialized: false
      };
      let first = true;
      for (const league of leagues) {
        const leagueId = Number(league.id);
        if (league.available === false) {
          result.skipped.push({ league_id: leagueId, reason: 'unavailable' });
          continue;
        }
        if (isNil(league.current_season_id)) {
          result.errors.push({ league_id: leagueId, code: 'MISSING_CURRENT_SEASON', message: 'League has no current_season_id' });
          continue;
        }
        if (!first && opts.leagueDelayMs) await sleep(opts.leagueDelayMs);
        first = false;
        try {
          const syncedAt = now();
          result.leagues.push(await syncLeagueMembership(league, syncedAt));
          result.leagues_synced += 1;
        } catch (err) {
          result.errors.push({ league_id: leagueId, season_id: toNum(league.current_season_id), ...errorInfo(err) });
          logger.error?.(`[coverageCatalog] membership sync failed for league ${leagueId}: ${errorInfo(err).message}`);
        }
      }
      result.ok = result.errors.length === 0;
      const fullSync = !filter.id;
      result.complete = result.ok && fullSync && result.leagues_synced > 0;
      result.finished_at = now();

      const set = { last_membership_sync_at: result.finished_at, last_membership_stats: result };
      const update = { $set: set };
      if (result.complete) {
        const cfg = await getConfig();
        set.initialized = true;
        if (!cfg?.initialized) set.initialized_at = result.finished_at;
        result.config_initialized = true;
      }
      if (result.ok && result.leagues_synced > 0) update.$inc = { revision: 1 };
      await updateConfig(update);
      return result;
    } finally {
      membershipRunning = false;
    }
  }

  /**
   * Orchestrates catalogue refresh then membership sync. Throws on any failure.
   * An intentionally empty domestic scope (ok with zero leagues) is a valid success.
   */
  async function refreshCoverage(options = {}) {
    const catalogue = await refreshCoverageCatalog(options);
    let memberships;
    try {
      memberships = await syncSeasonMemberships();
    } catch (err) {
      const stats = { catalogue, memberships: err?.stats || null };
      if (err instanceof CoverageCatalogError) {
        err.stats = stats;
        throw err;
      }
      throw new CoverageCatalogError('MEMBERSHIP_SYNC_FAILED', errorInfo(err).message, { cause: err, stats });
    }
    if (!memberships.ok) {
      const ids = memberships.errors.map((e) => e.league_id).join(', ');
      throw new CoverageCatalogError(
        'MEMBERSHIP_SYNC_FAILED',
        `Membership sync failed for ${memberships.errors.length} league(s): ${ids}`,
        { stats: { catalogue, memberships } }
      );
    }
    return { ok: true, catalogue, memberships };
  }

  return { refreshCoverage, refreshCoverageCatalog, syncSeasonMemberships, getCoverageConfig: getConfig, fetchAllPages };
}

let defaultService = null;
const getDefault = () => (defaultService ||= createCoverageCatalogService());

module.exports = {
  createCoverageCatalogService,
  refreshCoverage: (...args) => getDefault().refreshCoverage(...args),
  refreshCoverageCatalog: (...args) => getDefault().refreshCoverageCatalog(...args),
  syncSeasonMemberships: (...args) => getDefault().syncSeasonMemberships(...args),
  getCoverageConfig: (...args) => getDefault().getCoverageConfig(...args),
  inferCoverageRole,
  baselineSlugify,
  CoverageCatalogError,
  COVERAGE_CONFIG_ID,
  LAUNCH_LEAGUE_IDS,
  LAUNCH_COMPETITION_IDS,
  ENGLAND_COUNTRY_ID
};
