#!/usr/bin/env node
// scripts/inspect_fixture.js
// Usage: node scripts/inspect_fixture.js <fixtureId>

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { get: smGet } = require('../utils/sportmonks');

const fixtureId = process.argv[2];
if (!fixtureId) {
  console.error('Usage: node scripts/inspect_fixture.js <fixtureId>');
  process.exit(1);
}

(async () => {
  try {
    console.log('Fetching fixture', fixtureId);
    const include = process.argv[3] || 'state';
    const res = await smGet(`fixtures/${fixtureId}`, { include });
    console.log('fixture response:');
    console.log(JSON.stringify(res?.data || res, null, 2));
    const fixture = res?.data?.data || res?.data || res;
    const provStateId = fixture?.state?.id || fixture?.state_id || fixture?.time?.status_id || null;
    console.log('provStateId:', provStateId);
    if (provStateId) {
      console.log('Fetching canonical state', provStateId);
      const st = await smGet(`states/${provStateId}`);
      console.log('state response:');
      console.log(JSON.stringify(st?.data || st, null, 2));
    }
  } catch (e) {
    console.error('Error fetching fixture:', e?.response?.data || e?.message || e);
    process.exit(1);
  }
})();