const { connectDB } = require('./db/connect');
const Match = require('./models/Match');

(async () => {
  try {
    await connectDB(process.env.DBURI);
    console.log('Connected to database');
    
    // Check for FA Cup fixtures (league ID 24)
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const faCupFixtures = await Match.find({
      'match_info.league.id': 24,
      'match_info.starting_at': {
        $gte: today,
        $lt: tomorrow
      }
    }).select('teams match_info.starting_at match_info.league match_status').lean();
    
    console.log('FA Cup fixtures for today:', faCupFixtures.length);
    faCupFixtures.forEach((f, i) => {
      console.log(`- Fixture ${i+1}:`, JSON.stringify(f, null, 2));
    });
    
    // Check for any FA Cup fixtures in the next 7 days
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const faCupFixturesWeek = await Match.find({
      'match_info.league.id': 24,
      'match_info.starting_at': {
        $gte: today,
        $lt: nextWeek
      }
    }).select('teams match_info.starting_at match_info.league match_status').sort({'match_info.starting_at': 1}).lean();
    
    console.log('\nFA Cup fixtures in next 7 days:', faCupFixturesWeek.length);
    faCupFixturesWeek.forEach(f => {
      console.log(`- ${f.teams.home.name} vs ${f.teams.away.name} at ${f.match_info.starting_at}`);
    });
    
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
})();