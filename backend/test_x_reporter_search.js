const assert = require('node:assert/strict');
const { test, afterEach, mock } = require('node:test');
const axios = require('axios');
const { reporterQuery, searchReporterPosts } = require('./services/xReporterSearch');

afterEach(() => mock.restoreAll());
const options = {
  since: new Date('2026-11-25T14:00:00Z'),
  until: new Date('2026-11-25T15:00:00Z'),
  bearerToken: 'test-token'
};

test('reporter search uses only handles, never a hashtag', () => {
  assert.equal(reporterQuery(['@Alice', 'bob', 'alice']), '(from:alice OR from:bob)');
  assert.throws(() => reporterQuery(['alice) OR #team']), /Invalid reporter handle/);
});

test('official search requests every page and maps the existing reporter format', async () => {
  const get = mock.method(axios, 'get', async (_url, config) => {
    const second = config.params.next_token === 'next';
    return { data: {
      data: [{ id: second ? '2' : '1', text: 'Match update', author_id: '9', created_at: '2026-11-25T14:05:00Z', public_metrics: { like_count: 7 } }],
      includes: { users: [{ id: '9', username: 'alice', name: 'Alice' }] },
      meta: second ? { result_count: 1 } : { result_count: 1, next_token: 'next' }
    } };
  });
  const result = await searchReporterPosts(['@Alice'], options);
  assert.equal(get.mock.callCount(), 2);
  assert.equal(get.mock.calls[0].arguments[1].params.query, '(from:alice)');
  assert.equal(result.tweets[0].url, 'https://x.com/alice/status/1');
  assert.equal(result.tweets[0].author.userName, 'alice');
  assert.equal(result.tweets[0].likeCount, 7);
  assert.equal(result.tweets[1].id, '2');
});

test('page limits and incomplete results fail rather than silently skip posts', async () => {
  mock.method(axios, 'get', async () => ({ data: { meta: { result_count: 0, next_token: 'next' } } }));
  await assert.rejects(searchReporterPosts(['alice'], { ...options, maxPages: 1 }), /page limit/);
  mock.restoreAll();
  mock.method(axios, 'get', async () => ({ data: { data: [{ id: '1' }], errors: [{ title: 'partial' }] } }));
  await assert.rejects(searchReporterPosts(['alice'], options), /incomplete response/);
  mock.restoreAll();
  mock.method(axios, 'get', async () => ({ data: {} }));
  await assert.rejects(searchReporterPosts(['alice'], options), /incomplete response/);
});
