const test = require('node:test');
const assert = require('node:assert/strict');
const {
  enrichUpcomingFixtures, mergeFixtureMetadata, FIXTURE_INCLUDE,
} = require('./services/fixtureEnrichment');
const { normaliseFixtureToMatchDoc } = require('./utils/normaliseFixture');

const NOW = new Date('2026-10-21T08:00:00Z');
const KICKOFF = new Date('2026-10-23T14:00:00Z');
const coverage = { teamIds: [78], competitionIds: [8] };
const policyFilter = { $and: [
  { 'match_info.league.id': { $in: [8] } },
  { $or: [
    { 'teams.home.team_id': { $in: [78, '78'] } },
    { 'teams.away.team_id': { $in: [78, '78'] } },
  ] },
] };

function stored(id = 101, overrides = {}) {
  return {
    match_id: id, date: KICKOFF,
    match_info: {
      starting_at: KICKOFF, league: { id: 8, name: 'Premier League' },
      venue: { id: 1, name: 'Amex', city_name: 'Brighton' },
      round: { id: 10, name: '10' }, season: { id: 100, name: '2026/2027', is_current: true },
    },
    teams: {
      home: { team_id: 78, team_name: 'Brighton', team_slug: 'custom-brighton', logo: 'home.png' },
      away: { team_id: 14, team_name: 'Opponent', team_slug: 'custom-opponent', logo: 'away.png' },
    },
    score: { home: 2, away: 1 },
    status: 'live', match_status: { id: 2, state: 'LIVE', name: 'Live' },
    report: 'Never change this', statistics: { home: [1] }, ...overrides,
  };
}

function fixture(id = 101, overrides = {}) {
  return {
    id, starting_at_timestamp: KICKOFF.getTime() / 1000,
    participants: [
      { id: 78, name: 'Brighton & Hove Albion', image_path: 'new-home.png', meta: { location: 'home' } },
      { id: 14, name: 'Opponent', image_path: 'away.png', meta: { location: 'away' } },
    ],
    venue: { id: 1, name: 'Amex', city_name: 'Brighton' },
    league: { id: 8, name: 'Premier League' },
    season: { id: 100, name: '2026/2027' }, round: { id: 10, name: '10' },
    state: { id: 1, name: 'Not Started', short_name: 'NS', developer_name: 'NS' },
    ...overrides,
  };
}

function get(object, path) {
  return path.split('.').reduce((value, key) => value?.[key], object);
}

function matches(document, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === '$and') return expected.every(part => matches(document, part));
    if (key === '$or') return expected.some(part => matches(document, part));
    const actual = get(document, key);
    if (expected === null) return actual == null;
    if (!expected || typeof expected !== 'object' || expected instanceof Date) return actual === expected;
    return Object.entries(expected).every(([operator, value]) => {
      if (operator === '$in') return value.some(item => item === actual || (item === null && actual == null));
      if (operator === '$gte') return actual != null && actual >= value;
      if (operator === '$lte') return actual != null && actual <= value;
      throw new Error(`Unexpected test operator ${operator}`);
    });
  });
}

function setPath(document, path, value) {
  const keys = path.split('.');
  const key = keys.pop();
  let parent = document;
  for (const part of keys) {
    if (parent[part] !== undefined && (parent[part] === null || typeof parent[part] !== 'object')) {
      throw new Error(`Cannot create nested field in ${part}`);
    }
    parent = parent[part] ||= {};
  }
  parent[key] = value;
}

