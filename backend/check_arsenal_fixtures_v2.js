// Diagnostic v2: inspect raw document structure for Arsenal matches
const mongoose = require('mongoose');
const Match = require('./models/Match');

const uri = process.env.DBURI || 'mongodb+srv://admin:AeFu-cwqPDCdc49@cluster0.4fdbxhw.mongodb.net/fulltime?retryWrites=true&w=majority&appName=thefinalplay';

mongoose.connect(uri).then(async () => {
  try {
    // Find Arsenal matches by name (team ids vary by provider)
    const arsenal = await Match.find({
      $or: [
        { home_team: /Arsenal/i },
        { away_team: /Arsenal/i },
        { 'teams.home.name': /Arsenal/i },
        { 'teams.away.name': /Arsenal/i }
      ]
    }).sort({ date: -1 }).limit(12).lean();

    console.log('=== 12 most recent Arsenal matches ===');
    arsenal.forEach(m => {
      const home = m.home_team || m.teams?.home?.name;
      const away = m.away_team || m.teams?.away?.name;
      const status = m.status_short || m.status || m.match_status?.short_name || m.match_status?.name;
      const leagueId = m.league_id || m.league?.id || m.match_info?.league?.id;
      const leagueName = m.league?.name || m.match_info?.league?.name;
      const seasonId = m.season_id || m.match_info?.season_id || m.match_info?.season?.id;
      const date = m.date || m.match_info?.starting_at;
      console.log(`${date} | ${home} vs ${away} | status=${status} | league=${leagueId} ${leagueName || ''} | season=${seasonId} | match_id=${m.match_id}`);
    });

    // Print the raw structure of the most recent one to understand the schema
    if (arsenal.length > 0) {
      console.log('\n=== Raw doc keys (most recent Arsenal match) ===');
      const raw = arsenal[0];
      console.log('Top-level keys:', Object.keys(raw).join(', '));
      if (raw.match_info) console.log('match_info keys:', Object.keys(raw.match_info).join(', '));
      if (raw.match_info?.league) console.log('match_info.league:', JSON.stringify(raw.match_info.league));
      if (raw.match_status) console.log('match_status:', JSON.stringify(raw.match_status));
    }

    // Coventry matches
    const cov = await Match.find({
      $or: [
        { home_team: /Coventry/i }, { away_team: /Coventry/i },
        { 'teams.home.name': /Coventry/i }, { 'teams.away.name': /Coventry/i }
      ]
    }).sort({ date: -1 }).limit(10).lean();
    console.log('\n=== Coventry City matches ===');
    if (!cov.length) console.log('(none found)');
    cov.forEach(m => {
      const home = m.home_team || m.teams?.home?.name;
      const away = m.away_team || m.teams?.away?.name;
      const status = m.status_short || m.status || m.match_status?.short_name || m.match_status?.name;
      const leagueId = m.league_id || m.league?.id || m.match_info?.league?.id;
      const date = m.date || m.match_info?.starting_at;
      console.log(`${date} | ${home} vs ${away} | status=${status} | league=${leagueId} | match_id=${m.match_id}`);
    });

    // Any match containing both Arsenal and Coventry
    const avsC = await Match.find({
      $or: [
        { home_team: /Arsenal/i, away_team: /Coventry/i },
        { home_team: /Coventry/i, away_team: /Arsenal/i },
        { 'teams.home.name': /Arsenal/i, 'teams.away.name': /Coventry/i },
        { 'teams.home.name': /Coventry/i, 'teams.away.name': /Arsenal/i }
      ]
    }).lean();
    console.log('\n=== Arsenal vs Coventry fixtures ===');
    if (!avsC.length) console.log('(none found)');
    avsC.forEach(m => {
      const home = m.home_team || m.teams?.home?.name;
      const away = m.away_team || m.teams?.away?.name;
      const date = m.date || m.match_info?.starting_at;
      console.log(`${date} | ${home} vs ${away} | match_id=${m.match_id} | league=${m.league_id || m.match_info?.league?.id} season=${m.season_id || m.match_info?.season_id}`);
    });

    // Upcoming PL fixtures (league id 8) — try both storage shapes
    const now = new Date(); now.setHours(0,0,0,0);
    const upcoming = await Match.find({
      $or: [ { league_id: 8 }, { 'league.id': 8 }, { 'match_info.league.id': 8 } ],
      $and: [ { $or: [ { date: { $gte: now } }, { 'match_info.starting_at': { $gte: now } } ] } ]
    }).sort({ date: 1 }).limit(20).lean();
    console.log('\n=== Upcoming PL fixtures in DB (league 8, from today) ===');
    if (!upcoming.length) console.log('(none found)');
    upcoming.forEach(m => {
      const home = m.home_team || m.teams?.home?.name;
      const away = m.away_team || m.teams?.away?.name;
      const date = m.date || m.match_info?.starting_at;
      console.log(`${date} | ${home} vs ${away} | status=${m.status_short || m.match_status?.short_name || m.status}`);
    });

    // Distinct PL seasons
    const s1 = await Match.distinct('season_id', { league_id: 8 });
    const s2 = await Match.distinct('match_info.season_id', { 'match_info.league.id': 8 });
    console.log('\n=== PL seasons ===');
    console.log('season_id field:', s1);
    console.log('match_info.season_id field:', s2);
  } catch (e) {
    console.error('Query error:', e);
  } finally {
    await mongoose.disconnect();
  }
}).catch(e => { console.error('Connection error:', e.message); process.exit(1); });
