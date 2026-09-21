// Diagnostic v4: inspect raw league/season/status fields
const mongoose = require('mongoose');
const Match = require('./models/Match');

const uri = process.env.DBURI || 'mongodb+srv://admin:AeFu-cwqPDCdc49@cluster0.4fdbxhw.mongodb.net/fulltime?retryWrites=true&w=majority&appName=thefinalplay';

mongoose.connect(uri).then(async () => {
  try {
    // 1. Dump the raw Arsenal vs Coventry fixture (tonight)
    const tonight = await Match.findOne({ match_id: 19722203 }).lean();
    console.log('=== Raw Arsenal vs Coventry (id 19722203) ===');
    console.log(JSON.stringify({
      match_id: tonight?.match_id,
      starting_at: tonight?.match_info?.starting_at,
      teams: tonight?.teams,
      match_status: tonight?.match_status,
      status: tonight?.status,
      league: tonight?.match_info?.league,
      season: tonight?.match_info?.season,
      score: tonight?.score
    }, null, 2));

    // 2. Sample a recent Arsenal fixture to see where league lives
    const sample = await Match.findOne({ match_id: 19721833 }).lean();
    console.log('\n=== Raw league/season on a PL fixture (id 19721833) ===');
    console.log('match_info.league:', JSON.stringify(sample?.match_info?.league));
    console.log('match_info.season:', JSON.stringify(sample?.match_info?.season));
    console.log('match_status:', JSON.stringify(sample?.match_status));

    // 3. Now find upcoming PL fixtures using the actual league path
    const now = new Date(); now.setHours(0,0,0,0);
    // discover the correct league id field by querying what values exist
    const leagueIds = await Match.distinct('match_info.league.id');
    console.log('\n=== distinct match_info.league.id values ===', leagueIds.slice(0, 30));

    // Try matching league by name 'Premier League'
    const upByName = await Match.find({
      'match_info.league.name': /premier league/i,
      'match_info.starting_at': { $gte: now }
    }).sort({ 'match_info.starting_at': 1 }).limit(12).lean();
    console.log('\n=== Upcoming "Premier League" fixtures (by league name) ===');
    if (!upByName.length) console.log('(none found)');
    upByName.forEach(m => console.log(`${m.match_info?.starting_at} | ${m.teams?.home?.team_name} vs ${m.teams?.away?.team_name} | status=${m.match_status?.short_name || m.match_status?.state || m.match_status?.name}`));

    // 4. Season: what does match_info.season look like for PL
    const seasons = await Match.distinct('match_info.season.name', { 'match_info.league.name': /premier league/i });
    console.log('\n=== PL season names ===', seasons);
  } catch (e) {
    console.error('Query error:', e);
  } finally {
    await mongoose.disconnect();
  }
}).catch(e => { console.error('Connection error:', e.message); process.exit(1); });
