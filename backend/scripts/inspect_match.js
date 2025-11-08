// inspect_match.js
const { connectDB, closeDB } = require('../db/connect');
const Match = require('../models/Match');

async function main(matchId) {
  const mongo = process.env.DBURI || process.env.MONGO_URI || process.env.MONGOURL;
  if (!mongo) {
    console.error('No DBURI provided');
    process.exit(2);
  }
  await connectDB(mongo);
  try {
    const d = await Match.findOne({ match_id: Number(matchId) }).lean();
    console.log(JSON.stringify(d, null, 2));
  } catch (e) {
    console.error('inspect failed', e.message || e);
  } finally {
    await closeDB();
  }
}

if (require.main === module) {
  const mid = process.argv[2] || 19431876;
  main(mid);
}