function harness(records = [stored()], fixtures = [fixture()]) {
  const writes = [];
  const teamWrites = [];
  const requests = [];
  const teams = [
    { id: 78, name: 'Brighton', slug: 'canonical-brighton' },
    { id: 14, name: 'Opponent', slug: 'canonical-opponent' },
  ];
  let active = 0;
  let peak = 0;
  const Match = {
    find(filter) {
      let result = records.filter(record => matches(record, filter));
      return {
        sort() { return this; },
        limit(limit) { result = result.slice(0, limit); return this; },
        async lean() { return structuredClone(result); },
      };
    },
    findOne(filter) {
      return { lean: async () => structuredClone(records.find(record => matches(record, filter)) || null) };
    },
    async updateOne(filter, update, options) {
      writes.push({ filter, update, options });
      let document = records.find(record => matches(record, filter));
      if (!document) { document = { ...filter }; records.push(document); }
      for (const [path, value] of Object.entries(update.$set)) setPath(document, path, value);
      return { acknowledged: true };
    },
  };
  const Team = {
    findOne(filter) { return { lean: async () => structuredClone(teams.find(team => team.id === filter.id) || null) }; },
    async updateOne(filter, update, options) {
      teamWrites.push({ filter, update, options });
      let team = teams.find(team => team.id === filter.id);
      if (!team) { team = { ...update.$setOnInsert }; teams.push(team); }
      Object.assign(team, update.$set);
      return { acknowledged: true };
    },
  };
  const options = {
    Match, Team, now: NOW,
    coveragePolicy: {
      publicMatchFilter: async () => policyFilter,
      getCoverage: async () => coverage,
    },
    sportmonks: {
      async get(path, params) {
        requests.push({ path, params });
        active++;
        peak = Math.max(peak, active);
        await new Promise(resolve => setTimeout(resolve, 2));
        active--;
        return { data: { data: structuredClone(fixtures.find(row => path === `/fixtures/${row.id}`)) } };
      },
    },
  };
  return { options, records, writes, teamWrites, requests, teams, peak: () => peak };
}

test('merge is allowlisted, non-mutating and keeps null/blank omissions, zero and false', () => {
  const existing = stored();
  const patch = mergeFixtureMetadata(existing, {
    _id: 'bad', __v: 42, report: 'bad', events: [], sources: { bad: true },
    match_info: { venue: { name: '', city_name: null, capacity: 0 }, season: { is_current: false } },
    match_status: { state: null }, score: { home: 0, away: null },
    teams: { away: { team_name: null, logo: '', team_slug: 'changed' } },
  });
  assert.equal(patch.match_info.venue.name, 'Amex');
  assert.equal(patch.match_info.venue.city_name, 'Brighton');
  assert.equal(patch.match_info.venue.capacity, 0);
  assert.equal(patch.match_info.season.is_current, false);
  assert.deepEqual(patch.score, { home: 0, away: 1 });
  assert.equal(patch.match_status.state, 'LIVE');
  assert.equal(patch.teams.away.team_slug, 'custom-opponent');
  for (const field of ['_id', '__v', 'report', 'events', 'statistics', 'sources']) {
    assert.equal(Object.hasOwn(patch, field), false);
  }
  assert.equal(existing.score.home, 2);
  assert.equal(existing.match_info.season.is_current, true);
});

test('scheduler merge recognizes full normalizer display defaults without changing normalizer behavior', () => {
  const normalized = normaliseFixtureToMatchDoc({
    id: 101, starting_at_timestamp: KICKOFF.getTime() / 1000, season: { id: 100, name: '2026/2027' },
  });
  assert.equal(normalized.score.home, 0);
  assert.equal(normalized.home_team, 'Home');
  const patch = mergeFixtureMetadata(stored(), normalized);
  assert.deepEqual(patch.score, { home: 2, away: 1 });
  assert.equal(patch.status, 'live');
  assert.equal(patch.teams.home.team_name, 'Brighton');
  assert.equal(patch.match_info.season.is_current, true);
  assert.equal(JSON.stringify(normalized).includes('fixtureMetadataSource'), false);
  assert.equal(normalized.home_team, 'Home');
});

