const { test, mock, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('node:events');
const mongoose = require('mongoose');
const Match = require('./models/Match');
const broadcaster = require('./live/changeStreamBroadcaster');

afterEach(() => {
  broadcaster.stopChangeStream();
  mock.restoreAll();
  delete mongoose.connection.readyState;
});

async function setup() {
  const stream = new EventEmitter();
  stream.close = () => {};
  Object.defineProperty(mongoose.connection, 'readyState', { configurable: true, value: 1 });
  mock.method(Match, 'watch', () => stream);
  await broadcaster.startChangeStream();
  return stream;
}

test('change-stream delivery applies public policy before writing, then closes revoked subscriptions', async () => {
  const stream = await setup();
  let allowed = true;
  const writes = [];
  let ended = false;
  const res = { write: text => writes.push(text), end: () => { ended = true; } };
  broadcaster.subscribe(123, res, async doc => allowed ? { match_id: doc.match_id, covered: true } : null);
  const changed = () => stream.emit('change', { fullDocument: { match_id: 123, match_status: { state: 'LIVE' } } });
  changed();
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(writes.some(value => value.includes('"covered":true')));
  const delivered = writes.length;
  allowed = false;
  changed();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes.length, delivered);
  assert.equal(ended, true);
  assert.equal(broadcaster.inspectStatus(123).subscriberCount, 0);
});

test('staging finished-match changes never start report preparation', async () => {
  const stream = await setup();
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'staging';
  const sync = mock.method(require('./controllers/matchSyncController'), 'syncFinishedMatch', async () => assert.fail('Must not prepare staging report'));
  try {
    stream.emit('change', { fullDocument: { match_id: 987, match_status: { state: 'FT' } } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(sync.mock.callCount(), 0);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test('maintenance inserts and updates never invoke report preflight', async () => {
  const stream = await setup();
  const policy = require('./services/reportGenerationPolicy');
  mock.method(policy, 'generationDisabledReason', () => null);
  const preflight = mock.method(policy, 'automaticReportSkipReason', async () => assert.fail('Maintenance must not invoke report preparation'));
  const fullDocument = {
    match_id: 456, match_status: { state: 'FT' },
    sources: { sportmonks: { maintenance_refresh_id: 'refresh-123' } }
  };
  stream.emit('change', { operationType: 'insert', fullDocument });
  stream.emit('change', { operationType: 'update', fullDocument, updateDescription: {
    updatedFields: { 'sources.sportmonks.maintenance_refresh_id': 'refresh-123' }
  } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(preflight.mock.callCount(), 0);
});
