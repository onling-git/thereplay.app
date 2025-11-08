// smoke_fetch_lineup.js
// Quick smoke test: fetch fixture(s) via matchSyncController.fetchMatchStats and normalise
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { fetchMatchStats } = require('../controllers/matchSyncController');
const { normaliseFixtureToMatchDoc } = require('../utils/normaliseFixture');

async function probe(id) {
  console.log('\n--- probing fixture', id, '---');
  try {
  const sm = await fetchMatchStats(id, { forFinished: true });
    if (!sm) {
      console.log('no payload returned for', id);
      return;
    }
    console.log('fetched with include:', sm._fetched_with_include || '(unknown)');
    // log team ids/objects
    console.log('team ids:', {
      home_team_id: sm.home_team_id,
      away_team_id: sm.away_team_id,
      localteam_id: sm.localteam_id,
      visitorteam_id: sm.visitorteam_id,
      home_team_obj: sm.home_team,
      away_team_obj: sm.away_team
    });

    // check rates
    console.log('rates present:', !!(sm.rates && sm.rates.data && sm.rates.data.length));

    // normalise
    const norm = normaliseFixtureToMatchDoc(sm) || {};
    console.log('normalised date:', norm.date);
    console.log('lineup home length:', (norm.lineup && norm.lineup.home && norm.lineup.home.length) || 0);
    console.log('lineup away length:', (norm.lineup && norm.lineup.away && norm.lineup.away.length) || 0);

    const sampleHome = (norm.lineup && norm.lineup.home) ? norm.lineup.home.slice(0,5) : [];
    const sampleAway = (norm.lineup && norm.lineup.away) ? norm.lineup.away.slice(0,5) : [];
    console.log('sample home entries:', sampleHome);
    console.log('sample away entries:', sampleAway);

  } catch (e) {
    console.error('probe failed for', id, e?.response?.data || e?.message || e);
  }
}

(async () => {
  // IDs to probe: the one from your console log and the example you gave
  const ids = [19427496, 19431750];
  for (const id of ids) await probe(id);
})();