require('dotenv').config();
const { connectDB } = require('./db/connect');
const Team = require('./models/Team');

async function testSouthamptonAfterFix() {
  try {
    await connectDB(process.env.DBURI);
    console.log('Connected to database');
    
    console.log('\n=== TESTING SOUTHAMPTON AFTER FIX ===');
    const team = await Team.findOne({ slug: 'southampton' }).lean();
    
    if (!team) {
      console.log('❌ Southampton team not found');
      return;
    }
    
    console.log('✅ Southampton team found:');
    console.log({
      name: team.name,
      slug: team.slug,
      id: team.id,
      last_match: team.last_match,
      next_match: team.next_match,
      last_played_at: team.last_played_at,
      next_game_at: team.next_game_at
    });
    
    // Test what the team endpoint would return
    console.log('\n=== SIMULATING /api/teams/southampton ENDPOINT ===');
    console.log('This is what the frontend will receive:');
    console.log(JSON.stringify({
      name: team.name,
      slug: team.slug,
      image_path: team.image_path,
      last_match: team.last_match,
      next_match: team.next_match,
      last_played_at: team.last_played_at,
      next_game_at: team.next_game_at
    }, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testSouthamptonAfterFix();