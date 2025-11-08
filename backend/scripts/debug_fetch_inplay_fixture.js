// debug_fetch_inplay_fixture.js
// Fetch the SportMonks fixture for a specific match id and write the raw JSON to tmp/

const fs = require('fs');
const path = require('path');
const { get } = require('../utils/sportmonks');

async function main() {
  const id = process.argv[2] || '19427534';
  const include = 'events;participants;scores;periods;state;lineups;statistics.type;comments';
  console.log('Fetching fixture', id, 'with include=', include);
  try {
    const { data } = await get(`/fixtures/${id}`, { include });
    const out = data || {};
    const dest = path.join(__dirname, '..', 'tmp', `fixture_${id}_raw.json`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, JSON.stringify(out, null, 2), 'utf8');
    console.log('Wrote', dest);
  } catch (e) {
    console.error('Fetch failed', e?.response?.status, e?.response?.data || e.message || e);
    process.exit(2);
  }
}

main();
