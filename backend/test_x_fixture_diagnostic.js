const assert = require('node:assert/strict');
const { test, mock } = require('node:test');
const express = require('express');
const childProcess = require('child_process');

test('fixture route is opt-in, staging-only, authenticated, and runs an isolated fixed test', async () => {
  const keys = ['NODE_ENV', 'RAILWAY_ENVIRONMENT_NAME', 'X_FIXTURE_DIAGNOSTIC_ENABLED', 'ADMIN_API_KEY'];
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const exec = mock.method(childProcess, 'execFile', (_node, args, options, callback) => {
    assert.deepEqual(args.slice(0, 1), ['--test']);
    assert.match(args[1], /test_x_staging_fixture\.js$/);
    assert.equal(options.env.NODE_ENV, 'staging');
    assert.equal(options.env.ADMIN_API_KEY, undefined);
    assert.equal(options.env.X_API_BEARER_TOKEN, undefined);
    callback(null, 'tests passed', '');
  });
  const app = express();
  app.use('/api/admin/diagnostics', require('./routes/xFixtureDiagnostic'));
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const url = `http://127.0.0.1:${server.address().port}/api/admin/diagnostics/x-fixture`;
  try {
    process.env.NODE_ENV = 'staging';
    delete process.env.RAILWAY_ENVIRONMENT_NAME;
    process.env.ADMIN_API_KEY = 'test-key';
    delete process.env.X_FIXTURE_DIAGNOSTIC_ENABLED;
    assert.equal((await fetch(url, { method: 'POST' })).status, 404);
    process.env.X_FIXTURE_DIAGNOSTIC_ENABLED = 'true';
    assert.equal((await fetch(url, { method: 'POST' })).status, 401);
    process.env.NODE_ENV = 'production';
    assert.equal((await fetch(url, { method: 'POST', headers: { 'x-api-key': 'test-key' } })).status, 404);
    process.env.NODE_ENV = 'staging';
    const response = await fetch(url, { method: 'POST', headers: { 'x-api-key': 'test-key' } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).ok, true);
    assert.equal(exec.mock.callCount(), 1);
  } finally {
    await new Promise(resolve => server.close(resolve));
    mock.restoreAll();
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
});
