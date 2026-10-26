const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const Standing = require('./models/Standing');
const League = require('./models/League');
const Team = require('./models/Team');
const policy = require('./services/coveragePolicy');

afterEach(() => mock.restoreAll());
const query = value => ({
  select() { return this; },
  sort() { return this; },
  lean: async () => value
});
const leagues = [{ id: 8, current_season_id: 100 }, { id: 9, current_season_id: 200 }];
const table = [{ participant_id: 65, position: 1, points: 10 }];

function setup(rows, allowedLeagues = leagues) {
  mock.method(League, 'find', filter => {
    assert.deepEqual(filter.current_season_id, { $ne: null });
    return query(allowedLeagues.filter(league => !filter.id || filter.id.$in.includes(league.id)));
  });
  mock.method(Team, 'find', () => query([{ id: 65, name: 'Current Club', slug: 'current-club', image_path: 'badge.png' }]));
  mock.method(Standing, 'find', filter => {
    assert.equal(filter['table.participant_id'], 65);
    return query(rows.filter(row => filter.$or.some(pair =>
      pair.league_id === row.league_id && pair.season_id === row.season_id
    ) && row.table.some(entry => entry.participant_id === 65)));
  });
}

test('promoted club excludes its former division and older seasons of its current division', async () => {
  setup([
    { league_id: 9, season_id: 199, table },
    { league_id: 8, season_id: 999, table },
    { league_id: 8, season_id: 100, table }
  ]);
  const result = await Standing.getTeamStandings(65);
  assert.deepEqual(result.map(row => [row.league_id, row.season_id]), [[8, 100]]);
  assert.equal(result[0].table[0].team_name, 'Current Club');
  assert.equal(result[0].table[0].team_slug, 'current-club');
});

test('relegated club uses current season even when another league has a higher season ID', async () => {
  setup([
    { league_id: 8, season_id: 9999, table },
    { league_id: 9, season_id: 200, table }
  ]);
  const result = await Standing.getTeamStandings(65);
  assert.deepEqual(result.map(row => [row.league_id, row.season_id]), [[9, 200]]);
});

test('missing current table never falls back to a historical table', async () => {
  setup([{ league_id: 9, season_id: 199, table }]);
  assert.deepEqual(await Standing.getTeamStandings(65), []);
});

test('current league/season pairs cannot be crossed and disabled competitions are excluded', async () => {
  setup([
    { league_id: 8, season_id: 200, table },
    { league_id: 9, season_id: 100, table },
    { league_id: 8, season_id: 100, table },
    { league_id: 9, season_id: 200, table }
  ]);
  const result = await Standing.getTeamStandings(65, { leagueIds: [9] });
  assert.deepEqual(result.map(row => [row.league_id, row.season_id]), [[9, 200]]);
});

test('missing current-season catalogue returns no historical standings', async () => {
  setup([], []);
  mock.method(Standing, 'find', () => assert.fail('must not query unscoped history'));
  assert.deepEqual(await Standing.getTeamStandings(65), []);
});

test('public team endpoint shares the current-season resolver and public coverage scope', async () => {
  setup([
    { league_id: 9, season_id: 199, table },
    { league_id: 8, season_id: 100, table },
    { league_id: 9, season_id: 200, table }
  ]);
  mock.method(policy, 'getCoverage', async () => ({
    initialized: true, teamIds: [65], competitionIds: [8], leagueIds: [8]
  }));
  mock.method(policy, 'assertPublicTeam', async () => {});
  const app = express();
  app.use('/api/standings', require('./routes/standingsRoutes'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/standings/team/65`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.data.map(row => [row.league_id, row.season_id]), [[8, 100]]);
    assert.equal(body.data[0].table[0].supported, true);
    assert.match(response.headers.get('cache-control'), /no-store/);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
