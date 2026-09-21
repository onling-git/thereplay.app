// Diagnostic v5: understand the null league/season problem across seasons
const mongoose = require('mongoose');
const Match = require('./models/Match');

const uri = process.env.DBURI || 'mongodb+srv://admin:AeFu-cwqPDCdc49@cluster0.4fdbxhw.mongodb.net/fulltime?retryWrites=true&w=majority&appName=thefinalplay';

mongoose.connect(uri).then(async () => {
  try {
    // Count fixtures by whether league is set, grouped by rough date
    const stats = await Match.aggregate([
      {
        $project: {
          year: { $year: '$match_info.starting_at' },
          month: { $month: '$match_info.starting_at' },
          hasLeague: { $cond: [{ $eq: ['$match_info.league', null] }, 'null', 'set'] },
          leagueId: '$match_info.league.id'
        }
      },
      {
        $group: {
          _id: { year: '$year', hasLeague: '$hasLeague' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1 } }
    ]);
    console.log('=== Fixtures by year / league presence ===');
    stats.forEach(s => console.log(`year=${s._id.year} league=${s._id.hasLeague} count=${s.count}`));

    // Count fixtures in 2026/2027 PL (by date range Aug 2026 - May 2027) with league set vs null
    const s2627withLeague = await Match.countDocuments({
      'match_info.starting_at': { $gte: new Date('2026-08-01'), $lte: new Date('2027-06-30') },
      'match_info.league.id': 8
    });
    const s2627nullLeague = await Match.countDocuments({
      'match_info.starting_at': { $gte: new Date('2026-08-01'), $lte: new Date('2027-06-30') },
      'match_info.league': null,
      // heuristic: PL teams - Arsenal involved
      $or: [{ 'teams.home.team_name': /Arsenal/i }, { 'teams.away.team_name': /Arsenal/i }]
    });
    console.log('\n26/27 window with league.id=8:', s2627withLeague);
    console.log('26/27 window Arsenal fixtures with league=null:', s2627nullLeague);

    // Sample a few 26/27 PL fixtures that DO have league set — check the date range actually imported
    const withLeague = await Match.find({ 'match_info.league.id': 8, 'match_info.starting_at': { $gte: new Date('2026-08-01') } })
      .sort({ 'match_info.starting_at': 1 }).limit(5).lean();
    console.log('\n=== Earliest PL (league.id=8) fixtures from Aug 2026 ===');
    if (!withLeague.length) console.log('(none)');
    withLeague.forEach(m => console.log(`${m.match_info.starting_at} | ${m.teams?.home?.team_name} vs ${m.teams?.away?.team_name} | season=${m.match_info?.season?.name}`));

    // Find what the upcoming fixtures look like with league set, any league
    const anyUpcoming = await Match.find({ 'match_info.starting_at': { $gte: new Date('2026-08-21') }, 'match_info.league.id': { $ne: null } })
      .sort({ 'match_info.starting_at': 1 }).limit(10).lean();
    console.log('\n=== Next 10 fixtures (any league, league set) from today ===');
    if (!anyUpcoming.length) console.log('(none)');
    anyUpcoming.forEach(m => console.log(`${m.match_info.starting_at} | ${m.teams?.home?.team_name} vs ${m.teams?.away?.team_name} | league=${m.match_info?.league?.id} ${m.match_info?.league?.name} | season=${m.match_info?.season?.name}`));
  } catch (e) {
    console.error('Query error:', e);
  } finally {
    await mongoose.disconnect();
  }
}).catch(e => { console.error('Connection error:', e.message); process.exit(1); });
