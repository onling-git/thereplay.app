// Diagnostic v5b: understand the null league/season problem (string-safe)
const mongoose = require('mongoose');
const Match = require('./models/Match');

const uri = process.env.DBURI || 'mongodb+srv://admin:AeFu-cwqPDCdc49@cluster0.4fdbxhw.mongodb.net/fulltime?retryWrites=true&w=majority&appName=thefinalplay';

mongoose.connect(uri).then(async () => {
  try {
    const AUG = new Date('2026-08-01');
    const JUN = new Date('2027-06-30');
    const NOW = new Date();

    const withLeague = await Match.countDocuments({
      'match_info.starting_at': { $gte: AUG, $lte: JUN },
      'match_info.league.id': 8
    });
    const nullLeague = await Match.countDocuments({
      'match_info.starting_at': { $gte: AUG, $lte: JUN },
      $or: [{ 'match_info.league': null }, { 'match_info.league': { $exists: false } }]
    });
    console.log('26/27 window (Aug26-Jun27):');
    console.log('  with match_info.league.id = 8 :', withLeague);
    console.log('  with match_info.league = null:', nullLeague);

    const earliest = await Match.find({ 'match_info.league.id': 8, 'match_info.starting_at': { $gte: AUG } })
      .sort({ 'match_info.starting_at': 1 }).limit(5).lean();
    console.log('\nEarliest PL (league.id=8) fixtures from Aug 2026:');
    if (!earliest.length) console.log('  (none)');
    earliest.forEach(m => console.log(`  ${m.match_info.starting_at} | ${m.teams?.home?.team_name} vs ${m.teams?.away?.team_name} | season=${m.match_info?.season?.name}`));

    const nextAny = await Match.find({ 'match_info.starting_at': { $gte: NOW }, 'match_info.league.id': { $ne: null } })
      .sort({ 'match_info.starting_at': 1 }).limit(10).lean();
    console.log('\nNext 10 fixtures (any league, league set) from today:');
    if (!nextAny.length) console.log('  (none)');
    nextAny.forEach(m => console.log(`  ${m.match_info.starting_at} | ${m.teams?.home?.team_name} vs ${m.teams?.away?.team_name} | league=${m.match_info?.league?.id} ${m.match_info?.league?.name} | season=${m.match_info?.season?.name}`));

    const nextNull = await Match.find({ 'match_info.starting_at': { $gte: NOW }, $or: [{ 'match_info.league': null }, { 'match_info.league': { $exists: false } }] })
      .sort({ 'match_info.starting_at': 1 }).limit(10).lean();
    console.log('\nNext 10 fixtures from today with league NULL:');
    if (!nextNull.length) console.log('  (none)');
    nextNull.forEach(m => console.log(`  ${m.match_info.starting_at} | ${m.teams?.home?.team_name} vs ${m.teams?.away?.team_name} | season=${m.match_info?.season?.name || 'null'} | id=${m.match_id}`));
  } catch (e) {
    console.error('Query error:', e.message);
  } finally {
    await mongoose.disconnect();
  }
}).catch(e => { console.error('Connection error:', e.message); process.exit(1); });
