// scripts/run_sync_match.js
// Simple runner to call syncFinishedMatch for a single match id.

require('dotenv').config();
const path = require('path');
const connectDB = require('../db/connect');
const { syncFinishedMatch } = require('../controllers/matchSyncController');

async function main() {
  const MONGOURI = process.env.DBURI || "mongodb://localhost:27017/test";
  try {
    await connectDB(MONGOURI);
    console.log('DB connected. Running syncFinishedMatch for 19431825');
  const updated = await syncFinishedMatch(19431825, { forFinished: true });
    if (updated && updated.match_id) {
      console.log(`updated match ${updated.match_id}`);
      // fetch fresh and print lineup summary
      const Match = require('../models/Match');
      const m = await Match.findOne({ match_id: 19431825 }).lean();
      console.log('lineup.home length:', (m.lineup && m.lineup.home) ? m.lineup.home.length : 0);
      console.log('lineup.away length:', (m.lineup && m.lineup.away) ? m.lineup.away.length : 0);
      console.log('sample home entries:', (m.lineup && m.lineup.home) ? m.lineup.home.slice(0,3) : []);
      console.log('sample away entries:', (m.lineup && m.lineup.away) ? m.lineup.away.slice(0,3) : []);
    } else {
      console.log('syncFinishedMatch result: no update');
    }
    process.exit(0);
  } catch (e) {
    console.error('runner error:', e?.message || e);
    process.exit(1);
  }
}

main();
