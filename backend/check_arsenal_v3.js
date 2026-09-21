// Diagnostic v3: uses the real Match schema (nested teams/match_info/match_status)
const mongoose = require('mongoose');
const Match = require('./models/Match');

const uri = process.env.DBURI || 'mongodb+srv://admin:AeFu-cwqPDCdc49@cluster0.4fdbxhw.mongodb.net/fulltime?retryWrites=true&w=majority&appName=thefinalplay';

const fmt = (m) => {
  const home = m.teams?.home?.team_name || '?';
  const away = m.teams?.away?.team_name || '?';
  const date = m.match_info?.starting_at || m.date;
  const status = m.match_status?.short_name || m.match_status?.state || m.match_status?.name || '?';
  const league = m.match_info?.league ? `${m.match_info.league.id} ${m.match_info.league.name}` : '?';
  const season = m.match_info?.season?.name || m.match_info?.season?.id || '?';
  return `${date} | ${home} vs ${away} | status=${status} | league=${league} | season=${season} | id=${m.match_id}`;
};

mongoose.connect(uri).then(async () => {
  try {
    // 1. Arsenal matches (most recent 12)
    const arsenal = await Match.find({
      $or: [
        { 'teams.home.team_name': /Arsenal/i },
        { 'teams.away.team_name': /Arsenal/i }
      ]
    }).sort({ 'match_info.starting_at': -1 }).limit(12).lean();
    console.log('=== 12 most recent Arsenal matches ===');
    arsenal.forEach(m => console.log(fmt(m)));

    // 2. Coventry City matches
    const cov = await Match.find({
      $or: [
        { 'teams.home.team_name': /Coventry/i },
        { 'teams.away.team_name': /Coventry/i }
      ]
    }).sort({ 'match_info.starting_at': -1 }).limit(10).lean();
    console.log('\n=== Coventry City matches (10 most recent) ===');
    if (!cov.length) console.log('(none found)');
    cov.forEach(m => console.log(fmt(m)));

    // 3. Radomiak Radom matches involving/against Arsenal would be cross-comp, list all
    const rad = await Match.find({
      $or: [
        { 'teams.home.team_name': /Radomiak/i },
        { 'teams.away.team_name': /Radomiak/i }
      ]
    }).sort({ 'match_info.starting_at': -1 }).limit(6).lean();
    console.log('\n=== Radomiak Radom matches (6 most recent) ===');
    if (!rad.length) console.log('(none found)');
    rad.forEach(m => console.log(fmt(m)));

    // 4. Arsenal vs Coventry specifically
    const avc = await Match.find({
      $or: [
        { 'teams.home.team_name': /Arsenal/i, 'teams.away.team_name': /Coventry/i },
        { 'teams.home.team_name': /Coventry/i, 'teams.away.team_name': /Arsenal/i }
      ]
    }).lean();
    console.log('\n=== Arsenal vs Coventry fixtures ===');
    if (!avc.length) console.log('(none found)');
    avc.forEach(m => console.log(fmt(m)));

    // 5. Upcoming Premier League (league id 8) fixtures from today
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const upcoming = await Match.find({
      'match_info.league.id': 8,
      'match_info.starting_at': { $gte: now }
    }).sort({ 'match_info.starting_at': 1 }).limit(20).lean();
    console.log('\n=== Upcoming Premier League fixtures in DB (from today) ===');
    if (!upcoming.length) console.log('(none found)');
    upcoming.forEach(m => console.log(fmt(m)));

    // 6. What PL seasons exist
    const seasons = await Match.aggregate([
      { $match: { 'match_info.league.id': 8 } },
      { $group: { _id: { id: '$match_info.season.id', name: '$match_info.season.name' }, count: { $sum: 1 } } },
      { $sort: { '_id.id': -1 } }
    ]);
    console.log('\n=== Premier League seasons in DB ===');
    if (!seasons.length) console.log('(none)');
    seasons.forEach(s => console.log(`season ${s._id.id} (${s._id.name || 'no name'}): ${s.count} fixtures`));
  } catch (e) {
    console.error('Query error:', e);
  } finally {
    await mongoose.disconnect();
  }
}).catch(e => { console.error('Connection error:', e.message); process.exit(1); });
