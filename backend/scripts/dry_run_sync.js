// dry_run_sync.js
// Usage: node backend/scripts/dry_run_sync.js <match_id>
// Connects to DB, calls syncFinishedMatch but intercepts the DB update and prints the payload.
const path = require('path');
// Load the backend-local .env so DB and provider tokens are available
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { connectDB, closeDB } = require('../db/connect');
const Match = require('../models/Match');
// We'll require the controller after we stub any offline helpers so its internal
// sportmonks binding picks up our stub when running in fixture mode.


async function main() {
  const matchId = process.argv[2];
  if (!matchId) {
    console.error('Usage: node backend/scripts/dry_run_sync.js <match_id>');
    process.exit(1);
  }

  // Attempt DB connect; if not available, run in offline fixture mode
  const hasDb = !!(process.env.DBURI || process.env.MONGO_URI || process.env.MONGO_URL);
  let origFindOneAndUpdate;
  if (hasDb) {
    try {
      await connectDB(process.env.DBURI || process.env.MONGO_URI || process.env.MONGO_URL);
    } catch (e) {
      console.error('Could not connect to DB:', e.message || e);
      process.exit(1);
    }
    // keep original method to restore later
    origFindOneAndUpdate = Match.findOneAndUpdate.bind(Match);

    // Override to print the update payload instead of writing
    Match.findOneAndUpdate = async function(filter, update, opts) {
      try {
        console.log('\n=== DRY-RUN: Intercepted Match.findOneAndUpdate ===');
        console.log('Filter:', JSON.stringify(filter, null, 2));
        if (update && update.$set) {
          console.log('Would $set the following keys:');
          console.log(JSON.stringify(update.$set, null, 2));
        } else {
          console.log('Would perform update:', JSON.stringify(update, null, 2));
        }
      } catch (e) {
        console.warn('Error printing update payload:', e.message || e);
      }
      // return the existing match document as a no-op result
      return Match.findOne(filter);
    };
  } else {
    console.log('DB not configured, running dry-run in offline fixture mode.');
    // stub Match.findOne to return a minimal match doc
    Match.findOne = async function(filter) {
      return { match_id: Number(matchId), player_ratings: [], lineup: { home: [], away: [] } };
    };
    // stub Match.findOneAndUpdate to print payload
    Match.findOneAndUpdate = async function(filter, update) {
      console.log('\n=== DRY-RUN (fixture): Intercepted Match.findOneAndUpdate ===');
      console.log('Filter:', JSON.stringify(filter, null, 2));
      if (update && update.$set) {
        console.log('Would $set the following keys:');
        console.log(JSON.stringify(update.$set, null, 2));
      } else {
        console.log('Would perform update:', JSON.stringify(update, null, 2));
      }
      return Match.findOne(filter);
    };

    // stub utils/sportmonks.get to return our fixture so fetchMatchStats resolves locally
    const fixture = require('./fixtures/smMatch_19431868.json');
    const sm = require('../utils/sportmonks');
    sm.get = async function(path, params) {
      console.log('[dry-run] stubbed sportmonks.get called for', path, params);
      return { data: { data: fixture } };
    };
    // also stub controller.fetchMatchStats so the controller uses fixture directly
    // require controller after stubbing sportmonks so it binds to our stub
    const controller = require('../controllers/matchSyncController');
    controller.fetchMatchStats = async function() { return fixture; };
    // update local reference to syncFinishedMatch
    // eslint-disable-next-line prefer-destructuring
    syncFinishedMatch = controller.syncFinishedMatch;
  }

  try {
    console.log(`Running dry sync for match ${matchId} (no writes will be performed)`);
    // require controller when running with DB as well (safe)
    if (hasDb) {
      const controller = require('../controllers/matchSyncController');
      // eslint-disable-next-line prefer-destructuring
      syncFinishedMatch = controller.syncFinishedMatch;
    }
    await syncFinishedMatch(Number(matchId));
    console.log('Dry-run complete.');
  } catch (e) {
    console.error('syncFinishedMatch failed during dry-run:', e?.message || e);
  } finally {
    // restore original
    Match.findOneAndUpdate = origFindOneAndUpdate;
    await closeDB();
  }
}

main();
