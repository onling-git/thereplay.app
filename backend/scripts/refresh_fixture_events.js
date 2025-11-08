const path = require('path');
// load backend env so utils/sportmonks picks up the API key
try { require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') }); } catch (e) {}

const { get } = require('../utils/sportmonks');
const { normaliseFixtureToMatchDoc } = require('../utils/normaliseFixture');
const { connectDB } = require('../db/connect');
const Match = require('../models/Match');

async function main() {
  const argv = require('minimist')(process.argv.slice(2));
  const id = argv._[0] || argv.matchId || argv.match || process.env.MATCH_ID;
  if (!id) {
    console.error('Usage: node refresh_fixture_events.js <matchId> [--mongo=MONGO_URL] [--dry]');
    process.exit(1);
  }
  const dry = !!argv.dry;
  const mongo = argv.mongo || argv.MONGO || process.env.MONGO_URL || process.env.MONGODB_URI || process.env.DBURI || 'mongodb://localhost:27017/thefinalplay';

  try {
  console.log('Fetching fixture', id, 'from SportMonks...');
  // SportMonks include params are semicolon-separated
  // Use includes that are valid on the Fixture endpoint; request 'lineups' (plural)
  const include = 'events;participants;periods;lineups;scores';
  const res = await get(`fixtures/${id}`, { include });
    const fixture = res.data && res.data.data ? res.data.data : res.data;
    if (!fixture) throw new Error('No fixture payload returned');

    const doc = normaliseFixtureToMatchDoc(fixture);
    if (!doc) throw new Error('Normaliser returned null');

    console.log('Connecting to mongo', mongo);
    await connectDB(mongo);

    const update = {
      events: doc.events || [],
      score: doc.score || { home: 0, away: 0 },
      minute: doc.minute ?? null,
      added_time: doc.added_time ?? null,
      match_status: doc.match_status || {},
    };

    console.log('Will update match', id, 'with', (update.events && update.events.length) || 0, 'events');
    if (dry) {
      console.log('Dry run - not writing to DB');
      console.log(JSON.stringify(update, null, 2));
      process.exit(0);
    }

    const resu = await Match.updateOne({ match_id: Number(id) }, { $set: update });
    console.log('Update result:', resu && (resu.nModified || resu.modifiedCount || resu.ok) ? resu : resu);
    process.exit(0);
  } catch (e) {
    console.error('Failed to refresh fixture events:', e && (e.response && e.response.data) ? e.response.data : (e.message || e));
    process.exit(1);
  }
}

main();
