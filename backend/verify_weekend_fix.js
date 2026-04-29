// Verify weekend matches have been fixed
require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');

async function verifyFix() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB\n');

    // Check a few specific matches
    const sampleMatches = [
      19427730, // Chelsea vs Manchester United
      19425208, // Roma vs Atalanta
      19433739  // Eintracht Frankfurt vs RB Leipzig
    ];

    console.log('🔍 Checking sample matches:\n');

    for (const matchId of sampleMatches) {
      const match = await Match.findOne({ match_id: matchId }).lean();
      
      if (!match) {
        console.log(`❌ Match ${matchId} not found`);
        continue;
      }
      
      console.log(`Match ID: ${matchId}`);
      console.log(`  Teams: ${match.teams?.home?.team_name || match.home_team} vs ${match.teams?.away?.team_name || match.away_team}`);
      console.log(`  Score: ${match.score?.home}-${match.score?.away}`);
      console.log(`  Status: ${match.match_status?.name || 'Unknown'}`);
      console.log(`  Events: ${match.events?.length || 0}`);
      console.log(`  Lineup (home): ${match.lineup?.home?.length || 0}`);
      console.log(`  Lineup (away): ${match.lineup?.away?.length || 0}`);
      console.log('');
    }

    // Check overall stats
    const weekendStart = new Date('2026-04-18T00:00:00Z');
    const weekendEnd = new Date('2026-04-20T23:59:59Z');

    const allMatches = await Match.find({
      'match_info.starting_at': { $gte: weekendStart, $lte: weekendEnd }
    }).lean();

    console.log(`\n📊 Weekend matches summary:`);
    console.log(`  Total matches: ${allMatches.length}`);
    
    const withScores = allMatches.filter(m => 
      m.score && (m.score.home > 0 || m.score.away > 0)
    );
    console.log(`  Matches with non-0-0 scores: ${withScores.length}`);
    
    const withEvents = allMatches.filter(m => 
      m.events && m.events.length > 0
    );
    console.log(`  Matches with events: ${withEvents.length}`);
    
    const withLineups = allMatches.filter(m => 
      m.lineup && (m.lineup.home?.length > 0 || m.lineup.away?.length > 0)
    );
    console.log(`  Matches with lineups: ${withLineups.length}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

verifyFix().catch(console.error);
