const { connectDB } = require('./db/connect');
const Match = require('./models/Match');
const Team = require('./models/Team');

(async () => {
  try {
    await connectDB(process.env.DBURI);
    console.log('Connected to database');
    
    // Check Southampton's team record
    const southampton = await Team.findOne({ 
      $or: [
        { slug: 'southampton' },
        { name: /southampton/i }
      ]
    }).lean();
    
    if (!southampton) {
      console.log('❌ Southampton team not found');
      return;
    }
    
    console.log('🔍 Southampton team record:');
    console.log('  Name:', southampton.name);
    console.log('  Slug:', southampton.slug);
    console.log('  ID:', southampton.id);
    console.log('  Next match:', southampton.next_match);
    console.log('  Next game at:', southampton.next_game_at);
    
    // Check FA Cup fixtures for Southampton today
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todaysMatches = await Match.find({
      $or: [
        { 'teams.home.team_id': southampton.id },
        { 'teams.away.team_id': southampton.id }
      ],
      'match_info.starting_at': {
        $gte: today,
        $lt: tomorrow
      }
    }).select('match_id teams match_info.starting_at match_info.league').lean();
    
    console.log(`\n🏆 Southampton matches today: ${todaysMatches.length}`);
    todaysMatches.forEach(m => {
      console.log(`- Match ${m.match_id}: ${m.teams.home.team_name} vs ${m.teams.away.team_name}`);
      console.log(`  Time: ${m.match_info.starting_at}`);
      console.log(`  League: ${m.match_info.league?.name} (ID: ${m.match_info.league?.id})`);
    });
    
    // Check what next_match points to
    if (southampton.next_match) {
      const nextMatch = await Match.findOne({ match_id: southampton.next_match }).lean();
      if (nextMatch) {
        console.log(`\n📅 Current next_match (${southampton.next_match}) details:`);
        console.log(`  Teams: ${nextMatch.teams.home.team_name} vs ${nextMatch.teams.away.team_name}`);
        console.log(`  Time: ${nextMatch.match_info.starting_at}`);
        console.log(`  League: ${nextMatch.match_info.league?.name}`);
      } else {
        console.log(`\n❌ next_match ${southampton.next_match} not found in database`);
      }
    }
    
    // Check Southampton's upcoming matches in chronological order
    const upcomingMatches = await Match.find({
      $or: [
        { 'teams.home.team_id': southampton.id },
        { 'teams.away.team_id': southampton.id }
      ],
      'match_info.starting_at': {
        $gte: today
      }
    }).select('match_id teams match_info.starting_at match_info.league').sort({'match_info.starting_at': 1}).limit(5).lean();
    
    console.log(`\n📅 Southampton's next 5 upcoming matches:`);
    upcomingMatches.forEach((m, i) => {
      console.log(`${i + 1}. Match ${m.match_id}: ${m.teams.home.team_name} vs ${m.teams.away.team_name}`);
      console.log(`   Time: ${m.match_info.starting_at}`);
      console.log(`   League: ${m.match_info.league?.name}`);
    });
    
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
})();