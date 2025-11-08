// find_matches_swansea.js
const { connectDB, closeDB } = require('../db/connect');
const Match = require('../models/Match');

async function main() {
  const mongo = process.env.DBURI || process.env.MONGO_URI || process.env.MONGOURL;
  if (!mongo) {
    console.error('No DBURI provided');
    process.exit(2);
  }
  await connectDB(mongo);
  try {
    const docs = await Match.find({
      $or: [ { 'teams.home.team_id': 65 }, { 'teams.away.team_id': 65 } ],
      $or: [
        { 'teams.home.team_name': { $regex: /swansea/i } },
        { 'teams.away.team_name': { $regex: /swansea/i } },
        { home_team: { $regex: /swansea/i } },
        { away_team: { $regex: /swansea/i } }
      ]
    }).lean().sort({ date: -1 }).limit(50);

    console.log('found', docs.length);
    for (const d of docs) {
      console.log(d.match_id, d.date, d.home_team, d.away_team, d.match_status && d.match_status.state, d.score);
    }
  } catch (e) {
    console.error('find failed', e.message || e);
  } finally {
    await closeDB();
  }
}

if (require.main === module) main();
