// Check per-league metadata completeness in the 26/27 window
const mongoose = require('mongoose');
const Match = require('./models/Match');

const uri = process.env.DBURI || 'mongodb+srv://admin:AeFu-cwqPDCdc49@cluster0.4fdbxhw.mongodb.net/fulltime?retryWrites=true&w=majority&appName=thefinalplay';

const AUG = new Date('2026-08-01');
const JUN = new Date('2027-06-30');

mongoose.connect(uri).then(async () => {
  try {
    // Per-league counts of fixtures WITH league.id set, in 26/27 window
    const withLeague = await Match.aggregate([
      { $match: { 'match_info.starting_at': { $gte: AUG, $lte: JUN }, 'match_info.league.id': { $ne: null } } },
      { $group: { _id: '$match_info.league.id', name: { $first: '$match_info.league.name' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    console.log('=== 26/27 window: fixtures WITH match_info.league.id set (per league) ===');
    if (!withLeague.length) console.log('(none)');
    withLeague.forEach(l => console.log(`  league ${l._id} (${l.name || '?'}): ${l.count}`));

    // Championship specifically (league 9)
    const champ = await Match.find({ 'match_info.league.id': 9, 'match_info.starting_at': { $gte: AUG, $lte: JUN } })
      .sort({ 'match_info.starting_at': 1 }).limit(5).lean();
    console.log('\n=== Championship (league 9) fixtures in 26/27 window ===');
    if (!champ.length) console.log('(none with league.id=9)');
    champ.forEach(m => console.log(`  ${m.match_info.starting_at} | ${m.teams?.home?.team_name} vs ${m.teams?.away?.team_name} | season=${m.match_info?.season?.name} | status=${m.match_status?.short_name || m.match_status?.state || 'empty'}`));

    // Are there Championship-named fixtures with NULL league in that window? (i.e. championship teams by name)
    const champTeamsNull = await Match.countDocuments({
      'match_info.starting_at': { $gte: AUG, $lte: JUN },
      $or: [{ 'match_info.league': null }, { 'match_info.league.id': null }],
      $or: [{ 'teams.home.team_name': /Coventry|Leicester|Ipswich|Southampton|Leeds/i }, { 'teams.away.team_name': /Coventry|Leicester|Ipswich|Southampton|Leeds/i }]
    });
    console.log('\nChampionship-team fixtures in window with NULL league:', champTeamsNull);

    // Distinct season names present where league IS set in window
    const seasons = await Match.distinct('match_info.season.name', { 'match_info.starting_at': { $gte: AUG, $lte: JUN }, 'match_info.league.id': { $ne: null } });
    console.log('\nSeason names where league is set in window:', seasons);
  } catch (e) {
    console.error('Query error:', e.message);
  } finally {
    await mongoose.disconnect();
  }
}).catch(e => { console.error('Connection error:', e.message); process.exit(1); });
