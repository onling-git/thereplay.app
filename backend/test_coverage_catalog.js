const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  createCoverageCatalogService, inferCoverageRole, baselineSlugify, CoverageCatalogError
} = require('./services/coverageCatalog');

// ---- in-memory fake Mongo collections (no DB, no network) ----
function matches(doc, filter) {
  return Object.entries(filter).every(([k, cond]) => {
    const v = doc[k];
    if (cond && typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date)) {
      if ('$in' in cond && !cond.$in.includes(v)) return false;
      if ('$nin' in cond && cond.$nin.includes(v)) return false;
      if ('$ne' in cond && v === cond.$ne) return false;
      return true;
    }
    return v === cond;
  });
}
function applyUpdate(doc, update, inserting) {
  Object.assign(doc, update.$set || {});
  if (inserting) Object.assign(doc, update.$setOnInsert || {});
  for (const [k, n] of Object.entries(update.$inc || {})) doc[k] = (doc[k] || 0) + n;
  return doc;
}
function fakeModel(initial = []) {
  const rows = initial.map((r) => ({ ...r }));
  const updateOne = async (filter, update, options = {}) => {
    const row = rows.find((r) => matches(r, filter));
    if (row) { applyUpdate(row, update, false); return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0 }; }
    if (options.upsert) {
      rows.push(applyUpdate({ ...Object.fromEntries(Object.entries(filter).filter(([, v]) => typeof v !== 'object')) }, update, true));
      return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
    }
    return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
  };
  return {
    rows,
    writes: 0,
    find(filter) {
      const out = rows.filter((r) => matches(r, filter)).map((r) => ({ ...r }));
      return { lean: async () => out };
    },
    findOne(filter) {
      const row = rows.find((r) => matches(r, filter));
      return { lean: async () => (row ? { ...row } : null) };
    },
    async updateOne(filter, update, options) { this.writes += 1; return updateOne(filter, update, options); },
    async updateMany(filter, update) {
      this.writes += 1;
      const hit = rows.filter((r) => matches(r, filter));
      hit.forEach((r) => applyUpdate(r, update, false));
      return { modifiedCount: hit.length };
    },
    async bulkWrite(ops) {
      this.writes += 1;
      const res = { upsertedCount: 0, modifiedCount: 0 };
      for (const { updateOne: op } of ops) {
        const r = await updateOne(op.filter, op.update, { upsert: op.upsert });
        res.upsertedCount += r.upsertedCount; res.modifiedCount += r.modifiedCount;
      }
      return res;
    }
  };
}

const ENG = { id: 462, name: 'England', iso2: 'GB' };
const providerLeague = (id, extra = {}) => ({
  id, name: `League ${id}`, country_id: 462, type: 'league', sub_type: 'domestic',
  country: ENG, currentseason: { id: id * 1000 }, ...extra
});
const LAUNCH = [8, 9, 12, 14, 17, 24, 27];

// Fake provider: routes map path -> array of pages (each page = array) or Error.
function fakeGet(routes) {
  const calls = [];
  const get = async (path, params) => {
    calls.push({ path, params });
    const route = routes[path];
    if (route instanceof Error) throw route;
    if (typeof route === 'function') return route(params);
    const pages = route || [[]];
    const idx = params.page - 1;
    if (idx >= pages.length) throw new Error(`unexpected page ${params.page} for ${path}`);
    if (pages[idx] instanceof Error) throw pages[idx];
    return { data: {
      data: pages[idx],
      pagination: { current_page: params.page, has_more: idx < pages.length - 1, per_page: params.per_page }
    } };
  };
  return { get, calls };
}

function setup({ routes, leagues = [], countries = [], teams = [], memberships = [], config = [], options } = {}) {
  const models = {
    League: fakeModel(leagues), Country: fakeModel(countries), Team: fakeModel(teams),
    TeamMembership: fakeModel(memberships), CoverageConfig: fakeModel(config)
  };
  const provider = fakeGet(routes);
  const sleeps = [];
  const service = createCoverageCatalogService({
    get: provider.get, models, sleep: async (ms) => { sleeps.push(ms); },
    now: () => new Date('2026-10-21T10:00:00Z'), logger: { error() {} },
    options: { delayMs: 10, leagueDelayMs: 20, ...options }
  });
  return { service, models, provider, sleeps };
}

