const { test, mock, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const policy = require('./services/coveragePolicy');
const Match = require('./models/Match');
const Team = require('./models/Team');
const { protectRouter } = require('./middleware/publicCoverage');
const { markMatch, markTeamSnapshot } = require('./utils/publicCoverage');

const scope = {
  initialized: true, teamIds: [1], leagueIds: [8], competitionIds: [8, 24], reportCompetitionIds: [8, 24],
  teams: [{ id: 1, slug: 'supported', name: 'Supported' }]
};
const matchScope = { 'match_info.league.id': { $in: [8, 24] }, $or: [
  { 'teams.home.team_id': { $in: [1, '1'] } }, { 'teams.away.team_id': { $in: [1, '1'] } }
] };
afterEach(() => mock.restoreAll());

function setup() {
  mock.method(policy, 'getCoverage', async () => scope);
  mock.method(policy, 'publicMatchFilter', async () => matchScope);
  mock.method(policy, 'publicTeamFilter', async () => ({ id: { $in: [1] } }));
}
function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}
function query(value) {
  return {
    select() { return this; }, sort() { return this; }, limit() { return this; }, skip() { return this; },
    lean: async () => value
  };
}
async function withServer(router, callback) {
  const app = express();
  app.use(router);
  app.use((error, req, res, next) => res.status(error.statusCode || error.status || 500).json({ error: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await callback(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('public route fails closed with 503 and never runs its query', async () => {
  mock.method(policy, 'getCoverage', async () => { throw Object.assign(new Error('Not initialized'), { status: 503 }); });
  const router = express.Router();
  protectRouter(router);
  router.get('/public', () => assert.fail('must not query'));
  await withServer(router, async base => {
    assert.equal((await fetch(`${base}/public`)).status, 503);
  });
});

test('hidden direct teams and matches are 404 even for an administrator', async () => {
  setup();
  mock.method(policy, 'assertPublicTeam', async () => { throw Object.assign(new Error('Team not found'), { status: 404 }); });
  mock.method(policy, 'assertPublicMatch', async () => { throw Object.assign(new Error('Match not found'), { status: 404 }); });
  const router = express.Router();
  protectRouter(router, { teams: ['teamSlug'], matches: ['matchId'] });
  router.get('/team/:teamSlug', () => assert.fail('must not query'));
  router.get('/match/:matchId', () => assert.fail('must not query'));
  await withServer(router, async base => {
    assert.equal((await fetch(`${base}/team/foreign`, { headers: { 'x-admin-key': 'admin' } })).status, 404);
    assert.equal((await fetch(`${base}/match/99`)).status, 404);
  });
});

test('public router does not intercept internal sibling routes or protected mutations', async () => {
  mock.method(policy, 'getCoverage', async () => assert.fail('admin jobs must not load public policy'));
  const router = express.Router();
  protectRouter(router, { teams: ['teamSlug'] });
  router.get('/public/:teamSlug', () => assert.fail());
  router.post('/recompute/:teamSlug', (req, res) => res.json({ ok: true }));
  const root = express.Router();
  root.use(router);
  root.get('/admin/cache', (req, res) => res.json({ ok: true }));
  await withServer(root, async base => {
    assert.equal((await fetch(`${base}/admin/cache`)).status, 200);
    assert.equal((await fetch(`${base}/recompute/foreign`, { method: 'POST' })).status, 200);
  });
});

test('fixture grouping and count share coverage before pagination', async () => {
  setup();
  let pipeline, count;
  mock.method(Match, 'aggregate', async stages => { pipeline = stages; return []; });
  mock.method(Match, 'countDocuments', async filter => { count = filter; return 0; });
  mock.method(require('./models/Country'), 'find', () => query([]));
  const res = response();
  await require('./controllers/fixturesController').getAllFixtures({
    query: { league: '24', offset: '10', limit: '5' }, coverage: scope
  }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(pipeline[0].$match.$and[1], matchScope);
  assert.deepEqual(count, pipeline[0].$match);
  assert.ok(pipeline.findIndex(stage => stage.$match) < pipeline.findIndex(stage => stage.$skip));
});

test('team search league_id uses current-season membership and supported intersection before count', async () => {
  setup();
  mock.method(policy, 'assertPublicCompetition', async () => {});
  mock.method(require('./models/League'), 'findOne', () => query({ current_season_id: 2026 }));
  mock.method(require('./models/TeamMembership'), 'find', filter => {
    assert.deepEqual(filter, { league_id: 8, season_id: 2026, active: true });
    return query([{ team_id: 1 }, { team_id: 99 }]);
  });
  let readFilter, countFilter;
  mock.method(Team, 'find', filter => { readFilter = filter; return query([]); });
  mock.method(Team, 'countDocuments', async filter => { countFilter = filter; return 0; });
  const res = response();
  await require('./controllers/teamController').listTeams({ query: { league_id: '8' }, coverage: scope }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(readFilter.$and, [{ id: { $in: [1, 99] } }, { id: { $in: [1] } }]);
  assert.deepEqual(countFilter, readFilter);
});

test('opponents remain visible but unsupported links and report references are flagged off', () => {
  const match = markMatch({
    match_info: { league: { id: 24 } }, teams: { home: { team_id: '1' }, away: { team_id: 99 } },
    reports: { home: 'ours', away: 'foreign' }
  }, scope);
  assert.equal(match.teams.home.supported, true);
  assert.equal(match.teams.away.supported, false);
  assert.equal(match.reports.away, null);
  assert.equal(match.reports.home, 'ours');
  assert.equal(markTeamSnapshot({ next_match_info: { match_id: 5, opponent_slug: 'foreign' } }, scope).next_match_info.opponent_supported, false);
  assert.equal(markTeamSnapshot({ next_match_info: { match_id: 5, opponent_id: '1', opponent_slug: 'old-alias' } }, scope).next_match_info.opponent_supported, true);
  const legacy = markMatch({ league: { id: 24 }, teams: { home: { team_id: 1 }, away: { team_id: 99 } }, reports: { home: 'published', away: 'hidden' } }, scope);
  assert.equal(legacy.reports.home, 'published');
  assert.equal(legacy.reports.away, null);
});

test('report query filters supported owner and allowed match before callers sort or limit', async () => {
  setup();
  const stages = await require('./utils/publicReports').publicReportStages();
  assert.deepEqual(stages[0].$match.team_slug, { $in: ['supported'] });
  assert.ok(stages.some(stage => stage.$match?.['match.match_info.league.id']?.$in.includes(24)));
});

test('stale authenticated and anonymous preferences are not returned', async () => {
  setup();
  const controller = require('./controllers/userController');
  const User = require('./models/User');
  mock.method(User, 'findById', () => ({ select: async () => ({ favourite_team: 99, followed_teams: [1, 99] }) }));
  for (const req of [
    { user: { id: 'user' } },
    { session: { teamPreferences: { favourite_team: 99, followed_teams: [1, 99] } } }
  ]) {
    const res = response();
    await new Promise((resolve, reject) => {
      res.json = body => { res.body = body; resolve(); };
      controller.getTeamPreferences(req, res, reject);
    });

    assert.deepEqual(res.body.data.team_preferences, { favourite_team: null, followed_teams: [1] });
  }
});

test('favorite counts exclude stale saved matches at the query stage', async () => {
      setup();
      mock.method(Match, 'distinct', async (field, filter) => {
        assert.equal(field, 'match_id');
        assert.deepEqual(filter.$and[1], matchScope);
        return [5];
      });
      const filters = [];
      mock.method(require('./models/FavoriteMatch'), 'countDocuments', async filter => {
        filters.push(filter);
        return 1;
      });
      const res = response();
      await new Promise((resolve, reject) => {
        res.json = body => { res.body = body; resolve(); };
        require('./controllers/favoriteMatchController').getFavoriteMatchesCount({ user: { id: 'user' } }, res, reject);
      });
      assert.equal(filters.length, 2);
      filters.forEach(filter => assert.deepEqual(filter.match_id, { $in: [5] }));
    });

    test('public SSE rechecks coverage and closes instead of sending a disabled match', async () => {
      setup();
      const { EventEmitter } = require('node:events');
      const intervals = new Map();
      mock.method(global, 'setInterval', (callback, delay) => { intervals.set(delay, callback); return delay; });
      mock.method(global, 'clearInterval', () => {});
      mock.method(policy, 'assertPublicMatch', async () => ({
        match_id: 5, match_info: { league: { id: 24 } },
        teams: { home: { team_id: 1 }, away: { team_id: 99 } }
      }));
      let readFilter;
      mock.method(Match, 'findOne', filter => { readFilter = filter; return query(null); });
      const req = new EventEmitter();
      req.params = { matchId: '5' };
      const res = new EventEmitter();
      const chunks = [];
      let closed = false;
      Object.assign(res, {
        set() {}, flushHeaders() {}, write(chunk) { chunks.push(chunk); }, end() { closed = true; }
      });
      await require('./controllers/streamController').streamMatch(req, res);
      assert.ok(chunks.join('').includes('"supported":false'));
      await intervals.get(2000)();
      assert.deepEqual(readFilter.$and[1], matchScope);
      assert.equal(closed, true);
      assert.equal(chunks.filter(chunk => chunk === 'event: update\n').length, 0);
    });

    test('structured data uses the supported away route without linking the foreign home hub', () => {
      const { buildLiveMatchGraph } = require('./utils/liveMatchSchema');
      const graph = buildLiveMatchGraph(markMatch({
        match_id: 5, match_info: { league: { id: 24 }, starting_at: '2026-10-21T18:00:00Z' },
        teams: { home: { team_id: 99, team_slug: 'foreign', team_name: 'Foreign' },
          away: { team_id: 1, team_slug: 'supported', team_name: 'Supported' } }
      }, scope));
      const event = graph['@graph'].find(node => node['@type'] === 'SportsEvent');
      assert.equal(event.url, 'https://thereplay.app/supported/match/5');
      assert.equal(event.homeTeam['@id'], undefined);
      assert.equal(event.awayTeam['@id'], 'https://thereplay.app/supported/');
    });
