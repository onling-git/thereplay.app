const assert = require('node:assert/strict');
const { test, afterEach, mock } = require('node:test');
const axios = require('axios');
const Report = require('./models/Report');
const Match = require('./models/Match');
const Team = require('./models/Team');
const coverage = require('./services/coveragePolicy');
const publisher = require('./services/xReportPublisher');
const keys = ['X_REPORT_PUBLISH_MODE', 'X_REPORT_ALLOW_STAGING_LIVE', 'X_REPORT_SITE_URL', 'NODE_ENV', 'RAILWAY_ENVIRONMENT_NAME', 'X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_TOKEN_SECRET'];
const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
afterEach(() => {
  mock.restoreAll();
  for (const key of keys) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
});

function setup(mode) {
  process.env.X_REPORT_PUBLISH_MODE = mode;
  process.env.NODE_ENV = 'production';
  delete process.env.RAILWAY_ENVIRONMENT_NAME;
  Object.assign(process.env, { X_API_KEY: 'key', X_API_SECRET: 'secret', X_ACCESS_TOKEN: 'token', X_ACCESS_TOKEN_SECRET: 'token-secret' });
  const report = { _id: 'report-id', match_id: 123, team_id: 1, team_slug: 'home', headline: 'A match report', x_publication: { attempts: 1 } };
  mock.method(coverage, 'publicMatchFilter', async () => ({}));
  mock.method(Report, 'findOneAndUpdate', () => ({ lean: async () => report }));
  mock.method(Match, 'findOne', () => ({ lean: async () => ({ reports: { home: 'report-id' } }) }));
  mock.method(Team, 'findOne', () => ({ lean: async () => ({ twitter: { hashtag: '#HOME' } }) }));
  const update = mock.method(Report, 'updateOne', async () => ({}));
  return update;
}

test('composes a bounded post with team hashtag and report URL', () => {
  const text = publisher.composePost({ team_slug: 'home', match_id: 123, headline: 'A'.repeat(300) }, { twitter: { hashtag: '#HOME' } }, 'https://thereplay.app');
  assert.match(text, /#HOME\nhttps:\/\/thereplay\.app\/home\/match\/123\/report$/);
  assert.ok(Array.from(text.split('\n\n')[0]).length + '\n\n#HOME\n'.length + 23 <= 280);
  assert.throws(() => publisher.composePost({ team_slug: 'home', match_id: 123, headline: 'Hi' }, {}, 'https://thereplay.app'), /hashtag/);
});

test('dry run records text without contacting X', async () => {
  const update = setup('dry-run');
  const post = mock.method(axios, 'post', async () => assert.fail('Unexpected live post'));
  await publisher.publishReport('report-id');
  assert.equal(post.mock.callCount(), 0);
  assert.equal(update.mock.calls[0].arguments[1].$set['x_publication.state'], 'dry_run');
});

test('successful publication stores the X post ID', async () => {
  const update = setup('live');
  mock.method(axios, 'post', async (_url, body, config) => {
    assert.match(config.headers.Authorization, /^OAuth /);
    assert.match(body.text, /#HOME/);
    return { data: { data: { id: 'post-id' } } };
  });
  await publisher.publishReport('report-id');
  assert.equal(update.mock.calls[0].arguments[1].$set['x_publication.state'], 'published');
  assert.equal(update.mock.calls[0].arguments[1].$set['x_publication.post_id'], 'post-id');
});

test('timeouts are uncertain and are not automatically retried', async () => {
  const update = setup('live');
  mock.method(axios, 'post', async () => { throw new Error('timeout'); });
  await publisher.publishReport('report-id');
  assert.equal(update.mock.calls[0].arguments[1].$set['x_publication.state'], 'uncertain');
});

test('a rate limit schedules a bounded retry', async () => {
  const update = setup('live');
  mock.method(axios, 'post', async () => { throw Object.assign(new Error('rate limit'), { response: { status: 429 } }); });
  await publisher.publishReport('report-id');
  const fields = update.mock.calls[0].arguments[1].$set;
  assert.equal(fields['x_publication.state'], 'pending');
  assert.ok(fields['x_publication.retry_at'] > new Date());
});

test('an unclaimed report never posts', async () => {
  process.env.X_REPORT_PUBLISH_MODE = 'live';
  process.env.NODE_ENV = 'production';
  delete process.env.RAILWAY_ENVIRONMENT_NAME;
  mock.method(Report, 'findOneAndUpdate', () => ({ lean: async () => null }));
  const post = mock.method(axios, 'post', async () => assert.fail('Unexpected duplicate post'));
  await publisher.publishReport('report-id');
  assert.equal(post.mock.callCount(), 0);
});

test('staging requires explicit opt-in and a non-production URL for live publication', () => {
  process.env.X_REPORT_PUBLISH_MODE = 'live';
  process.env.NODE_ENV = 'staging';
  delete process.env.X_REPORT_ALLOW_STAGING_LIVE;
  assert.throws(() => publisher.publishMode(), /explicit opt-in/);
  process.env.X_REPORT_ALLOW_STAGING_LIVE = 'true';
  process.env.X_REPORT_SITE_URL = 'https://thereplay.app';
  assert.throws(() => publisher.publishMode(), /production site/);
  process.env.X_REPORT_SITE_URL = 'https://staging.example.com';
  assert.equal(publisher.publishMode(), 'live');
});