const catalogRoutes = (extraLeagues = [], { pages } = {}) => {
  const all = [...LAUNCH.map((id) => providerLeague(id, id >= 24 ? { sub_type: 'domestic' } : {})), ...extraLeagues];
  return {
    '/leagues': pages ? pages(all) : [all]
  };
};

test('inferCoverageRole uses explicit launch ids and cautious inference', () => {
  assert.equal(inferCoverageRole({ id: 24, type: 'league', sub_type: 'domestic' }), 'competition');
  assert.equal(inferCoverageRole({ id: 27, type: 'league' }), 'competition');
  assert.equal(inferCoverageRole({ id: 8, sub_type: 'cup' }), 'league');
  assert.equal(inferCoverageRole({ id: 501, sub_type: 'domestic' }), 'league');
  assert.equal(inferCoverageRole({ id: 600, sub_type: 'domestic', is_cup: true }), 'competition');
  assert.equal(inferCoverageRole({ id: 2, type: 'league', sub_type: 'cup_international' }), 'competition');
  assert.equal(inferCoverageRole({ id: 3, type: 'league' }), 'competition');
  assert.equal(baselineSlugify('  Brighton & Hove Albion '), 'brighton--hove-albion');
});

test('refresh discovers leagues disabled by default across pages and preserves admin state', async () => {
  const { service, models, provider, sleeps } = setup({
    routes: catalogRoutes([providerLeague(501, { country_id: 41, country: { id: 41, name: 'Europe' } })], {
      pages: (all) => [all.slice(0, 4), all.slice(4)]
    }),
    leagues: [{ id: 9, name: 'Old', country_id: 462, enabled: true, reports_enabled: false, coverage_role: 'competition', priority: 5 }],
    countries: [{ id: 462, name: 'England', enabled: true }]
  });
  const stats = await service.refreshCoverageCatalog();
  assert.equal(stats.ok, true);
  assert.equal(stats.leagues.pages, 2);
  assert.equal(stats.leagues.fetched, 8);
  assert.equal(stats.leagues.inserted, 7);
  assert.equal(stats.leagues.updated, 1);
  assert.deepEqual(provider.calls.filter((c) => c.path === '/leagues').map((c) => c.params.page), [1, 2]);
  assert.ok(sleeps.includes(10));

  const byId = Object.fromEntries(models.League.rows.map((l) => [l.id, l]));
  assert.equal(byId[501].enabled, false);
  assert.equal(byId[501].reports_enabled, false);
  assert.equal(byId[501].available, true);
  assert.equal(byId[501].current_season_id, 501000);
  assert.equal(byId[24].coverage_role, 'competition');
  assert.equal(byId[8].coverage_role, 'league');
  // admin choices preserved
  assert.equal(byId[9].enabled, true);
  assert.equal(byId[9].coverage_role, 'competition');
  assert.equal(byId[9].priority, 5);
  assert.equal(byId[9].name, 'League 9');
  const eng = models.Country.rows.find((c) => c.id === 462);
  assert.equal(eng.enabled, true);
  assert.equal(models.Country.rows.find((c) => c.id === 41).enabled, false);
  assert.equal(models.CoverageConfig.rows[0].revision, 1);
  assert.equal(models.CoverageConfig.rows[0].launch_initialized, undefined);
});

test('provider error throws and preserves existing catalogue (no writes, no revocation)', async () => {
  const err = Object.assign(new Error('forbidden'), { response: { status: 403, data: { message: 'plan' } } });
  const { service, models } = setup({
    routes: { '/leagues': [[providerLeague(8)], err] },
    leagues: [{ id: 99, name: 'Kept', country_id: 462, available: true, enabled: true }]
  });
  await assert.rejects(service.refreshCoverageCatalog(), (e) => {
    assert.ok(e instanceof CoverageCatalogError);
    assert.equal(e.code, 'PROVIDER_ERROR');
    assert.equal(e.stats.ok, false);
    return true;
  });
  assert.equal(models.League.writes, 0);
  assert.equal(models.Country.writes, 0);
  assert.equal(models.League.rows[0].available, true);
});

