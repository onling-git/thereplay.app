const assert = require('node:assert/strict');
const { test, afterEach, mock } = require('node:test');
const twitter = require('./utils/twitterService');
const x = require('./services/xReporterSearch');
const provider = require('./services/reporterTweetProvider');
const Checkpoint = require('./models/ReporterCollectionCheckpoint');
const originalEnv = { ...process.env };

afterEach(() => {
  mock.restoreAll();
  for (const key of ['REPORTER_TWEET_PROVIDER', 'X_API_BEARER_TOKEN', 'X_REPORTER_FALLBACK_ENABLED', 'TWITTERAPI_KEY']) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

test('default reporter provider uses the existing service', async () => {
  delete process.env.REPORTER_TWEET_PROVIDER;
  const search = mock.method(twitter, 'searchByUser', async () => ({ tweets: [] }));
  const result = await provider.searchByUser(['reporter'], {});
  assert.equal(search.mock.callCount(), 1);
  assert.equal(result.apiSource, 'twitterapi.io');
});

test('official errors automatically use the fallback when explicitly enabled', async () => {
  process.env.REPORTER_TWEET_PROVIDER = 'x';
  process.env.X_API_BEARER_TOKEN = 'test';
  process.env.TWITTERAPI_KEY = 'test';
  process.env.X_REPORTER_FALLBACK_ENABLED = 'true';
  mock.method(Checkpoint, 'findById', () => ({ lean: async () => null }));
  mock.method(x, 'searchReporterPosts', async () => { throw new Error('unavailable'); });
  const search = mock.method(twitter, 'searchByUser', async () => ({ tweets: [{ id: '1' }] }));
  const result = await provider.searchByUser(['reporter'], { since: new Date(), until: new Date(), matchId: 1, teamId: 2 });
  assert.equal(search.mock.callCount(), 1);
  assert.equal(result.apiSource, 'twitterapi.io');
});

test('empty official results do not trigger fallback', async () => {
  process.env.REPORTER_TWEET_PROVIDER = 'x';
  process.env.X_API_BEARER_TOKEN = 'test';
  process.env.TWITTERAPI_KEY = 'test';
  process.env.X_REPORTER_FALLBACK_ENABLED = 'true';
  mock.method(Checkpoint, 'findById', () => ({ lean: async () => null }));
  mock.method(x, 'searchReporterPosts', async () => ({ tweets: [], apiSource: 'x-api' }));
  const search = mock.method(twitter, 'searchByUser', async () => assert.fail('Unexpected fallback'));
  const result = await provider.searchByUser(['reporter'], { matchId: 1, teamId: 2 });
  assert.equal(result.apiSource, 'x-api');
  assert.equal(search.mock.callCount(), 0);
});

test('checkpoint overlaps the last successful window and only advances after saving', async () => {
  process.env.REPORTER_TWEET_PROVIDER = 'x';
  process.env.X_API_BEARER_TOKEN = 'test';
  const start = new Date('2026-11-25T14:00:00Z');
  const previous = new Date('2026-11-25T14:20:00Z');
  const end = new Date('2026-11-25T14:25:00Z');
  mock.method(Checkpoint, 'findById', () => ({ lean: async () => ({ collected_through: previous }) }));
  const update = mock.method(Checkpoint, 'updateOne', async () => ({}));
  const search = mock.method(x, 'searchReporterPosts', async () => ({ tweets: [], apiSource: 'x-api' }));
  const result = await provider.searchByUser(['reporter'], { since: start, until: end, matchId: 1, teamId: 2 });
  assert.equal(search.mock.calls[0].arguments[1].since.toISOString(), '2026-11-25T14:18:00.000Z');
  assert.equal(update.mock.callCount(), 0);
  await result.commitCheckpoint();
  assert.equal(update.mock.calls[0].arguments[1].$max.collected_through.getTime(), end.getTime());
});
