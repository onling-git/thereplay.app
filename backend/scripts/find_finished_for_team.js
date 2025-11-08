// find_finished_for_team.js
const { connectDB, closeDB } = require('../db/connect');
const Match = require('../models/Match');

async function main(teamId) {
  const mongo = process.env.DBURI || process.env.MONGO_URI || process.env.MONGOURL;
  if (!mongo) {
    console.error('No DBURI'); process.exit(2);
  }
  await connectDB(mongo);
  try {
    const regex = /finished|fulltime|ft/i;
    const docs = await Match.find({
      $and: [
        { $or: [ { 'teams.home.team_id': Number(teamId) }, { 'teams.away.team_id': Number(teamId) } ] },
        { $or: [
          { 'match_status.state': { $regex: regex } },
          { 'match_status.name': { $regex: regex } },
          { 'match_status.short_name': { $regex: regex } },
          { status: { $regex: regex } }
        ] }
      ]
    }).lean().sort({ date: -1 }).limit(20);
    console.log('found finished', docs.length);
    for (const d of docs) console.log(d.match_id, d.date, d.teams?.home?.team_name, d.teams?.away?.team_name, d.match_status);
  } catch (e) {
    console.error('err', e.message || e);
  } finally { await closeDB(); }
}
if (require.main === module) main(process.argv[2] || 65);