test('empty catalogue and pagination overflow are explicit errors', async () => {
  let s = setup({ routes: { '/leagues': [[]] } });
  await assert.rejects(s.service.refreshCoverageCatalog(), { code: 'EMPTY_CATALOGUE' });
  s = setup({
    routes: { '/leagues': [[providerLeague(8)], [providerLeague(9)], [providerLeague(12)]] },
    options: { maxPages: 2 }
  });
  await assert.rejects(s.service.refreshCoverageCatalog(), { code: 'PAGINATION_LIMIT' });
  assert.equal(s.models.League.writes, 0);
});

test('leagues missing after a complete read are flagged unavailable without touching enabled', async () => {
  const { service, models } = setup({
    routes: catalogRoutes(),
    leagues: [{ id: 777, name: 'Revoked', country_id: 462, enabled: true, available: true }]
  });
  const stats = await service.refreshCoverageCatalog();
  assert.equal(stats.leagues.marked_unavailable, 1);
  const revoked = models.League.rows.find((l) => l.id === 777);
  assert.equal(revoked.available, false);
  assert.equal(revoked.availability_status, 'unavailable');
  assert.equal(revoked.enabled, true);
});

const SPAIN = { id: 32, name: 'Spain' };

test('bootstrapLaunch enables exactly launch leagues + England once and clears legacy flags', async () => {
  const { service, models } = setup({
    routes: catalogRoutes([providerLeague(501), providerLeague(564, { country_id: 32, country: SPAIN })]),
    leagues: [
      { id: 24, name: 'FA', country_id: 462, coverage_role: 'league' },
      { id: 564, name: 'La Liga', country_id: 32, enabled: true, reports_enabled: true, coverage_role: 'league' }
    ],
    countries: [{ id: 32, name: 'Spain', enabled: true }]
  });
  const stats = await service.refreshCoverageCatalog({ bootstrapLaunch: true });
  assert.equal(stats.bootstrap.performed, true);
  const byId = Object.fromEntries(models.League.rows.map((l) => [l.id, l]));
  for (const id of LAUNCH) {
    assert.equal(byId[id].enabled, true);
    assert.equal(byId[id].reports_enabled, true);
    assert.deepEqual(byId[id].reports_start_at, new Date('2026-10-21T10:00:00Z'));
  }
  assert.equal(byId[501].reports_start_at, undefined);
  assert.equal(byId[24].coverage_role, 'competition');
  assert.equal(byId[501].enabled, false);
  assert.equal(models.Country.rows.find((c) => c.id === 462).enabled, true);
  assert.equal(byId[564].enabled, false);
  assert.equal(byId[564].reports_enabled, false);
  assert.equal(byId[564].coverage_role, 'league');
  assert.equal(models.Country.rows.find((c) => c.id === 32).enabled, false);
  assert.equal(stats.bootstrap.leagues_disabled >= 1, true);
  assert.equal(stats.bootstrap.countries_disabled >= 1, true);
  assert.equal(models.CoverageConfig.rows[0].launch_initialized, true);
  assert.notEqual(models.CoverageConfig.rows[0].initialized, true);

  // Admin disables PL and re-enables La Liga/Spain; later refreshes must preserve them.
  models.League.rows.find((l) => l.id === 8).enabled = false;
  models.League.rows.find((l) => l.id === 564).enabled = true;
  models.Country.rows.find((c) => c.id === 32).enabled = true;
  const again = await service.refreshCoverageCatalog({ bootstrapLaunch: true });
  assert.equal(again.bootstrap.performed, false);
  assert.equal(again.bootstrap.reason, 'already_initialized');
  await service.refreshCoverageCatalog();
  assert.equal(models.League.rows.find((l) => l.id === 8).enabled, false);
  assert.equal(models.League.rows.find((l) => l.id === 564).enabled, true);
  assert.equal(models.Country.rows.find((c) => c.id === 32).enabled, true);
});

test('bootstrap fails explicitly when a launch league is not accessible', async () => {
  const leagues = LAUNCH.filter((id) => id !== 27).map((id) => providerLeague(id));
  const { service, models } = setup({ routes: { '/leagues': [leagues] } });
  await assert.rejects(service.refreshCoverageCatalog({ bootstrapLaunch: true }), (e) => {
    assert.equal(e.code, 'LAUNCH_LEAGUES_UNAVAILABLE');
    assert.equal(e.stats.bootstrap.performed, false);
    return true;
  });
  assert.ok(models.League.rows.every((l) => !l.enabled));
  assert.notEqual(models.CoverageConfig.rows[0].launch_initialized, true);
});

