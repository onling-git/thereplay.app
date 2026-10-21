const { test, mock, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const League = require('./models/League');
const Country = require('./models/Country');

afterEach(() => mock.restoreAll());

async function withAdminRouter(run, { available = true } = {}) {
  const previousKey = process.env.ADMIN_API_KEY;
  process.env.ADMIN_API_KEY = 'coverage-test-only';
  const catalogue = require('./services/coverageCatalog');
  const refresh = mock.method(catalogue, 'refreshCoverage', async () => ({ discovered: 7 }));
  const league = { id: 8, name: 'Premier League', country_id: 462, coverage_role: 'league', available, enabled: true, reports_enabled: true, membership_synced_at: new Date() };
  const chain = value => ({ populate() { return this; }, sort() { return this; }, select() { return this; }, lean: async () => value, then: (yes, no) => Promise.resolve(value).then(yes, no) });
  mock.method(League, 'find', () => chain([league]));
  mock.method(League, 'findOne', () => chain(league));
  const update = mock.method(League, 'findOneAndUpdate', (_filter, operation) => {
    Object.assign(league, operation.$set);
    return chain(league);
  });
  mock.method(Country, 'find', () => chain([]));
  mock.method(require('./models/CoverageConfig'), 'findById', () => chain(null));
  mock.method(require('./models/CoverageConfig'), 'updateOne', async () => ({}));
  const path = require.resolve('./routes/adminLeagueRoutes');
  const previous = require.cache[path];
  delete require.cache[path];
  const app = express();
  app.use(express.json());
  app.use('/leagues', require(path));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/leagues`;
  try {
    await run({ base, refresh, update, league, headers: { 'x-api-key': 'coverage-test-only', 'content-type': 'application/json' } });
  } finally {
    await new Promise(resolve => server.close(resolve));
    if (previous) require.cache[path] = previous;
    else delete require.cache[path];
    if (previousKey === undefined) delete process.env.ADMIN_API_KEY;
    else process.env.ADMIN_API_KEY = previousKey;
  }
}

test('admin list shows country-blocked effective state, not just saved enabled flags', async () => {
  await withAdminRouter(async ({ base, headers }) => {
    const response = await fetch(base, { headers });
    const [league] = await response.json();
    assert.equal(response.status, 200);
    assert.equal(league.enabled, true);
    assert.equal(league.effective_enabled, false);
    assert.equal(league.effective_status, 'Blocked by country setting');
  });
});

test('new catalogue discoveries require an authenticated refresh and explicit launch choice', async () => {
  await withAdminRouter(async ({ base, headers, refresh }) => {
    assert.equal((await fetch(base + '/refresh-catalogue', { method: 'POST' })).status, 401);
    const response = await fetch(base + '/refresh-catalogue', { method: 'POST', headers, body: JSON.stringify({ bootstrapLaunch: true }) });
    assert.equal(response.status, 200);
    assert.deepEqual(refresh.mock.calls[0].arguments, [{ bootstrapLaunch: true }]);
  });
});

test('unavailable competitions cannot be enabled', async () => {
  await withAdminRouter(async ({ base, headers, update }) => {
    const response = await fetch(base + '/8', { method: 'PATCH', headers, body: JSON.stringify({ enabled: true }) });
    assert.equal(response.status, 409);
    assert.equal(update.mock.callCount(), 0);
  }, { available: false });
});

test('report controls and disabling coverage save without a provider refresh or deleting records', async () => {
  await withAdminRouter(async ({ base, headers, refresh, league }) => {
    const response = await fetch(base + '/8', { method: 'PATCH', headers, body: JSON.stringify({ enabled: false, reports_enabled: false }) });
    assert.equal(response.status, 200);
    assert.equal(league.enabled, false);
    assert.equal(league.reports_enabled, false);
    assert.equal(refresh.mock.callCount(), 0);
  });
});
