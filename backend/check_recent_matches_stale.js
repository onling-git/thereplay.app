// Diagnostic: why do "recent matches" stop at early September for Arsenal/Southampton?
// READ-ONLY queries against the DB.
const mongoose = require('mongoose');
const Match = require('./models/Match');

const uri = process.env.DBURI || 'mongodb+srv://admin:AeFu-cwqPDCdc49@cluster0.4fdbxhw.mongodb.net/fulltime?retryWrites=true&w=majority&appName=thefinalplay';

mongoose.connect(uri).then(async () => {
  try {
    const cutoff = new Date('2026-08-20T00:00:00Z');

    const dump = (label, matches) => {
      console.log(`\n=== ${label} (${matches.length}) ===`);
      if (matches.length === 0) console.log('(none found)');
      matches.forEach(m => {
        const st = m.match_status || {};
        console.log(
          `${m.match_info?.starting_at || m.date} | ${m.home_team || m.teams?.home?.team_name} vs ${m.away_team || m.teams?.away?.team_name}` +
          ` | state=${st.state || m.status_short || m.status} | league=${m.match_info?.league?.name || m.league_id}` +
          ` | season(info)=${m.match_info?.season?.id} season(top)=${m.season_id ?? m.season?.id} | match_id=${m.match_id}`
        );
      });
    };

    // Arsenal (SportMonks id 19) - everything since cutoff, newest first
    const arsenal = await Match.find({
      $and: [
        { $or: [{ home_team_id: 19 }, { away_team_id: 19 }, { 'teams.home.team_id': 19 }, { 'teams.away.team_id': 19 }, { home_team: /arsenal/i }, { away_team: /arsenal/i }] },
        { $or: [{ 'match_info.starting_at': { $gte: cutoff } }, { date: { $gte: cutoff } }] }
      ]
    }).sort({ 'match_info.starting_at': -1, date: -1 }).limit(20).lean();
    dump('Arsenal matches since 2026-08-20', arsenal);

    // Southampton - everything since cutoff
    const soton = await Match.find({
      $and: [
        { $or: [{ home_team: /southampton/i }, { away_team: /southampton/i }, { 'teams.home.team_slug': 'southampton' }, { 'teams.away.team_slug': 'southampton' }] },
        { $or: [{ 'match_info.starting_at': { $gte: cutoff } }, { date: { $gte: cutoff } }] }
      ]
    }).sort({ 'match_info.starting_at': -1, date: -1 }).limit(20).lean();
    dump('Southampton matches since 2026-08-20', soton);

    // Global: newest matches in the whole DB (did sync stop entirely?)
    const newest = await Match.find({}).sort({ 'match_info.starting_at': -1, date: -1 }).limit(8).lean();
    dump('Newest matches in entire DB (any team)', newest);

    // Newest FINISHED match in the whole DB
    const finishedState = /^(finished|ft|ended|full-time|full time)$/i;
    const newestFinished = await Match.find({ 'match_status.state': finishedState }).sort({ 'match_info.starting_at': -1, date: -1 }).limit(5).lean();
    dump('Newest FINISHED matches in entire DB', newestFinished);

    // Distinct status states seen on matches after Sept 1
    const states = await Match.distinct('match_status.state', { date: { $gte: new Date('2026-09-01T00:00:00Z') } });
    console.log('\n=== match_status.state values on matches dated >= 2026-09-01 ===');
    console.log(states);
  } catch (e) {
    console.error('Query error:', e);
  } finally {
    await mongoose.disconnect();
  }
}).catch(e => { console.error('Connection error:', e); process.exit(1); });
