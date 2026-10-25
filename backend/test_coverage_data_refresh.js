const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const provider = require('./utils/sportmonks');
const policy = require('./services/coveragePolicy');
const Config = require('./models/CoverageConfig');
const Team = require('./models/Team');
const Match = require('./models/Match');
const Standing = require('./models/Standing');
const Membership = require('./models/TeamMembership');
const { fetchSportmonksPages } = require('./utils/sportmonksPages');
const { refreshCoverageData, refreshCoveredTeamSnapshots, metadataUpdate } = require('./services/coverageDataRefresh');
const standings = require('./services/standingsService');
const cache = require('./utils/teamCacheUtils');
const lean = value => ({ select() { return this; }, sort() { return this; }, limit() { return this; }, lean: async () => value });
afterEach(() => mock.restoreAll());
const fixture = (id = 100) => ({
  id, league_id: 8, season_id: 10, starting_at: '2026-10-25 15:00:00', state_id: 5,
  league: { id: 8, name: 'Premier League' }, season: { id: 10, name: '2026/2027', is_current: true },
  state: { id: 5, developer_name: 'FT' },
  participants: [
    { id: 1, name: 'Home Team', meta: { location: 'home' } },
    { id: 2, name: 'Opponent', meta: { location: 'away' } }
  ],
  scores: [
    { participant_id: 1, description: 'CURRENT', score: { participant: 'home', goals: 2 } },
    { participant_id: 2, description: 'CURRENT', score: { participant: 'away', goals: 0 } }
  ]
});

test('provider pagination consumes has_more and rejects repeated pages', async () => {
  const rows = await fetchSportmonksPages('/test', {}, async (path, params) => ({
    data: { data: [{ id: params.page }], pagination: { current_page: params.page, has_more: params.page === 1 } }
  }));
  assert.deepEqual(rows.map(row => row.id), [1, 2]);
  await assert.rejects(fetchSportmonksPages('/test', {}, async () => ({
    data: { data: [{ id: 1 }], pagination: { has_more: true } }
  })), /repeated/);
  await assert.rejects(fetchSportmonksPages('/test', {}, async () => ({ data: { message: 'Denied' } })), /Invalid provider/);
});

test('metadata refresh preserves canonical slugs, report flags and rich metadata', () => {
  const previous = {
    match_id: 100,
    teams: { home: { team_id: 1, team_slug: 'custom-id', has_report: true } },
    match_info: { venue: { id: 1, name: 'Stored Venue' }, referee: { name: 'Stored Referee' } },
    reports: { home: 'published' }, lineups: { home: ['keep'] }
  };
  const set = metadataUpdate(previous, fixture(), new Map([[1, { slug: 'custom-id' }]]), 'run', new Date());
  assert.equal(set['teams.home.team_slug'], 'custom-id');
  assert.equal(set['score.home'], 2);
  assert.equal(set['score.away'], 0);
  assert.equal(set['match_info.venue.name'], 'Stored Venue');
  assert.equal(set['sources.sportmonks.maintenance_refresh_id'], 'run');
  assert.equal(set['teams.home.has_report'], undefined);
  assert.equal(set.reports, undefined);
  assert.equal(set.lineups, undefined);
});

test('metadata refresh replaces a null nested object without illegal dotted writes', () => {
  const incoming = { ...fixture(), venue: { id: 1, name: 'New Ground', address: 'High Street' } };
  const set = metadataUpdate({ match_info: { venue: null } }, incoming, new Map(), 'run', new Date());
  assert.equal(set['match_info.venue'].name, 'New Ground');
  assert.equal(set['match_info.venue.address'], undefined);
});

function setup() {
  const teams = Array.from({ length: 116 }, (_, index) => ({ id: index + 1, slug: `club-${index + 1}` }));
  const coverage = { teams, teamIds: teams.map(team => team.id), leagueIds: [8], competitionIds: [8, 24] };
  mock.method(policy, 'getCoverage', async () => coverage);
  mock.method(Config, 'findOneAndUpdate', () => lean({ initialized: true }));
  const saves = [];
  mock.method(Config, 'updateOne', async (query, update) => { saves.push(update); return { matchedCount: 1 }; });
  mock.method(Team, 'find', () => lean(teams));
  mock.method(Match, 'findOne', () => lean(null));
  const writes = [];
  mock.method(Match, 'updateOne', async (filter, update) => { writes.push({ filter, update }); return { matchedCount: 1 }; });
  mock.method(provider, 'get', async path => ({
    data: { data: path.startsWith('/fixtures/') ? [
      fixture(), { ...fixture(101), league_id: 999 },
      { ...fixture(102), participants: [{ id: 998 }, { id: 999 }] }
    ] : [] }
  }));
  mock.method(standings, 'syncMultipleLeagues', async ids => {
    assert.deepEqual(ids, [8]);
    return [{ league_id: 8, success: true, data: { table: teams.slice(0, 20) } }];
  });
  mock.method(cache, 'batchRefreshTeamCache', async slugs => {
    assert.equal(slugs.length, 116);
    return { total: slugs.length, successful: slugs.length, updated: 1, failed: 0 };
  });
  return { saves, writes, coverage };
}