test('merging ID-only provider state does not invent not_started status', () => {
  const normalized = normaliseFixtureToMatchDoc(fixture(101, { state: { id: 1 } }));
  const patch = mergeFixtureMetadata(stored(), normalized);
  assert.equal(patch.status, 'live');
  assert.equal(patch.match_status.state, 'LIVE');
  assert.equal(patch.match_status.id, 1);
});

test('enriches sparse fixture even with unchanged kickoff; preserves rich omissions and report', async () => {
  const h = harness();
  const stats = await enrichUpcomingFixtures(h.options);
  assert.equal(stats.ok, true);
  assert.equal(stats.updated, 1);
  assert.equal(h.records[0].match_info.starting_at.getTime(), KICKOFF.getTime());
  assert.equal(h.records[0].match_info.season.is_current, true);
  assert.deepEqual(h.records[0].score, { home: 2, away: 1 });
  assert.equal(h.records[0].report, 'Never change this');
  assert.equal(h.records[0].teams.home.team_slug, 'custom-brighton');
  assert.equal(h.teams[0].slug, 'canonical-brighton');
  assert.equal(h.records[0].sources.sportmonks.metadata_fetched_at.getTime(), NOW.getTime());
  assert.deepEqual(h.requests[0], { path: '/fixtures/101', params: { include: FIXTURE_INCLUDE } });
  assert.equal(FIXTURE_INCLUDE.includes('events'), false);
  assert.equal(Object.keys(h.writes[0].update.$set).some(key => /report|events|lineup|statistics/.test(key)), false);
});

test('complete fresh fixtures are skipped, incomplete fresh and stale fixtures are selected', async () => {
  const fresh = { sportmonks: { metadata_fetched_at: NOW } };
  const stale = { sportmonks: { metadata_fetched_at: new Date(NOW.getTime() - 2 * 86400000) } };
  const complete = stored(101, { sources: fresh });
  const incomplete = stored(102, { sources: fresh });
  incomplete.match_info.venue.city_name = '';
  const old = stored(103, { sources: stale });
  const outside = stored(104, { date: new Date('2026-12-01'), match_info: { starting_at: new Date('2026-12-01'), league: { id: 8 } } });
  const unsupported = stored(105);
  unsupported.match_info.league.id = 99;
  const h = harness([complete, incomplete, old, outside, unsupported], [fixture(102), fixture(103)]);
  const stats = await enrichUpcomingFixtures({ ...h.options, dryRun: true });
  assert.equal(stats.ok, true);
  assert.deepEqual(h.requests.map(request => request.path), ['/fixtures/102', '/fixtures/103']);
  assert.equal(h.writes.length, 0);
  assert.equal(h.teamWrites.length, 0);
});

test('real zero scores and false season flag overwrite nonzero/true metadata', async () => {
  const h = harness([stored()], [fixture(101, {
    season: { id: 100, name: '2026/2027', is_current: false },
    scores: { data: [
      { description: 'CURRENT', score: { participant: 'home', goals: 0 } },
      { description: 'CURRENT', score: { participant: 'away', goals: 0 } },
    ] },
  })]);
  const stats = await enrichUpcomingFixtures(h.options);
  assert.equal(stats.ok, true);
  assert.deepEqual(h.records[0].score, { home: 0, away: 0 });
  assert.equal(h.records[0].match_info.season.is_current, false);
});

test('partial score updates only supplied side; participant ID resolves missing role', async () => {
  const h = harness([stored()], [fixture(101, {
    scores: [{ participant_id: 78, description: 'CURRENT', score: { goals: 0 } }],
  })]);
  assert.equal((await enrichUpcomingFixtures(h.options)).ok, true);
  assert.deepEqual(h.records[0].score, { home: 0, away: 1 });
});

test('wrapped paired scores and wrapped state are handled without synthetic score defaults', async () => {
  const h = harness([stored()], [fixture(101, {
    state: { data: { id: 1, developer_name: 'NS', name: 'Not Started' } },
    scores: { data: [{ description: 'CURRENT', localteam_score: 0 }] },
  })]);
  assert.equal((await enrichUpcomingFixtures(h.options)).ok, true);
  assert.equal(h.records[0].match_status.state, 'NS');
  assert.deepEqual(h.records[0].score, { home: 0, away: 1 });
});

