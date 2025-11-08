// debug_fetch_fixture.js
// Fetch a single fixture payload and save a redacted copy for inspection
const fs = require('fs');
const path = require('path');
try { require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') }); } catch (e) {}
const { get: smGet } = require('../utils/sportmonks');

(async function(){
  try {
    const fixtureId = process.argv[2] || '19354641';
    console.log('Fetching fixture', fixtureId);
    const res = await smGet(`fixtures/${fixtureId}`, { include: 'lineups' });
    const payload = res?.data?.data || res?.data || null;
    if (!payload) {
      console.error('No payload returned');
      process.exit(2);
    }
    // Save raw for inspection
    const outPath = path.resolve(__dirname, '..', 'tmp', `fixture_${fixtureId}.json`);
    try { fs.mkdirSync(path.dirname(outPath), { recursive: true }); } catch (e) {}
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
    // Redact any api_token fields if present
    function redact(obj) {
      if (!obj || typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(redact);
      const out = {};
      for (const k of Object.keys(obj)) {
        if (String(k).toLowerCase().includes('token') || String(k).toLowerCase().includes('api_token')) out[k] = 'REDACTED';
        else out[k] = redact(obj[k]);
      }
      return out;
    }
    console.log('Saved raw payload to', outPath);
    console.log(JSON.stringify(redact(payload), null, 2).slice(0, 20000)); // print up to 20k chars
    process.exit(0);
  } catch (e) {
    console.error('Fetch failed:', e?.response?.data || e?.message || e);
    process.exit(1);
  }
})();
