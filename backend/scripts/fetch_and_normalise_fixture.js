const { get } = require('../utils/sportmonks');
const { normaliseFixtureToMatchDoc } = require('../utils/normaliseFixture');

async function main() {
  const id = process.argv[2] || '19431864';
  try {
    // include events and participants so we get the richest payload
    const res = await get(`fixtures/${id}`, { include: 'events,participants,periods,statistics,lineups,scores' });
    if (!res || !res.data) {
      console.error('No response from sportmonks');
      process.exit(1);
    }
    const fixture = res.data.data || res.data;
    const doc = normaliseFixtureToMatchDoc(fixture);
    console.log(JSON.stringify(doc.events, null, 2));
  } catch (e) {
    console.error('Failed', e && (e.response && e.response.data) ? e.response.data : e.message);
    process.exit(1);
  }
}

main();