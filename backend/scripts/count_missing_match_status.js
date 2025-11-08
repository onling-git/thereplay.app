require('dotenv').config({ path: require('path').resolve(__dirname,'..','.env') });
const connect = require('../db/connect');
const Match = require('../models/Match');

(async ()=>{
  try {
    await connect(process.env.DBURI || process.env.MONGO_URL || process.env.MONGODB_URI);
  // Consider a match "missing" only when the match_status field is absent.
  // The backfill may write an empty object for fixtures where the provider has no state;
  // treating presence of the field as "processed" prevents a single empty doc from
  // blocking completion of the automated backfill loop.
  const q = { 'match_status': { $exists: false } };
  const c = await Match.countDocuments(q);
    console.log('remainingMatches', c);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