test('explicit IDs fetch missing fixtures but never insert unsupported matches', async () => {
  const h = harness([], [fixture(101), fixture(102, { league: { id: 99, name: 'Other' } })]);
  const stats = await enrichUpcomingFixtures({ ...h.options, matchIds: [101, 102, 101] });
  assert.equal(stats.ok, true);
  assert.equal(stats.selected, 2);
  assert.equal(stats.inserted, 1);
  assert.equal(stats.skipped, 1);
  assert.equal(h.records.length, 1);
  assert.equal(h.records[0].teams.home.team_slug, 'canonical-brighton');
});

test('known sparse IDs can recover missing league metadata without losing existing scores/report', async () => {
  const document = stored();
  document.match_info.league = { name: '' };
  const h = harness([document]);
  const stats = await enrichUpcomingFixtures({ ...h.options, matchIds: [101] });
  assert.equal(stats.updated, 1);
  assert.equal(h.records[0].match_info.league.id, 8);
  assert.deepEqual(h.records[0].score, { home: 2, away: 1 });
  assert.equal(h.records[0].report, 'Never change this');
});

test('default selection repairs supported-team orphan fixtures with no competition identity', async () => {
  const document = stored();
  document.match_info.league = null;
  const h = harness([document], [fixture(101, { league: undefined, league_id: 8 })]);
  const stats = await enrichUpcomingFixtures(h.options);
  assert.equal(stats.ok, true);
  assert.equal(stats.selected, 1);
  assert.equal(stats.updated, 1);
  assert.equal(h.records[0].match_info.league.id, 8);
  assert.equal(h.records[0].match_info.venue.city_name, 'Brighton');
});

test('null venue and source containers can be safely replaced without invalid dotted updates', async () => {
  const document = stored();
  document.match_info.venue = null;
  document.sources = null;
  const h = harness([document]);
  const stats = await enrichUpcomingFixtures(h.options);
  assert.equal(stats.ok, true);
  assert.equal(h.records[0].match_info.venue.city_name, 'Brighton');
  assert.equal(h.records[0].sources.sportmonks.metadata_fetched_at.getTime(), NOW.getTime());
  assert.equal(h.writes[0].update.$set['match_info.venue'].name, 'Amex');
  assert.ok(h.writes[0].update.$set.sources);
});

test('orphan candidates cannot write foreign competition or unsupported fetched participants', async () => {
  const first = stored(101);
  const second = stored(102);
  first.match_info.league = null;
  second.match_info.league = null;
  const unsupportedTeams = fixture(102);
  unsupportedTeams.participants = [
    { id: 999, name: 'Other', meta: { location: 'home' } },
    { id: 998, name: 'Foreign', meta: { location: 'away' } },
  ];
  const h = harness([first, second], [
    fixture(101, { league: undefined, league_id: 99 }), unsupportedTeams,
  ]);
  const stats = await enrichUpcomingFixtures(h.options);
  assert.equal(stats.selected, 2);
  assert.equal(stats.skipped, 2);
  assert.equal(h.writes.length, 0);
  assert.equal(h.teamWrites.length, 0);
});

test('dry run fetches known missing fixtures but writes neither matches nor teams', async () => {
  const h = harness([]);
  const stats = await enrichUpcomingFixtures({ ...h.options, matchIds: [101], dryRun: true });
  assert.equal(stats.enriched, 1);
  assert.equal(stats.inserted, 0);
  assert.equal(h.writes.length, 0);
  assert.equal(h.teamWrites.length, 0);
});