const team = (id, name, extra = {}) => ({ id, name, short_code: name.slice(0, 3).toUpperCase(), country_id: 462, image_path: `img/${id}`, ...extra });

test('membership sync paginates, upserts teams safely and initialises config', async () => {
  const { service, models, provider } = setup({
    countries: [{ id: 462, name: 'England', enabled: true }],
        routes: {
      '/teams/seasons/8000': [[team(1, 'Arsenal'), team(2, 'Chelsea FC')], [team(3, 'Brighton & Hove'), team(4, 'Arsenal')]]
    },
    leagues: [
      { id: 8, country_id: 462, enabled: true, coverage_role: 'league', available: true, current_season_id: 8000 },
      { id: 24, country_id: 462, enabled: true, coverage_role: 'competition', available: true, current_season_id: 24000 },
      { id: 501, country_id: 462, enabled: false, coverage_role: 'league', current_season_id: 1 }
    ],
    teams: [{ id: 1, name: 'Arsenal', slug: 'arsenal', image_path: 'keep.png', short_code: null }],
    memberships: [
      { team_id: 9, league_id: 8, season_id: 8000, active: true },
      { team_id: 1, league_id: 8, season_id: 7000, active: true },
      { team_id: 1, league_id: 24, season_id: 24000, active: true }
    ]
  });
  const result = await service.syncSeasonMemberships();
  assert.equal(result.ok, true);
  assert.equal(result.complete, true);
  assert.equal(result.leagues_synced, 1);
  assert.equal(result.leagues[0].teams, 4);
  assert.equal(result.leagues[0].pages, 2);
  assert.ok(provider.calls.every((c) => c.path === '/teams/seasons/8000'));

  const t = Object.fromEntries(models.Team.rows.map((x) => [x.id, x]));
  assert.equal(t[1].slug, 'arsenal');
  assert.equal(t[1].image_path, 'img/1');
  assert.deepEqual(t[1].profile_synced_at, new Date('2026-10-21T10:00:00Z'));
  assert.equal(t[1].short_code, 'ARS');
  assert.equal(t[2].slug, 'chelsea-fc');
  assert.equal(t[3].slug, 'brighton--hove');
  assert.equal(t[4].slug, 'arsenal-4');

  const ms = models.TeamMembership.rows;
  const active = ms.filter((r) => r.league_id === 8 && r.active).map((r) => r.team_id).sort();
  assert.deepEqual(active, [1, 2, 3, 4]);
  assert.equal(ms.find((r) => r.team_id === 9).active, false);
  assert.equal(ms.find((r) => r.season_id === 7000).active, false);
  assert.equal(ms.find((r) => r.league_id === 24).active, true);
  const pl = models.League.rows.find((l) => l.id === 8);
  assert.deepEqual(pl.membership_synced_at, new Date('2026-10-21T10:00:00Z'));
  assert.equal(pl.membership_season_id, 8000);
  assert.equal(models.League.rows.find((l) => l.id === 24).membership_synced_at, undefined);
  const cfg = models.CoverageConfig.rows[0];
  assert.equal(cfg.initialized, true);
  assert.equal(cfg.revision, 1);
});

