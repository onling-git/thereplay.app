// debug_fetch_inplay_all.js
// Fetch /livescores/inplay with includes and write raw JSON to tmp/

const fs = require('fs');
const path = require('path');
const { get } = require('../utils/sportmonks');

async function main() {
  const include = 'events;participants;scores;periods;state;lineups;statistics.type;comments';
  console.log('Fetching /livescores/inplay with include=', include);
  try {
    const { data } = await get('/livescores/inplay', { include });
    const out = data || {};
    const dest = path.join(__dirname, '..', 'tmp', `livescores_inplay_raw.json`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, JSON.stringify(out, null, 2), 'utf8');
    console.log('Wrote', dest);
  } catch (e) {
    console.error('Fetch failed', e?.response?.status, e?.response?.data || e.message || e);
    process.exit(2);
  }
}

main();
