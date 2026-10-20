process.env.OPENAI_API_KEY = 'test-only';
const { test, mock, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Match = require('./models/Match');
const Team = require('./models/Team');
const Report = require('./models/Report');
const Monitor = require('./utils/reportMonitoring');

afterEach(() => mock.restoreAll());

function fixture(overrides = {}) {
  return {
    match_id: 123, home_team_slug: 'home', away_team_slug: 'away',
    date: new Date(Date.now() - 3 * 60 * 60 * 1000),
    match_status: { state: 'FT' }, score: { home: 1, away: 0 }, ...overrides
  };
}

test('missing-report monitor excludes foreign teams and unconfirmed results, but rechecks corrected data', async () => {
  let matches = [fixture({ score: { home: null, away: null } })];
  mock.method(Match, 'find', () => ({ lean: async () => matches }));
  mock.method(Team, 'findOne', query => ({ lean: async () => ({ country_id: query.slug === 'home' ? 462 : 32 }) }));
  mock.method(Report, 'find', () => ({ lean: async () => [] }));
  const leagues = require('./utils/leagueHelper');
  mock.method(leagues, 'getEnabledLeagueIds', async () => [8]);
  // Reload so the existing destructured league helper uses the mock.
  const path = require.resolve('./utils/reportMonitoring');
  const previous = require.cache[path];
  delete require.cache[path];
  try {
    const Monitor = require(path);
    assert.deepEqual((await Monitor.checkMissingReports()).missingReports, []);
    assert.equal(Team.findOne.mock.callCount(), 0);
    matches = [fixture()];
    const result = await Monitor.checkMissingReports();
    assert.equal(result.missingReports.length, 1);
    assert.equal(result.missingReports[0].missingHome, true);
    assert.equal(result.missingReports[0].missingAway, false);
  } finally { require.cache[path] = previous; }
});

test('completion monitoring does not wait for an ineligible opponents report', async () => {
  mock.method(Match, 'findOne', () => ({ lean: async () => fixture({ reports: { home: 'saved-report' } }) }));
  mock.method(Team, 'findOne', query => ({ lean: async () => ({ country_id: query.slug === 'home' ? 462 : 32 }) }));
  const result = await Monitor.monitorMatchReports(123, { timeout: 0 });
  assert.equal(result.success, true);
  assert.deepEqual(result.reports, { home: true, away: false });
});