test('membership provider failure keeps existing memberships and does not initialise', async () => {
  const { service, models, sleeps } = setup({
    countries: [{ id: 462, name: 'England', enabled: true }],
        routes: {
      '/teams/seasons/8000': [[team(1, 'Arsenal')], new Error('timeout')],
      '/teams/seasons/9000': [[team(5, 'Leeds')]],
      '/teams/seasons/12000': [[]]
    },
    leagues: [
      { id: 8, country_id: 462, enabled: true, coverage_role: 'league', current_season_id: 8000 },
      { id: 9, country_id: 462, enabled: true, coverage_role: 'league', current_season_id: 9000 },
      { id: 12, country_id: 462, enabled: true, coverage_role: 'league', current_season_id: 12000 },
      { id: 14, country_id: 462, enabled: true, coverage_role: 'league', current_season_id: null },
      { id: 17, country_id: 462, enabled: true, coverage_role: 'league', available: false, current_season_id: 17000 }
    ],
    memberships: [{ team_id: 9, league_id: 8, season_id: 8000, active: true }]
  });
  const result = await service.syncSeasonMemberships();
  assert.equal(result.ok, false);
  assert.equal(result.complete, false);
  assert.equal(result.leagues_synced, 1);
  assert.deepEqual(result.errors.map((e) => [e.league_id, e.code]), [
    [8, 'PROVIDER_ERROR'], [12, 'EMPTY_PARTICIPANTS'], [14, 'MISSING_CURRENT_SEASON']
  ]);
  assert.deepEqual(result.skipped, [{ league_id: 17, reason: 'unavailable' }]);
  assert.ok(sleeps.includes(20));
  const m = models.TeamMembership.rows;
  assert.equal(m.find((r) => r.team_id === 9).active, true);
  assert.equal(m.some((r) => r.team_id === 1), false);
  assert.equal(m.find((r) => r.team_id === 5).active, true);
  assert.equal(models.League.rows.find((l) => l.id === 8).membership_synced_at, undefined);
  assert.ok(models.League.rows.find((l) => l.id === 9).membership_synced_at instanceof Date);
  const cfg = models.CoverageConfig.rows[0];
  assert.notEqual(cfg.initialized, true);
  assert.equal(cfg.revision, undefined);
});

test('low rate-limit budget triggers a bounded wait', async () => {
  const { service, sleeps } = setup({
    routes: {
      '/leagues': () => ({ data: { data: LAUNCH.map((id) => providerLeague(id)), rate_limit: { remaining: 1, resets_in_seconds: 3600 } } })
    },
    options: { maxRateLimitWaitMs: 5000 }
  });
  const stats = await service.refreshCoverageCatalog();
  assert.ok(sleeps.includes(5000));
  assert.equal(stats.rate_limit_wait_ms, 5000);
});

test('unpaginated season teams endpoint (no pagination property) is accepted as complete', async () => {
  const teams = Array.from({ length: 24 }, (_, i) => team(100 + i, `Club ${i}`));
  const { service, models, provider } = setup({
    countries: [{ id: 462, name: 'England', enabled: true }],
        routes: { '/teams/seasons/27946': () => ({ data: { data: teams } }) },
    leagues: [{ id: 17, country_id: 462, enabled: true, coverage_role: 'league', available: true, current_season_id: 27946 }]
  });
  const result = await service.syncSeasonMemberships();
  assert.equal(result.ok, true);
  assert.equal(result.complete, true);
  assert.equal(result.leagues[0].teams, 24);
  assert.equal(result.leagues[0].pages, 1);
  assert.equal(provider.calls.length, 1);
  assert.equal(models.TeamMembership.rows.filter((r) => r.active && r.season_id === 27946).length, 24);
});

test('provider-shaped domestic league without is_cup infers league role', () => {
  assert.equal(inferCoverageRole({ id: 384, type: 'league', sub_type: 'domestic' }), 'league');
});

test('countries are derived from included league.country without a /countries call', async () => {
  const { service, models, provider } = setup({
    routes: catalogRoutes([providerLeague(564, { country_id: 32, country: SPAIN })])
  });
  const stats = await service.refreshCoverageCatalog();
  assert.equal(stats.countries.source, 'league.country');
  assert.equal(stats.countries.fetched, 2);
  assert.ok(provider.calls.every((c) => c.path === '/leagues'));
  assert.equal(provider.calls[0].params.include, 'country;currentseason');
  assert.deepEqual(models.Country.rows.map((c) => c.id).sort(), [32, 462]);
  assert.ok(models.Country.rows.every((c) => c.enabled === false));
});

test('league without resolvable included country aborts before any write', async () => {
  const { service, models } = setup({
    routes: catalogRoutes([providerLeague(700, { country_id: 99, country: undefined })]),
    leagues: [{ id: 777, name: 'Kept', country_id: 462, available: true }]
  });
  await assert.rejects(service.refreshCoverageCatalog(), (e) => {
    assert.equal(e.code, 'UNRESOLVED_COUNTRY');
    assert.match(e.message, /700/);
    return true;
  });
  assert.equal(models.League.writes, 0);
  assert.equal(models.Country.writes, 0);
  assert.equal(models.League.rows[0].available, true);
});

const domestic = (id, season) => ({ id, name: `L${id}`, country_id: 462, enabled: true, coverage_role: 'league', available: true, current_season_id: season });

