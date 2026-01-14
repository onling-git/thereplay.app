// Check specific Liverpool match 19615693
const mongoose = require('mongoose');
const Match = require('./models/Match');
const Team = require('./models/Team');

async function checkMatch() {
  require('dotenv').config();
  const uri = process.env.DBURI || process.env.MONGODB_URI || "mongodb://localhost:27017/thefinalplay";
  
  try {
    await mongoose.connect(uri);
    console.log('📊 Connected to database');

    const matchId = 19615693;
    console.log(`🔍 Searching for match ID: ${matchId}`);
    
    // Check if match exists
    const match = await Match.findOne({ match_id: matchId }).lean();
    
    if (!match) {
      console.log(`❌ Match ${matchId} not found in database`);
      
      // Search for similar IDs
      const similarMatches = await Match.find({ 
        match_id: { $gte: 19615690, $lte: 19615700 } 
      }).select('match_id teams match_status').lean();
      
      if (similarMatches.length > 0) {
        console.log('\n🔍 Similar match IDs found:');
        similarMatches.forEach(m => {
          console.log(`   - ${m.match_id}: ${m.teams?.home?.team_name} vs ${m.teams?.away?.team_name} (${m.match_status})`);
        });
      }
      
      return;
    }
    
    console.log(`✅ Found match ${matchId}:`);
    console.log(`   Teams: ${match.teams?.home?.team_name} vs ${match.teams?.away?.team_name}`);
    console.log(`   Status: ${match.match_status}`);
    console.log(`   Date: ${match.match_info?.starting_at}`);
    console.log(`   League: ${match.league?.name}`);
    console.log(`   Season: ${match.season_id}`);
    
    // Check report status
    console.log(`\n📝 Report Status:`);
    console.log(`   - has_report: ${match.has_report}`);
    console.log(`   - match_report exists: ${!!match.match_report}`);
    console.log(`   - match_report length: ${match.match_report?.length || 0}`);
    
    // Check team slugs
    console.log(`\n🏷️ Team Information:`);
    if (match.teams?.home?.team_id) {
      const homeTeam = await Team.findOne({ team_id: match.teams.home.team_id }).select('name slug team_id').lean();
      console.log(`   Home Team: ${homeTeam?.name} (slug: ${homeTeam?.slug})`);
    }
    
    if (match.teams?.away?.team_id) {
      const awayTeam = await Team.findOne({ team_id: match.teams.away.team_id }).select('name slug team_id').lean();
      console.log(`   Away Team: ${awayTeam?.name} (slug: ${awayTeam?.slug})`);
    }
    
    // Check if Liverpool is involved
    const isLiverpoolMatch = (match.teams?.home?.team_name?.toLowerCase().includes('liverpool') || 
                             match.teams?.away?.team_name?.toLowerCase().includes('liverpool'));
    console.log(`   Is Liverpool match: ${isLiverpoolMatch}`);
    
    // Check recent matches processing
    console.log(`\n🕐 Recent Processing Check:`);
    const recentMatches = await Match.find({
      'match_info.starting_at': { 
        $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
      },
      has_report: true
    }).select('match_id teams match_info.starting_at').limit(5).lean();
    
    console.log(`   Recent matches with reports (last 7 days): ${recentMatches.length}`);
    recentMatches.forEach(m => {
      console.log(`   - ${m.match_id}: ${m.teams?.home?.team_name} vs ${m.teams?.away?.team_name}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📊 Disconnected from database');
  }
}

checkMatch();