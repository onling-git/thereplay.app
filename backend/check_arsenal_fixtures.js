// Diagnostic: check Arsenal fixtures, Coventry/Radomiak matches, upcoming PL fixtures
const mongoose = require('mongoose');
const Match = require('./models/Match');

const uri = process.env.DBURI || 'mongodb+srv://admin:AeFu-cwqPDCdc49@cluster0.4fdbxhw.mongodb.net/fulltime?retryWrites=true&w=majority&appName=thefinalplay';

mongoose.connect(uri).then(async () => {
  try {
    // All Arsenal matches (SportMonks team id for Arsenal = 19)
    const arsenal = await Match.find({ $or: [{ home_team_id: 19 }, { away_team_id: 19 }] })
      .sort({ date: -1 }).limit(12).lean();
    console.log('=== 12 most recent Arsenal matches in DB ===');
    arsenal.forEach(m => console.log(
      `${m.date} | ${m.home_team} vs ${m.away_team} | status=${m.status_short || m.status} | league_id=${m.league_id} | season=${m.season_id} | match_id=${m.match_id}`
    ));

    // Anything involving Coventry or Radomiak
    const named = await Match.find({
      $or: [{ home_team: /Coventry|Radomiak/i }, { away_team: /Coventry|Radomiak/i }]
    }).sort({ date: -1 }).limit(10).lean();
    console.log('\n=== Coventry / Radomiak matches ===');
    if (named.length === 0) console.log('(none found)');
    named.forEach(m => console.log(
      `${m.date} | ${m.home_team} vs ${m.away_team} | status=${m.status_short || m.status} | league_id=${m.league_id} | season=${m.season_id} | match_id=${m.match_id}`
    ));

    // Premier League fixtures from today onward
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const upcoming = await Match.find({ league_id: 8, date: { $gte: now } }).sort({ date: 1 }).limit(20).lean();
    console.log('\n=== Upcoming Premier League fixtures in DB ===');
    if (upcoming.length === 0) console.log('(none found)');
    upcoming.forEach(m => console.log(
      `${m.date} | ${m.home_team} vs ${m.away_team} | status=${m.status_short || m.status} | season=${m.season_id}`
    ));

    // Season IDs that exist for the PL
    const seasons = await Match.distinct('season_id', { league_id: 8 });
    console.log('\n=== PL season_ids present in DB ===', seasons);

    // Count of PL fixtures per season
    for (const s of seasons) {
      const c = await Match.countDocuments({ league_id: 8, season_id: s });
      console.log(`  season ${s}: ${c} fixtures`);
    }
  } catch (e) {
    console.error('Query error:', e);
  } finally {
    await mongoose.disconnect();
  }
}).catch(e => { console.error('Connection error:', e); process.exit(1); });
