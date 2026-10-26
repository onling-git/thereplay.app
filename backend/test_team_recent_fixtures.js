const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const Match = require('./models/Match');
const Team = require('./models/Team');
const policy = require('./services/coveragePolicy');
const { getTeamMatchesFromDb } = require('./utils/teamMatchUtils');
const { refreshTeamCache } = require('./utils/teamCacheUtils');
const { getTeamFixtures } = require('./controllers/teamController');

afterEach(() => mock.restoreAll());
const query = value => ({
  sort() { return this; }, limit() { return this; }, select() { return this; },
  lean: async () => value
});
const scope = { 'match_info.league.id': { $in: [8, 27] } };
const team = { id: 3, slug: 'sunderland', name: 'Sunderland', last_match: 19872565 };
function fixture(id, league, season, date, state = 'FT') {
  return {
    match_id: id, date: new Date(date),
    match_info: { starting_at: new Date(date), season: { id: season }, league: { id: league } },
    match_status: { state }, score: { home: 0, away: 0 },
    teams: {
      home: { team_id: 3, team_slug: 'sunderland', team_name: 'Sunderland' },
      away: { team_id: 71, team_slug: 'leeds-united', team_name: 'Leeds United' }
    }
  };
}
const latest = fixture(19722124, 8, 28083, '2026-10-25T16:30:00Z');
const oldCup = fixture(19872565, 27, 27917, '2026-09-08T18:45:00Z');
function setupSnapshot(next) {
  mock.method(Match, 'findOne', filter => {
    const text = JSON.stringify(filter);
    assert.ok(!text.includes('season.id'), 'Recent match selection must not inherit a competition season');
    assert.ok(text.includes('match_info.league.id'), 'Public coverage must remain applied');
    if (text.includes('"$in":["finished"')) {
      assert.ok(text.includes('"$lte"'), 'Finished match must have a past kickoff');
      return query(latest);
    }
    return query(text.includes('"$gt"') ? next : null);
  });
}

test('next cup tie does not replace the latest league result with September cup history', async () => {
  const nextCup = fixture(19884062, 27, 27917, new Date(Date.now() + 86400000).toISOString(), 'NS');
  setupSnapshot(nextCup);
  const result = await getTeamMatchesFromDb(team.slug, team.name, scope);
  assert.equal(result.lastFinished.match_id, latest.match_id);
  assert.equal(result.nextUpcoming.match_id, nextCup.match_id);
  assert.notEqual(result.lastFinished.match_id, oldCup.match_id);
});

test('next league fixture also allows a more recent cup result', async () => {
  const cupResult = { ...latest, match_info: { ...latest.match_info, league: { id: 27 }, season: { id: 27917 } } };
  const nextLeague = fixture(100, 8, 28083, new Date(Date.now() + 86400000).toISOString(), 'NS');
  setupSnapshot(nextLeague);
  const original = Match.findOne;
  mock.method(Match, 'findOne', filter => {
    const response = original(filter);
    return JSON.stringify(filter).includes('"$in":["finished"') ? query(cupResult) : response;
  });
  const result = await getTeamMatchesFromDb(team.slug, team.name, scope);
  assert.equal(result.lastFinished.match_info.league.id, 27);
  assert.equal(result.nextUpcoming.match_info.league.id, 8);
});

test('cache repair replaces stale cup pointer and snapshot with latest league match', async () => {
  setupSnapshot(fixture(19884062, 27, 27917, new Date(Date.now() + 86400000).toISOString(), 'NS'));
  mock.method(Team, 'findOne', async () => team);
  mock.method(policy, 'publicMatchFilter', async () => scope);
  let saved;
  mock.method(Team, 'findOneAndUpdate', (filter, update) => {
    saved = update.$set;
    return query({ cache_metadata: {} });
  });
  const result = await refreshTeamCache(team.slug);
  assert.equal(result.success, true);
  assert.equal(saved.last_match, latest.match_id);
  assert.equal(saved.last_match_info.match_id, latest.match_id);
  assert.equal(saved.last_match_info.opponent_slug, 'leeds-united');
});

test('recent fixtures endpoint returns latest results across competitions, including cup finishes', async () => {
  mock.method(Team, 'findOne', () => query(team));
  mock.method(Team, 'find', () => query([]));
  mock.method(policy, 'publicMatchFilter', async () => scope);
  const nextCup = fixture(19884062, 27, 27917, new Date(Date.now() + 86400000).toISOString(), 'NS');
  const recentCup = fixture(123, 27, 27917, '2026-10-20T18:45:00Z', 'FT_PEN');
  const recent = [latest, recentCup, oldCup];
  mock.method(Match, 'find', filter => {
    const text = JSON.stringify(filter);
    assert.ok(!text.includes('season.id'));
    assert.ok(text.includes('match_info.league.id'));
    const state = filter.$and.find(clause => clause['match_status.state'])?.['match_status.state'];
    if (!state) return query([nextCup]);
    for (const finished of ['FT', 'AET', 'FT_PEN', 'AFTER_EXTRA_TIME', 'AFTER_PENALTIES']) {
      assert.ok(state.test(finished), finished + ' should be a finished result');
    }
    assert.ok(!state.test('NS'));
    assert.ok(!state.test('POSTPONED'));
    assert.ok(filter.$and.some(clause => clause.$expr?.$lte), 'Exclude future final-state data');
    return query(recent);
  });
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  await getTeamFixtures({
    params: { teamSlug: team.slug },
    coverage: { teamIds: [3, 71], competitionIds: [8, 27], reportCompetitionIds: [8, 27] }
  }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.recent.map(row => row.match_id), [latest.match_id, recentCup.match_id, oldCup.match_id]);
  assert.equal(res.body.upcoming[0].match_id, nextCup.match_id);
});