test('bounded concurrency never exceeds two and limit bounds provider requests', async () => {
  const records = Array.from({ length: 8 }, (_, index) => stored(index + 1));
  const fixtures = records.map(record => fixture(record.match_id));
  const h = harness(records, fixtures);
  const stats = await enrichUpcomingFixtures({ ...h.options, concurrency: 20, limit: 5, dryRun: true });
  assert.equal(stats.requested, 5);
  assert.equal(stats.enriched, 5);
  assert.equal(h.peak(), 2);
});

test('provider failures are explicit, redact URLs/tokens and never advance freshness', async () => {
  const h = harness();
  h.options.sportmonks.get = async () => {
    throw Object.assign(new Error('https://provider?api_token=SECRET'), { response: { status: 503 } });
  };
  const stats = await enrichUpcomingFixtures(h.options);
  assert.equal(stats.ok, false);
  assert.equal(stats.errors[0].code, 'PROVIDER_REQUEST_FAILED');
  assert.match(stats.errors[0].message, /503/);
  assert.equal(JSON.stringify(stats).includes('SECRET'), false);
  assert.equal(h.writes.length, 0);
});

test('missing provider credentials and unavailable coverage do not silently succeed', async () => {
  const h = harness();
  const saved = process.env.SPORTMONKS_API_KEY;
  delete process.env.SPORTMONKS_API_KEY;
  try {
    const stats = await enrichUpcomingFixtures({ ...h.options, sportmonks: undefined });
    assert.equal(stats.ok, false);
    assert.equal(stats.errors[0].code, 'PROVIDER_UNAVAILABLE');
  } finally {
    if (saved !== undefined) process.env.SPORTMONKS_API_KEY = saved;
  }
  h.options.coveragePolicy.publicMatchFilter = async () => { throw new Error('Coverage is not initialized'); };
  const stats = await enrichUpcomingFixtures(h.options);
  assert.equal(stats.ok, false);
  assert.equal(stats.errors[0].code, 'SELECTION_FAILED');
  assert.equal(h.requests.length, 0);
});

test('finished, out-of-window, invalid provider and missing-kickoff fixtures are not written', async () => {
  const h = harness([], [
    fixture(101, { state: { name: 'Finished', developer_name: 'FT' } }),
    fixture(102, { starting_at_timestamp: NOW.getTime() / 1000 + 30 * 86400 }),
    fixture(103, { id: 999 }),
    fixture(104, { starting_at_timestamp: undefined }),
  ]);
  const stats = await enrichUpcomingFixtures({ ...h.options, matchIds: [101, 102, 103, 104] });
  assert.equal(stats.skipped, 2);
  assert.equal(stats.errors.length, 2);
  assert.equal(h.writes.length, 0);
  assert.equal(h.teamWrites.length, 0);
});

test('kickoff omission preserves an existing valid date but cannot invent one', async () => {
  const h = harness([stored()], [fixture(101, { starting_at_timestamp: undefined })]);
  const stats = await enrichUpcomingFixtures(h.options);
  assert.equal(stats.ok, true);
  assert.equal(h.records[0].date.getTime(), KICKOFF.getTime());
  assert.throws(() => normaliseFixtureToMatchDoc({ id: 123 }), /missing a valid kickoff/);
});

test('explicit new opponent teams are upserted by ID, without setting existing slugs', async () => {
  const next = fixture(101);
  next.participants[1] = { id: 999, name: 'New Opponent', meta: { location: 'away' } };
  const h = harness([], [next]);
  const stats = await enrichUpcomingFixtures({ ...h.options, matchIds: [101] });
  assert.equal(stats.ok, true);
  const update = h.teamWrites.find(write => write.filter.id === 999);
  assert.equal(update.options.upsert, true);
  assert.equal(update.update.$setOnInsert.slug, 'new-opponent');
  assert.equal(Object.hasOwn(update.update.$set, 'slug'), false);
  assert.equal(h.records[0].teams.away.team_id, 999);
});

