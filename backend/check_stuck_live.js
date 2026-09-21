// Find all matches stuck in a live state whose kickoff is in the past (stale "live" docs)
const mongoose = require('mongoose');
const Match = require('./models/Match');

const uri = process.env.DBURI || 'mongodb+srv://admin:AeFu-cwqPDCdc49@cluster0.4fdbxhw.mongodb.net/fulltime?retryWrites=true&w=majority&appName=thefinalplay';

const LIVE = ['live', '1H', '2H', 'HT', 'INPLAY_1ST_HALF', 'INPLAY_2ND_HALF', 'INPLAY_HALF_TIME', 'LIVE', 'ET', 'BT', 'P', 'SUSP'];

mongoose.connect(uri).then(async () => {
  try {
    const now = new Date();
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);

    const stuck = await Match.find({
      'match_status.state': { $in: LIVE },
      'match_info.starting_at': { $lt: threeHoursAgo }
    })
    .select('match_id teams match_info.starting_at match_status')
    .sort({ 'match_info.starting_at': 1 })
    .lean();

    console.log(`=== Matches with LIVE-ish state but kickoff >3h ago (${stuck.length}) ===`);
    stuck.forEach(m => console.log(`  ${m.match_info?.starting_at} | ${m.teams?.home?.team_name} vs ${m.teams?.away?.team_name} | state=${m.match_status?.state} | id=${m.match_id}`));
  } catch (e) {
    console.error('Query error:', e.message);
  } finally {
    await mongoose.disconnect();
  }
}).catch(e => { console.error('Connection error:', e.message); process.exit(1); });
