const { test, mock, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const League = require('./models/League');
const Country = require('./models/Country');
const Team = require('./models/Team');
const policy = require('./services/coveragePolicy');

afterEach(() => mock.restoreAll());

function setup({ initialized = true, enabledCountry = true, leagues, members = [] } = {}) {
  mock.method(require('./models/CoverageConfig'), 'findById', () => ({ lean: async () => ({ initialized }) }));
  mock.method(League, 'find', () => ({ lean: async () => leagues || [
    { id: 8, country_id: 462, coverage_role: 'league', current_season_id: 100, reports_enabled: true },
    { id: 24, country_id: 462, coverage_role: 'competition', reports_enabled: true }
  ] }));
  mock.method(Country, 'find', () => ({ select() { return this; }, lean: async () => enabledCountry ? [{ id: 462 }] : [] }));
  mock.method(require('./models/TeamMembership'), 'find', filter => {
    assert.deepEqual(filter.$or, [{ league_id: 8, season_id: 100 }]);
    assert.equal(filter.active, true);
    return { lean: async () => members };
  });
  mock.method(Team, 'find', filter => ({ select() { return this; }, lean: async () => filter.id.$in.map(id => ({ id, slug: `team-${id}` })) }));
}

test('uninitialized coverage fails closed, never enables worldwide defaults', async () => {
  setup({ initialized: false });
  await assert.rejects(policy.getCoverage(), { status: 503 });
});

test('membership, not club country, defines public clubs; cups do not add opponents', async () => {
  setup({ members: [{ team_id: 1 }, { team_id: 2 }] });
  const coverage = await policy.getCoverage();
  assert.deepEqual(coverage.teamIds, [1, 2]);
  assert.deepEqual(coverage.competitionIds, [8, 24]);
  assert.deepEqual(coverage.leagueIds, [8]);
});

test('disabled domestic country suspends its leagues without enabling worldwide fallback', async () => {
  setup({ enabledCountry: false });
  const coverage = await policy.getCoverage();
  assert.deepEqual(coverage.teamIds, []);
  assert.deepEqual(coverage.leagueIds, []);
  assert.deepEqual(coverage.competitionIds, [24]);
});

test('zero selected competitions is an intentional empty scope', async () => {
  setup({ leagues: [] });
  assert.deepEqual((await policy.getCoverage()).competitionIds, []);
  assert.deepEqual((await policy.publicTeamFilter()), { id: { $in: [] } });
});

test('reports require a supported club AND competition report permission', async () => {
  setup({ members: [{ team_id: 1 }] });
  await policy.assertReportTeam({ match_info: { league: { id: 24 } } }, { id: 1, country_id: 320 });
  await assert.rejects(policy.assertReportTeam({ match_info: { league: { id: 24 } } }, { id: 99, country_id: 462 }), { status: 403 });
  await assert.rejects(policy.assertReportTeam({ match_info: { league: { id: 99 } } }, { id: 1 }), { status: 403 });
});

test('public match query constrains competition AND participant before pagination, with string ID compatibility', () => {
  const filter = policy.matchFilterForCoverage({ teamIds: [1], competitionIds: [8, 24] }, 'match');
  assert.equal(filter.$and.length, 2);
  assert.deepEqual(filter.$and[0].$or[0], { 'match.match_info.league.id': { $in: [8, 24] } });
  assert.deepEqual(filter.$and[1].$or[0], { 'match.teams.home.team_id': { $in: [1, '1'] } });
});

test('a visible competition can be covered without enabling paid reports', async () => {
  setup({ members: [{ team_id: 1 }], leagues: [
    { id: 8, country_id: 462, coverage_role: 'league', current_season_id: 100, reports_enabled: true },
    { id: 24, country_id: 462, coverage_role: 'competition', reports_enabled: false }
  ] });
  assert.deepEqual((await policy.getCoverage()).competitionIds, [8, 24]);
  await policy.assertReportTeam({ match_info: { league: { id: 8 } } }, { id: 1 });
  await assert.rejects(policy.assertReportTeam({ match_info: { league: { id: 24 } } }, { id: 1 }), { status: 403 });
});