test('refreshCoverage runs catalogue then memberships and returns both', async () => {
  const { service, models } = setup({
    countries: [{ id: 462, name: 'England', enabled: true }],
        routes: { ...catalogRoutes(), '/teams/seasons/8000': [[team(1, 'Arsenal')]] },
    leagues: [domestic(8, 8000)]
  });
  // Only PL enabled; refresh preserves enabled and updates current_season_id from provider.
  const result = await service.refreshCoverage();
  assert.equal(result.ok, true);
  assert.equal(result.catalogue.ok, true);
  assert.equal(result.memberships.ok, true);
  assert.equal(result.memberships.complete, true);
  assert.equal(models.CoverageConfig.rows[0].initialized, true);
});

test('refreshCoverage throws MEMBERSHIP_SYNC_FAILED with both stats when a league fails', async () => {
  const { service, models } = setup({
    countries: [{ id: 462, name: 'England', enabled: true }],
        routes: { ...catalogRoutes(), '/teams/seasons/8000': new Error('boom') },
    leagues: [domestic(8, 8000)]
  });
  await assert.rejects(service.refreshCoverage(), (e) => {
    assert.ok(e instanceof CoverageCatalogError);
    assert.equal(e.code, 'MEMBERSHIP_SYNC_FAILED');
    assert.equal(e.stats.catalogue.ok, true);
    assert.equal(e.stats.memberships.ok, false);
    assert.equal(e.stats.memberships.errors[0].league_id, 8);
    return true;
  });
  assert.notEqual(models.CoverageConfig.rows[0].initialized, true);
});

test('refreshCoverage propagates catalogue failure without running memberships', async () => {
  const { service, provider } = setup({ countries: [{ id: 462, name: 'England', enabled: true }], routes: { '/leagues': new Error('down') }, leagues: [domestic(8, 8000)] });
  await assert.rejects(service.refreshCoverage(), { code: 'PROVIDER_ERROR' });
  assert.ok(provider.calls.every((c) => c.path === '/leagues'));
});

test('refreshCoverage accepts an intentionally empty domestic scope', async () => {
  const { service } = setup({
    countries: [{ id: 462, name: 'England', enabled: true }],
        routes: catalogRoutes(),
    config: [{ _id: 'public-coverage', initialized: true, revision: 3 }]
  });
  const result = await service.refreshCoverage();
  assert.equal(result.ok, true);
  assert.equal(result.memberships.leagues_requested, 0);
  assert.equal(result.memberships.complete, false);
});

test('thrown errors never expose provider credentials', async () => {
  const err = Object.assign(new Error('Request failed'), {
    config: { params: { api_token: 'SECRET_TOKEN' } }, response: { status: 404, data: { message: 'not found' } }
  });
  const { service } = setup({ routes: { '/leagues': err } });
  await assert.rejects(service.refreshCoverageCatalog(), (e) => {
    assert.doesNotMatch(JSON.stringify({ e, cause: e.cause, stats: e.stats, msg: e.message }), /SECRET_TOKEN/);
    assert.equal(e.cause.status, 404);
    return true;
  });
});

test('membership sync skips leagues whose country is disabled without fetching', async () => {
  const { service, provider, models } = setup({
    routes: { '/teams/seasons/8000': [[team(1, 'Arsenal')]] },
    countries: [{ id: 462, name: 'England', enabled: true }, { id: 32, name: 'Spain', enabled: false }],
    leagues: [domestic(8, 8000), { ...domestic(564, 56400), country_id: 32 }],
    memberships: [{ team_id: 50, league_id: 564, season_id: 56400, active: true }]
  });
  const result = await service.syncSeasonMemberships();
  assert.equal(result.ok, true);
  assert.equal(result.complete, true);
  assert.equal(result.leagues_considered, 2);
  assert.equal(result.leagues_requested, 1);
  assert.deepEqual(result.skipped, [{ league_id: 564, country_id: 32, reason: 'country_disabled' }]);
  assert.ok(provider.calls.every((c) => c.path === '/teams/seasons/8000'));
  assert.equal(models.League.rows.find((l) => l.id === 564).membership_synced_at, undefined);
  assert.equal(models.TeamMembership.rows.find((r) => r.team_id === 50).active, true);
});
