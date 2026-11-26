const express = require('express');
const { execFile } = require('child_process');
const path = require('path');
const requireApiKey = require('../middleware/apiKey');

const router = express.Router();
let running = false;

router.post('/x-fixture', (req, res, next) => {
  const staging = [process.env.NODE_ENV, process.env.RAILWAY_ENVIRONMENT_NAME]
    .some(value => /stag(e|ing)/i.test(value || ''));
  if (!staging || process.env.X_FIXTURE_DIAGNOSTIC_ENABLED !== 'true') {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
}, requireApiKey(), (req, res) => {
  if (running) return res.status(409).json({ error: 'Diagnostic already running' });
  running = true;
  const fixture = path.join(__dirname, '..', 'test_x_staging_fixture.js');
  execFile(process.execPath, ['--test', fixture], {
    cwd: path.join(__dirname, '..'),
    timeout: 20000,
    maxBuffer: 64 * 1024,
    env: { NODE_ENV: 'staging', OPENAI_API_KEY: 'test-only', PATH: process.env.PATH || '' }
  }, (error, stdout, stderr) => {
    running = false;
    if (error) {
      console.error('[x-fixture] Diagnostic failed:', error.message, stderr);
      return res.status(500).json({ ok: false, error: 'Fixture diagnostic failed; see Railway logs' });
    }
    console.info('[x-fixture] Isolated reporter and publication fixtures passed');
    return res.json({
      ok: true,
      tests: ['reporter collection with mocked X response', 'report save and dry-run publication'],
      isolation: 'No database connection or X request'
    });
  });
});

module.exports = router;
