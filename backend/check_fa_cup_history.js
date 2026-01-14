const { connectDB } = require('./db/connect');
const Match = require('./models/Match');

(async () => {
  try {
    await connectDB(process.env.DBURI);
    console.log('Connected to database');
    
    // Check when FA Cup fixtures were created
    const faCupFixtures = await Match.find({
      'match_info.league.id': 24
    }).select('createdAt updatedAt match_info.starting_at teams').sort({createdAt: -1}).limit(10).lean();
    
    console.log('Most recent FA Cup fixtures in database:');
    faCupFixtures.forEach(f => {
      console.log(`- ${f.teams.home.team_name} vs ${f.teams.away.team_name}`);
      console.log(`  Match date: ${f.match_info.starting_at}`);
      console.log(`  Created: ${f.createdAt}`);
      console.log(`  Updated: ${f.updatedAt}`);
      console.log('');
    });
    
    // Check how many total FA Cup fixtures we have
    const totalFaCup = await Match.countDocuments({
      'match_info.league.id': 24
    });
    
    console.log(`Total FA Cup fixtures in database: ${totalFaCup}`);
    
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
})();