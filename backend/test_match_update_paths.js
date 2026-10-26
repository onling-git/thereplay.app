const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const Match = require('./models/Match');
const { metadataUpdate } = require('./services/coverageDataRefresh');

afterEach(() => mock.restoreAll());

async function prepareUpdate(set, existing = {}) {
  mock.method(Match, 'findOne', () => ({ lean: async () => existing }));
  const context = {
    model: Match,
    getQuery: () => ({ match_id: 100 }),
    getUpdate() { return this.update; },
    setUpdate(update) { this.update = update; },
    update: { $set: set }
  };
  await new Promise((resolve, reject) => {
    Match.schema.s.hooks.execPre('findOneAndUpdate', context, [], error => error ? reject(error) : resolve());
  });
  const result = context.update.$set;
  const paths = Object.keys(result);
  for (const path of paths) {
    assert.ok(!paths.some(other => other.startsWith(path + '.')), `Conflicting parent ${path}`);
  }
  return result;
}

test('schedule metadata survives actual Match update middleware without conflicting parent paths', async () => {
  const existing = {
    teams: {
      home: { team_id: 1, team_name: 'Home', team_slug: 'home', has_report: true },
      away: { team_id: 2, team_name: 'Away', team_slug: 'away' }
    },
    match_info: { starting_at: new Date('2026-10-26T20:00:00Z') }
  };
  const fixture = {
    id: 100, league_id: 14, season_id: 10, starting_at: '2026-10-26 20:30:00',
    league: { id: 14, name: 'League Two' },
    participants: [
      { id: 1, name: 'Home', meta: { location: 'home' } },
      { id: 2, name: 'Away', meta: { location: 'away' } }
    ]
  };
  const patch = metadataUpdate(existing, fixture, new Map(), 'schedule-test', new Date());
  const set = await prepareUpdate(patch, existing);
  assert.equal(set['teams.home.team_name'], 'Home');
  assert.equal(set['teams.home.team_slug'], 'home');
  assert.equal(set['teams.home.has_report'], undefined);
  assert.equal(set['teams.home'], undefined);
  assert.equal(set.teams, undefined);
  assert.equal(set.match_info, undefined);
  assert.equal(new Date(set.date).getTime(), new Date(set['match_info.starting_at']).getTime());
});

test('flat team updates use leaves and preserve unrelated nested data', async () => {
  const set = await prepareUpdate({
    home_team: 'Home Club', home_team_id: 1, away_team_slug: 'away-club',
    'teams.home.logo': 'badge.png', 'match_info.league.id': 14,
    date: new Date('2026-10-26T20:00:00Z')
  });
  assert.equal(set['teams.home.team_name'], 'Home Club');
  assert.equal(set['teams.home.team_id'], 1);
  assert.equal(set['teams.away.team_slug'], 'away-club');
  assert.equal(set['teams.away.team_name'], undefined);
  assert.equal(set['teams.home.logo'], 'badge.png');
  assert.equal(set['match_info.starting_at'], set.date);
});

test('whole team, side and match-info objects remain whole instead of mixing leaf updates', async () => {
  const full = await prepareUpdate({
    teams: { home: { team_name: 'Home', has_report: true }, away: { team_name: 'Away' } },
    match_info: { starting_at: '2026-10-26T20:00:00Z', league: { id: 14 } }
  });
  assert.equal(full.teams.home.has_report, true);
  assert.equal(full.home_team, 'Home');
  assert.equal(full.teams.home.team_slug, 'home');
  const side = await prepareUpdate({
    'teams.home': { team_name: 'Home', logo: 'badge.png' }, home_team_id: 1,
    match_info: { venue: { name: 'Ground' } }, date: new Date('2026-10-26T20:00:00Z')
  });
  assert.equal(side['teams.home'].team_id, 1);
  assert.equal(side['teams.home'].logo, 'badge.png');
  assert.equal(side.match_info.venue.name, 'Ground');
  assert.equal(side.match_info.starting_at, side.date);
});
