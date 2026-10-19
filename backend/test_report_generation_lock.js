const assert = require('node:assert/strict');
const { test, afterEach, mock } = require('node:test');
const Lock = require('./models/ReportGenerationLock');
const { withReportGenerationLock } = require('./services/reportGenerationLock');

afterEach(() => mock.restoreAll());

function mockLocks() {
  const rows = new Map();
  mock.method(Lock, 'findOneAndUpdate', async (filter, update, options) => {
    assert.equal(options.upsert, true);
    const row = rows.get(filter._id);
    if (row && row.expires_at > filter.expires_at.$lte) {
      throw Object.assign(new Error('duplicate key'), { code: 11000 });
    }
    rows.set(filter._id, { ...update.$set });
    return update.$set;
  });
  mock.method(Lock, 'exists', async filter => {
    const row = rows.get(filter._id);
    return row?.owner === filter.owner && row.expires_at > filter.expires_at.$gt;
  });
  mock.method(Lock, 'deleteOne', async filter => {
    if (rows.get(filter._id)?.owner === filter.owner) rows.delete(filter._id);
  });
  return rows;
}

test('the unique database key blocks concurrent workers, including slug case variants', async () => {
  const rows = mockLocks();
  let finish;
  const gate = new Promise(resolve => { finish = resolve; });
  const first = withReportGenerationLock(123, ' HOME ', async assertOwnership => {
    await gate;
    await assertOwnership();
    return 'saved';
  });
  await Promise.resolve();
  await assert.rejects(withReportGenerationLock(123, 'home', () => assert.fail('Duplicate paid work')), { status: 409 });
  assert.equal(rows.size, 1);
  finish();
  assert.equal(await first, 'saved');
  assert.equal(rows.size, 0);
});

test('failed generation releases its claim and permits a later retry', async () => {
  const rows = mockLocks();
  await assert.rejects(withReportGenerationLock(123, 'home', async () => { throw new Error('writer failed'); }), /writer failed/);
  assert.equal(rows.size, 0);
  assert.equal(await withReportGenerationLock(123, 'home', async () => 'retry'), 'retry');
});

test('an expired claim is recoverable, but an old owner cannot save or delete a replacement claim', async () => {
  const rows = mockLocks();
  rows.set('123:home', { owner: 'crashed-process', expires_at: new Date(0) });
  await assert.rejects(withReportGenerationLock(123, 'home', async assertOwnership => {
    rows.set('123:home', { owner: 'replacement', expires_at: new Date(Date.now() + 60000) });
    await assertOwnership();
  }), /lease lost/);
  assert.equal(rows.get('123:home').owner, 'replacement');
});

test('database failures are not mistaken for a duplicate generation', async () => {
  mock.method(Lock, 'findOneAndUpdate', async () => { throw new Error('database unavailable'); });
  await assert.rejects(withReportGenerationLock(123, 'home', () => assert.fail('Must fail closed')), /database unavailable/);
});

test('heartbeat extends only its own claim and is stopped on completion', async () => {
  const rows = mockLocks();
  let heartbeat;
  const timer = { unref() {} };
  mock.method(global, 'setInterval', callback => { heartbeat = callback; return timer; });
  const clear = mock.method(global, 'clearInterval', value => assert.equal(value, timer));
  const renew = mock.method(Lock, 'updateOne', async (filter, update) => {
    assert.equal(rows.get(filter._id).owner, filter.owner);
    rows.set(filter._id, { owner: filter.owner, ...update.$set });
    return { matchedCount: 1 };
  });
  await withReportGenerationLock(123, 'home', async assertOwnership => {
    heartbeat();
    await assertOwnership();
  });
  assert.equal(renew.mock.callCount(), 1);
  assert.equal(clear.mock.callCount(), 1);
});

test('invalid generation identifiers fail before contacting the database', async () => {
  const claim = mock.method(Lock, 'findOneAndUpdate', async () => assert.fail('Invalid claim'));
  for (const [id, slug] of [[NaN, 'home'], [0, 'home'], [1, ' '], [1, undefined]]) {
    await assert.rejects(withReportGenerationLock(id, slug, () => assert.fail('Invalid generation')), { status: 400 });
  }
  assert.equal(claim.mock.callCount(), 0);
});
