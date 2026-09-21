// Check Man Utd's matches in the DB — future ones
const mongoose = require('mongoose');
const Match = require('./models/Match');

const uri = process.env.DBURI || 'mongodb+srv://admin:AeFu-cwqPDCdc49@cluster0.4fdbxhw.mongodb.net/fulltime?retryWrites=true&w=majority&appName=thefinalplay';

mongoose.connect(uri).then(async () => {
  try {
    // Man Utd team id = find via a known doc or query by name
    const teamQuery = {
      $or: [
        { 'teams.home.team_name': /Manchester United/i },
        { 'teams.away.team_name': /Manchester United/i }
      ]
    };

    const now = new Date();
    const future = await Match.find({
      $and: [ teamQuery, { 'match_info.starting_at': { $gt: now } } ]
    }).sort({ 'match_info.starting_at': 1 }).limit(8).lean();

    console.log('=== Man Utd future fixtures (Date-typed starting_at) ===');
    if (!future.length) console.log('(none)');
    future.forEach(m => console.log(`  ${m.match_info.starting_at} | ${m.teams?.home?.team_name} vs ${m.teams?.away?.team_name} | status=${m.match_status?.state || m.match_status?.short_name} | id=${m.match_id}`));

    // Also look for docs matched via the legacy `date` field or non-Date starting_at
    const legacyFuture = await Match.find({
      $and: [
        teamQuery,
        { date: { $gt: now } },
        { $or: [{ 'match_info.starting_at': { $exists: false } }, { 'match_info.starting_at': null }] }
      ]
    }).sort({ date: 1 }).limit(8).lean();
    console.log('\n=== Man Utd future fixtures (legacy date-only docs) ===');
    if (!legacyFuture.length) console.log('(none)');
    legacyFuture.forEach(m => console.log(`  date=${m.date} | starting_at=${m.match_info?.starting_at} (${typeof m.match_info?.starting_at}) | ${m.teams?.home?.team_name} vs ${m.teams?.away?.team_name} | id=${m.match_id}`));

    // What about the Brentford April match specifically
    const brentfordApril = await Match.find({
      $and: [ teamQuery, { 'teams.home.team_name': /Brentford/i } ]
    }).sort({ 'match_info.starting_at': 1 }).limit(3).lean();
    const brentfordApril2 = await Match.find({
      $and: [ teamQuery, { 'teams.away.team_name': /Brentford/i } ]
    }).sort({ 'match_info.starting_at': 1 }).limit(3).lean();
    console.log('\n=== Man Utd vs Brentford docs ===');
    [...brentfordApril, ...brentfordApril2].forEach(m => console.log(`  ${m.match_info?.starting_at} (${typeof m.match_info?.starting_at}) | ${m.teams?.home?.team_name} vs ${m.teams?.away?.team_name} | status=${m.match_status?.state} | id=${m.match_id}`));

    // Hull today
    const hullToday = await Match.find({
      $and: [ teamQuery, { 'teams.home.team_name': /Hull/i } ]
    }).lean();
    const hullToday2 = await Match.find({
      $and: [ teamQuery, { 'teams.away.team_name': /Hull/i } ]
    }).lean();
    console.log('\n=== Man Utd vs Hull docs ===');
    [...hullToday, ...hullToday2].forEach(m => console.log(`  ${m.match_info?.starting_at} (${typeof m.match_info?.starting_at}) | ${m.teams?.home?.team_name} vs ${m.teams?.away?.team_name} | status=${m.match_status?.state} | id=${m.match_id}`));
  } catch (e) {
    console.error('Query error:', e.message);
  } finally {
    await mongoose.disconnect();
  }
}).catch(e => { console.error('Connection error:', e.message); process.exit(1); });