test('refresh processes only supported fixtures, domestic tables and all 116 snapshots', async () => {
  const { writes, saves } = setup();
  const result = await refreshCoverageData({ daysBack: 1, daysAhead: 1 });
  assert.equal(result.ok, true);
  assert.equal(result.fixtures, 1);
  assert.equal(writes.length, 1);
  assert.equal(result.snapshots.clubs, 116);
  assert.ok(writes[0].update.$set['sources.sportmonks.maintenance_refresh_id']);
  assert.equal(saves.at(-1).$set.data_refresh_lease_until, null);
  assert.equal(saves.at(-1).$set.data_refresh_status.ok, true);
});

test('partial provider failure is persisted and thrown, not a successful refresh', async () => {
  const { saves, writes } = setup();
  mock.method(provider, 'get', async () => { throw new Error('Provider unavailable'); });
  await assert.rejects(refreshCoverageData({ daysBack: 1, daysAhead: 1 }), error => {
    assert.equal(error.result.ok, false);
    assert.match(error.result.errors[0].message, /Provider unavailable/);
    return true;
  });
  assert.equal(writes.length, 0);
  assert.equal(saves.at(-1).$set.data_refresh_status.ok, false);
});

test('concurrent refresh refuses work and invalid windows never acquire a lease', async () => {
  setup();
  const lease = mock.method(Config, 'findOneAndUpdate', () => lean(null));
  await assert.rejects(refreshCoverageData({ daysBack: 0 }), /integer/);
  assert.equal(lease.mock.callCount(), 0);
  await assert.rejects(refreshCoverageData(), error => error.status === 409);
});

test('failed standings and snapshots are surfaced', async () => {
  setup();
  mock.method(standings, 'syncMultipleLeagues', async () => [{ league_id: 8, success: false, error: 'No standings' }]);
  await assert.rejects(refreshCoverageData({ daysBack: 1, daysAhead: 1 }), error => error.result.errors.some(item => item.message === 'No standings'));
  mock.method(cache, 'batchRefreshTeamCache', async () => ({ total: 116, failed: 1, errors: [{ team: 'club-1' }] }));
  await assert.rejects(refreshCoveredTeamSnapshots(), /snapshot refresh failed/);
});

test('standings replace tables only after fetching complete pages and current membership', async () => {
  mock.method(provider, 'get', async (path, params) => ({
    data: { data: [{
      id: params.page, participant_id: params.page, position: params.page, points: 0,
      league_id: 8, season_id: 10, stage_id: 20,
      details: [], season: { name: '2026/2027' }, league: { name: 'Premier League' }
    }], pagination: { current_page: params.page, has_more: params.page === 1 } }
  }));
  mock.method(Membership, 'find', () => lean([{ team_id: 1 }, { team_id: 2 }]));
  mock.method(Team, 'find', () => lean([{ id: 1 }, { id: 2 }]));
  const write = mock.method(Standing, 'findOneAndUpdate', async (filter, document) => document);
  const result = await standings.syncStandingsBySeason(10);
  assert.equal(result.table.length, 2);
  assert.equal(write.mock.callCount(), 1);
  mock.method(Membership, 'find', () => lean([{ team_id: 1 }, { team_id: 2 }, { team_id: 3 }]));
  await assert.rejects(standings.syncStandingsBySeason(10), /Incomplete standings/);
  assert.equal(write.mock.callCount(), 1);
});

test('hub cache refresh scopes match lookups and updates both snapshots and pointers', async () => {
  const team = { slug: 'home-team', name: 'Home Team', last_match: 999, next_match: 998 };
  mock.method(Team, 'findOne', async () => team);
  const scope = { 'match_info.league.id': { $in: [8] } };
  mock.method(policy, 'publicMatchFilter', async () => scope);
  const previous = {
    match_id: 123, match_info: { starting_at: new Date(Date.now() - 86400000) },
    teams: { home: { team_slug: 'home-team', team_name: 'Home Team', team_id: 1 },
      away: { team_slug: 'opponent', team_name: 'Opponent', team_id: 2 } },
    score: { home: 2, away: 0 }, match_status: { state: 'FT' }
  };
  const matchReads = [];
  mock.method(Match, 'findOne', filter => {
    matchReads.push(filter);
    return lean(JSON.stringify(filter).includes('"$in":["finished"') ? previous : null);
  });
  let saved;
  mock.method(Team, 'findOneAndUpdate', (filter, update) => {
    saved = update.$set;
    return lean({ cache_metadata: {} });
  });
  const result = await cache.refreshTeamCache('home-team');
  assert.equal(result.success, true);
  assert.equal(saved.last_match, 123);
  assert.equal(saved.next_match, null);
  assert.equal(saved.last_match_info.opponent_id, 2);
  assert.ok(matchReads.every(filter => JSON.stringify(filter).includes('"match_info.league.id"')));
});
