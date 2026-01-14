const { connectDB } = require('./db/connect');
const Match = require('./models/Match');

(async () => {
  try {
    await connectDB(process.env.DBURI);
    console.log('Connected to database');
    
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Check all FA Cup fixtures for today
    const todaysFACup = await Match.find({
      'match_info.league.id': 24, // FA Cup
      'match_info.starting_at': {
        $gte: today,
        $lt: tomorrow
      }
    }).select('match_id teams match_info.starting_at match_info.league match_info.stage').lean();
    
    console.log(`🏆 FA Cup fixtures today: ${todaysFACup.length}`);
    todaysFACup.forEach(m => {
      console.log(`- Match ${m.match_id}: ${m.teams.home.team_name} vs ${m.teams.away.team_name}`);
      console.log(`  Time: ${m.match_info.starting_at}`);
      console.log(`  Stage: ${m.match_info.stage?.name || 'Not specified'}`);
    });
    
    // Check if any of these involve Southampton
    const southamptonInFACup = todaysFACup.filter(m => 
      m.teams.home.team_name.toLowerCase().includes('southampton') ||
      m.teams.away.team_name.toLowerCase().includes('southampton')
    );
    
    console.log(`\n🔍 Southampton FA Cup matches today: ${southamptonInFACup.length}`);
    
    // Check all FA Cup fixtures regardless of date
    const allFACup = await Match.find({
      'match_info.league.id': 24
    }).select('match_id teams match_info.starting_at match_info.league').sort({'match_info.starting_at': 1}).limit(10).lean();
    
    console.log(`\n📊 All FA Cup fixtures in database (first 10):`);
    allFACup.forEach(m => {
      console.log(`- Match ${m.match_id}: ${m.teams.home.team_name} vs ${m.teams.away.team_name}`);
      console.log(`  Time: ${m.match_info.starting_at}`);
    });
    
    // Let's also check what the exact team IDs are
    console.log(`\n🔍 Checking team IDs in FA Cup fixtures:`);
    todaysFACup.forEach(m => {
      console.log(`- ${m.teams.home.team_name} (ID: ${m.teams.home.team_id}) vs ${m.teams.away.team_name} (ID: ${m.teams.away.team_id})`);
    });
    
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
})();