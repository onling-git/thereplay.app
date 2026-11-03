const assert = require('node:assert/strict');
const { test, mock, afterEach } = require('node:test');

process.env.OPENAI_API_KEY = 'test-only';
const Tweet = require('./models/Tweet');
const Report = require('./models/Report');
const ReportStaging = require('./models/ReportStaging');
const Trace = require('./models/ReportGenerationTrace');
const retention = require('./services/tweetRetention');

afterEach(() => mock.restoreAll());

const now = new Date('2026-10-30T12:00:00Z');
const cutoff = new Date('2026-09-30T12:00:00Z');

function mockCollections() {
  const calls = [];
  mock.method(Tweet, 'deleteMany', async query => {
    calls.push({ model: Tweet, query });
    return { deletedCount: 7 };
  });
  for (const model of [Tweet, Report, ReportStaging, Trace]) {
    mock.method(model.collection, 'updateMany', async (query, update) => {
      calls.push({ model, query, update });
      return { modifiedCount: 1 };
    });
  }
  return calls;
}

test('records expire exactly 30 days after posting, independent of fetch or update date', async () => {
  const calls = mockCollections();
  const result = await retention.purgeExpiredTweets(now);
  assert.equal(retention.TWEET_RETENTION_DAYS, 30);
  assert.equal(retention.TWEET_RETENTION_MS, 30 * 24 * 60 * 60 * 1000);
  assert.deepEqual(calls[0], { model: Tweet, query: { created_at: { $lte: cutoff } } });
  assert.equal(result.deleted_tweets, 7);
  assert.equal(result.modified_documents, calls.length - 1);
});

test('all published, draft and trace tweet arrays are pruned without changing articles or credits', async () => {
  const calls = mockCollections();
  await retention.purgeExpiredTweets(now);
  const paths = calls.filter(call => Array.isArray(call.update)).map(call => {
    const path = Object.keys(call.update[0].$set)[0];
    const filter = call.update[0].$set[path].$filter;
    assert.deepEqual(filter.input, { $cond: [{ $isArray: `$${path}` }, `$${path}`, []] });
    assert.deepEqual(filter.cond, {
      $gt: [
        { $convert: { input: '$$tweet.created_at', to: 'date', onError: null, onNull: null } },
        cutoff
      ]
    });
    assert.deepEqual(call.query, {
      [path]: { $type: 'array' },
      $expr: {
        $gt: [
          { $size: { $cond: [{ $isArray: `$${path}` }, `$${path}`, []] } },
          { $size: { $filter: filter } }
        ]
      }
    });
    // The strictly-greater-than cutoff keeps recent tweets, removes boundary/older
    // tweets and treats undated/unparseable legacy copies as expired.
    assert.ok(new Date(cutoff.getTime() + 1) > filter.cond.$gt[1]);
    assert.equal(cutoff > filter.cond.$gt[1], false);
    assert.equal(new Date(cutoff.getTime() - 1) > filter.cond.$gt[1], false);
    assert.equal(call.update.length, path === 'run1.input_snapshot.tweets' ? 2 : 1);
    return `${call.model.modelName}:${path}`;
  });
  assert.deepEqual(paths, [
    'Report:embedded_tweets',
    'Report:generated.embedded_tweets',
    'ReportStaging:report.embedded_tweets',
    'ReportStaging:report.generated.embedded_tweets',
    'ReportGenerationTrace:run2.output.embedded_tweets',
    'ReportGenerationTrace:run2.output.generated.embedded_tweets',
    'ReportGenerationTrace:run2.output.assembled_report.embedded_tweets',
    'ReportGenerationTrace:run2.output.assembled_report.generated.embedded_tweets',
    'ReportGenerationTrace:run1.input_snapshot.tweets'
  ]);
  assert.deepEqual(calls.at(-1).update[1], { $unset: ['run1.prompt', 'run1.repair_prompt'] });
});

