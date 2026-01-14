// Check specific Liverpool match ID 19615693
require('dotenv').config();
const { connectDB } = require('./db/connect');
const Match = require('./models/Match');

async function checkLiverpoolMatch() {
  try {
    await connectDB(process.env.DBURI || process.env.MONGO_URI);
    console.log('📊 Connected to database');
    
    const matchId = 19615693;
    const match = await Match.findOne({ match_id: matchId });
    
    if (!match) {
      console.log(`❌ Match ${matchId} not found in database`);
      console.log('Checking for similar Liverpool matches...');
      
      // Look for recent Liverpool matches
      const liverpoolMatches = await Match.find({
        $or: [
          { 'teams.home.team_name': /Liverpool/i },
          { 'teams.away.team_name': /Liverpool/i }
        ]
      }).sort({ 'match_info.starting_at': -1 }).limit(10);
      
      console.log(`\nFound ${liverpoolMatches.length} recent Liverpool matches:`);
      liverpoolMatches.forEach(m => {
        console.log(`  ${m.match_id}: ${m.teams?.home?.team_name} vs ${m.teams?.away?.team_name} - ${m.match_info?.starting_at}`);
      });
      return;
    }
    
    console.log(`✅ Found match ${matchId}:`);
    console.log(`   Teams: ${match.teams?.home?.team_name} vs ${match.teams?.away?.team_name}`);
    console.log(`   Status: ${match.match_status}`);
    console.log(`   Date: ${match.match_info?.starting_at}`);
    console.log(`   League: ${match.league?.name}`);
    console.log(`   Season: ${match.season?.name}`);
    
    // Check report status
    console.log(`\n📝 Report Status:`);
    console.log(`   - has_report: ${!!match.has_report}`);
    console.log(`   - home_report exists: ${!!match.home_report}`);
    console.log(`   - away_report exists: ${!!match.away_report}`);
    console.log(`   - match_report exists: ${!!match.match_report}`);
    
    if (match.home_report) {
      console.log(`   - home report headline: "${match.home_report.headline}"`);
    }
    if (match.away_report) {
      console.log(`   - away report headline: "${match.away_report.headline}"`);
    }
    
    // Check lineup and key data
    console.log(`\n📋 Match Data:`);
    console.log(`   - home lineup players: ${match.lineup?.home?.length || 0}`);
    console.log(`   - away lineup players: ${match.lineup?.away?.length || 0}`);
    console.log(`   - goals: ${match.goals?.length || 0}`);
    console.log(`   - cards: ${match.cards?.length || 0}`);
    console.log(`   - statistics available: ${!!match.statistics}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkLiverpoolMatch();