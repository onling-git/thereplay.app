require('dotenv').config();
const mongoose = require('mongoose');
const { syncFinishedMatch } = require('../controllers/matchSyncController');

async function main() {
  await mongoose.connect(process.env.MONGO_URI || process.env.DBURI, { dbName: process.env.DBNAME || undefined });
  try {
    const matchId = Number(process.argv[2] || process.env.INSPECT_MATCH_ID);
    if (!matchId) throw new Error('missing match id');
  const updated = await syncFinishedMatch(matchId, { forFinished: true });
    console.log('syncFinishedMatch completed for', matchId);
    console.log('Updated match id:', updated && updated.match_id);
  } catch (e) {
    console.error('error:', e.message || e);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