test('old quoted and retweeted payloads are cleared even inside recent posts', async () => {
  const calls = mockCollections();
  await retention.purgeExpiredTweets(now);
  const nested = calls.filter(call => call.model === Tweet && call.update);
  assert.deepEqual(nested.map(call => ({ query: call.query, update: call.update })), [
    { query: { 'retweetedTweet.created_at': { $lte: cutoff } }, update: { $unset: { retweetedTweet: '', api_response_meta: '' } } },
    { query: { 'quotedTweet.created_at': { $lte: cutoff } }, update: { $unset: { quotedTweet: '', api_response_meta: '' } } }
  ]);
});

test('database failures propagate instead of reporting successful cleanup', async () => {
  mockCollections();
  mock.method(Report.collection, 'updateMany', async () => { throw new Error('database unavailable'); });
  await assert.rejects(retention.purgeExpiredTweets(now), /database unavailable/);
});

test('invalid cutoff dates cannot trigger deletion', async () => {
  const calls = mockCollections();
  await assert.rejects(retention.purgeExpiredTweets(new Date('invalid')), /valid date/);
  assert.equal(calls.length, 0);
});

test('new interpretation snapshots carry posting dates without altering the model prompt', async () => {
  const { client } = require('./utils/openai');
  const completion = mock.method(client.chat.completions, 'create', async () => ({
    choices: [{ message: { content: '{"social_context":[]}' } }]
  }));
  const { interpretMatch } = require('./services/matchInterpretation');
  const tweets = Array.from({ length: 12 }, (_, index) => ({
    tweet_id: String(index),
    text: `Reporter observation ${index}`,
    created_at: new Date(now.getTime() - index * 1000)
  }));
  const trace = {};
  await interpretMatch({
    match: { score: { home: 1, away: 0 }, teams: {} },
    tweets, teamFocus: 'Home', teamSide: 'home', trace
  });
  assert.equal(completion.mock.callCount(), 1);
  assert.equal(trace.input_snapshot.tweets.length, 10);
  for (let index = 0; index < 10; index++) {
    assert.equal(trace.input_snapshot.tweets[index].tweet_id, tweets[index].tweet_id);
    assert.equal(trace.input_snapshot.tweets[index].created_at, tweets[index].created_at);
  }
  assert.equal(trace.prompt.includes('"created_at"'), false);
  assert.ok(trace.prompt.includes('Reporter observation 0'));
});

test('retention runs on startup and every minute even when other cron jobs are disabled', async () => {
  const previous = process.env.ENABLE_CRON;
  process.env.ENABLE_CRON = 'false';
  const cron = require('node-cron');
  const scheduled = [];
  const stop = mock.fn();
  mock.method(cron, 'schedule', (expression, callback) => {
    scheduled.push({ expression, callback });
    return { stop };
  });
  const purge = mock.method(retention, 'purgeExpiredTweets', async () => ({ deleted_tweets: 0, modified_documents: 0 }));
  const jobs = require('./cron/index');
  try {
    jobs.startCrons();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(purge.mock.callCount(), 1);
    assert.equal(scheduled.length, 1);
    assert.equal(scheduled[0].expression, '* * * * *');
    await scheduled[0].callback();
    assert.equal(purge.mock.callCount(), 2);

    mock.method(retention, 'purgeExpiredTweets', async () => { throw new Error('retry needed'); });
    const errors = mock.method(console, 'error', () => {});
    await scheduled[0].callback();
    assert.match(errors.mock.calls[0].arguments.join(' '), /Cleanup failed.*retry next minute.*retry needed/);
    const retry = mock.method(retention, 'purgeExpiredTweets', async () => ({ deleted_tweets: 0, modified_documents: 0 }));
    await scheduled[0].callback();
    assert.equal(retry.mock.callCount(), 1);
  } finally {
    await jobs.stopCrons();
    if (previous === undefined) delete process.env.ENABLE_CRON;
    else process.env.ENABLE_CRON = previous;
  }
  assert.equal(stop.mock.callCount(), 1);
});