test('an absent away participant never becomes a duplicate of the home participant', async () => {
  const next = fixture(101);
  next.participants = [next.participants[0]];
  const h = harness([stored()], [next]);
  assert.equal((await enrichUpcomingFixtures(h.options)).ok, true);
  assert.equal(h.records[0].teams.away.team_id, 14);
  assert.equal(h.records[0].teams.away.team_name, 'Opponent');
});

test('invalid options reject without provider requests', async () => {
  const h = harness();
  for (const options of [{ limit: NaN }, { matchIds: '101' }, { matchIds: [0] }, { concurrency: 0 }]) {
    const stats = await enrichUpcomingFixtures({ ...h.options, ...options });
    assert.equal(stats.errors[0].code, 'INVALID_OPTIONS');
  }
  assert.equal(h.requests.length, 0);
});

test('both cards render sparse metadata without dangling separators and retain home/away labels', context => {
  const path = require('node:path');
  const fs = require('node:fs');
  const { createRequire } = require('node:module');
  const frontendRequire = createRequire(path.join(__dirname, '..', 'frontend', 'package.json'));
  let babel;
  let React;
  let renderToStaticMarkup;
  let presetReact;
  let transformModules;
  try {
    babel = frontendRequire('@babel/core');
    React = frontendRequire('react');
    ({ renderToStaticMarkup } = frontendRequire('react-dom/server'));
    presetReact = frontendRequire.resolve('@babel/preset-react');
    transformModules = frontendRequire.resolve('@babel/plugin-transform-modules-commonjs');
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
    context.skip('Frontend dependencies are not installed; backend unit tests remain independent');
    return;
  }
  for (const name of ['MatchInfoCard', 'FixturesCard']) {
    const source = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'components', name, `${name}.jsx`), 'utf8');
    const { code } = babel.transformSync(source, {
      babelrc: false, configFile: false,
      presets: [[presetReact, { runtime: 'automatic' }]], plugins: [transformModules],
    });
    const componentModule = { exports: {} };
    const stubRequire = dependency => {
      if (dependency.endsWith('.css')) return {};
      if (dependency === '../../api') return { getOpponentScout: async () => null };
      if (dependency === '../../utils/teamSlug') return { toPublicTeamSlug: slug => slug || 'opponent' };
      if (dependency === 'react-router-dom') {
        return { Link: ({ to, children, ...props }) => React.createElement('a', { href: to, ...props }, children) };
      }
      return frontendRequire(dependency);
    };
    new Function('require', 'module', 'exports', code)(stubRequire, componentModule, componentModule.exports);
    const Card = componentModule.exports.default;
    const base = {
      date: KICKOFF.toISOString(), match_id: 101, home_game: true, status: 'NS',
      team_name: 'Brighton', opponent_name: 'Opponent', team_logo: 'home.png', opponent_logo: 'away.png',
    };
    const metadata = matchInfo => renderToStaticMarkup(React.createElement(Card, {
      matchInfo, teamName: 'Brighton', teamSlug: 'brighton',
      type: 'next', loadScout: false, showLinks: false,
    })).match(/<div class="result-details">([\s\S]*?)<\/div>/)?.[1];
    const sparse = metadata(base);
    assert.ok(sparse, name);
    assert.match(sparse, /Home/);
    assert.doesNotMatch(sparse, /separator|Matchweek|null|undefined/);
    const away = metadata({ ...base, home_game: false });
    assert.match(away, /Away/);
    const rich = metadata({ ...base, match_info: {
      venue: { city_name: 'Brighton' }, league: { name: 'Premier League' }, round: { name: '10' },
    } });
    assert.match(rich, /Brighton/);
    assert.match(rich, /Premier League/);
    assert.match(rich, /Matchweek 10/);
    assert.equal((rich.match(/separator/g) || []).length, 3);
    const cup = metadata({ ...base, round: { name: 'Quarter-finals' } });
    assert.match(cup, /Quarter-finals/);
    assert.doesNotMatch(cup, /Matchweek/);
  }
});
