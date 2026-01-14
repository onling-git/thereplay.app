require('dotenv').config();
const { connectDB, closeDB } = require('./db/connect');
const Match = require('./models/Match');

// Test upcoming matches to verify formation data in cron pre-match lineup fetching
async function testUpcomingMatchFormations() {
  try {
    await connectDB(process.env.DBURI || process.env.MONGO_URI);
    
    console.log(`🕒 Testing Formation Data for Upcoming Matches`);
    console.log(`===============================================\n`);

    // Find some upcoming matches (within next few hours)
    const now = new Date();
    const inFewHours = new Date(now.getTime() + (6 * 60 * 60 * 1000)); // 6 hours ahead

    const upcomingMatches = await Match.find({
      'match_info.starting_at': { 
        $gte: now, 
        $lte: inFewHours 
      }
    })
    .limit(5)
    .lean();

    console.log(`Found ${upcomingMatches.length} upcoming matches in the next 6 hours\n`);

    if (upcomingMatches.length === 0) {
      console.log(`ℹ️  No upcoming matches found in the next 6 hours.`);
      console.log(`Let's check matches in the next 24 hours instead...\n`);
      
      const tomorrow = new Date(now.getTime() + (24 * 60 * 60 * 1000));
      const tomorrowMatches = await Match.find({
        'match_info.starting_at': { 
          $gte: now, 
          $lte: tomorrow 
        }
      })
      .limit(3)
      .lean();

      console.log(`Found ${tomorrowMatches.length} matches in the next 24 hours:\n`);
      
      for (let i = 0; i < tomorrowMatches.length; i++) {
        const match = tomorrowMatches[i];
        const homeFormationCount = match.lineup?.home?.filter(p => p.formation_field)?.length || 0;
        const awayFormationCount = match.lineup?.away?.filter(p => p.formation_field)?.length || 0;
        
        console.log(`${i + 1}. Match ${match.match_id}:`);
        console.log(`   ${match.teams?.home?.team_name || 'Home'} vs ${match.teams?.away?.team_name || 'Away'}`);
        console.log(`   Kickoff: ${match.match_info?.starting_at}`);
        console.log(`   Home formation players: ${homeFormationCount}`);
        console.log(`   Away formation players: ${awayFormationCount}`);
        console.log(`   Total lineup: ${match.lineup?.home?.length || 0} home, ${match.lineup?.away?.length || 0} away\n`);
      }
    } else {
      for (let i = 0; i < upcomingMatches.length; i++) {
        const match = upcomingMatches[i];
        const homeFormationCount = match.lineup?.home?.filter(p => p.formation_field)?.length || 0;
        const awayFormationCount = match.lineup?.away?.filter(p => p.formation_field)?.length || 0;
        
        console.log(`${i + 1}. Match ${match.match_id} (${Math.round((new Date(match.match_info.starting_at) - now) / 60000)} min):`);
        console.log(`   ${match.teams?.home?.team_name || 'Home'} vs ${match.teams?.away?.team_name || 'Away'}`);
        console.log(`   Kickoff: ${match.match_info?.starting_at}`);
        console.log(`   Home formation players: ${homeFormationCount}`);
        console.log(`   Away formation players: ${awayFormationCount}`);
        console.log(`   Total lineup: ${match.lineup?.home?.length || 0} home, ${match.lineup?.away?.length || 0} away\n`);
      }
    }

    // Test the cron job's fetchMatchStats function with formations
    console.log(`🧪 Testing cron fetchMatchStats with formations...\n`);
    
    const { fetchMatchStats } = require('./controllers/matchSyncController');
    const { normaliseFixtureToMatchDoc } = require('./utils/normaliseFixture');
    
    // Use a known match ID for testing
    const testMatchId = 19432044; // Southampton vs Millwall
    
    try {
      console.log(`Fetching match stats for ${testMatchId} with forFinished option...`);
      const matchStats = await fetchMatchStats(testMatchId, { forFinished: true });
      
      if (matchStats) {
        console.log(`✅ Successfully fetched match data`);
        console.log(`   - Include used: ${matchStats._fetched_with_include}`);
        console.log(`   - Has lineups: ${!!matchStats.lineups}`);
        console.log(`   - Has formations: ${!!matchStats.formations}`);
        
        if (matchStats.formations) {
          console.log(`   - Formations count: ${matchStats.formations.length || (matchStats.formations.data?.length || 0)}`);
        }
        
        // Test normalization
        const normalized = normaliseFixtureToMatchDoc(matchStats);
        if (normalized?.lineup) {
          const homeWithFormation = normalized.lineup.home?.filter(p => p.formation_field)?.length || 0;
          const awayWithFormation = normalized.lineup.away?.filter(p => p.formation_field)?.length || 0;
          
          console.log(`   ✅ Normalization results:`);
          console.log(`      - Home players with formation_field: ${homeWithFormation}`);
          console.log(`      - Away players with formation_field: ${awayWithFormation}`);
          
          if (homeWithFormation > 0) {
            const sampleFormations = normalized.lineup.home
              .filter(p => p.formation_field)
              .slice(0, 3)
              .map(p => `${p.player_name}(${p.formation_field})`)
              .join(', ');
            console.log(`      - Sample formations: ${sampleFormations}`);
          }
        }
        
      } else {
        console.log(`❌ No match data returned`);
      }
      
    } catch (error) {
      console.error(`❌ Error fetching match stats:`, error.message);
    }

    console.log(`\n🎯 Upcoming Match Formation Test Complete!`);

  } catch (error) {
    console.error('❌ Error testing upcoming matches:', error);
  } finally {
    await closeDB();
  }
}

testUpcomingMatchFormations();