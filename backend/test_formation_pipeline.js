require('dotenv').config();
const { connectDB, closeDB } = require('./db/connect');
const { syncFinishedMatch } = require('./controllers/matchSyncController');
const Match = require('./models/Match');

// Test the formation data pipeline by syncing a recent match
const TEST_MATCH_ID = 19432044; // Southampton vs Millwall (should have formation data)

async function testFormationPipeline() {
  try {
    await connectDB(process.env.DBURI || process.env.MONGO_URI);
    
    console.log(`🧪 Testing Formation Data Pipeline`);
    console.log(`Match ID: ${TEST_MATCH_ID}`);
    console.log(`========================================\n`);

    // First, check existing match data
    console.log(`1. Checking existing match data...`);
    let match = await Match.findOne({ match_id: TEST_MATCH_ID });
    
    if (match) {
      console.log(`   ✓ Match found in database`);
      console.log(`   - Home: ${match.teams?.home?.team_name || 'N/A'}`);
      console.log(`   - Away: ${match.teams?.away?.team_name || 'N/A'}`);
      
      // Check existing formation data
      const homeFormationPlayers = match.lineup?.home?.filter(p => p.formation_field) || [];
      const awayFormationPlayers = match.lineup?.away?.filter(p => p.formation_field) || [];
      
      console.log(`   - Home lineup players with formation_field: ${homeFormationPlayers.length}`);
      console.log(`   - Away lineup players with formation_field: ${awayFormationPlayers.length}`);
      
      if (homeFormationPlayers.length > 0) {
        console.log(`   - Sample home formation_field values: ${homeFormationPlayers.slice(0, 3).map(p => p.formation_field).join(', ')}`);
      }
      if (awayFormationPlayers.length > 0) {
        console.log(`   - Sample away formation_field values: ${awayFormationPlayers.slice(0, 3).map(p => p.formation_field).join(', ')}`);
      }
    } else {
      console.log(`   ⚠️ Match not found in database`);
    }

    // Now sync the match with formation data
    console.log(`\n2. Syncing match with formation data...`);
    await syncFinishedMatch(TEST_MATCH_ID, { forFinished: true });
    console.log(`   ✓ Match sync completed`);

    // Check the updated match data
    console.log(`\n3. Checking updated match data...`);
    match = await Match.findOne({ match_id: TEST_MATCH_ID });
    
    if (match) {
      const homeFormationPlayers = match.lineup?.home?.filter(p => p.formation_field) || [];
      const awayFormationPlayers = match.lineup?.away?.filter(p => p.formation_field) || [];
      
      console.log(`   ✅ Updated formation data:`);
      console.log(`   - Home lineup players with formation_field: ${homeFormationPlayers.length}`);
      console.log(`   - Away lineup players with formation_field: ${awayFormationPlayers.length}`);
      
      if (homeFormationPlayers.length > 0) {
        console.log(`   - Home formation_field values: ${homeFormationPlayers.map(p => `${p.player_name}(${p.formation_field})`).join(', ')}`);
      }
      if (awayFormationPlayers.length > 0) {
        console.log(`   - Away formation_field values: ${awayFormationPlayers.map(p => `${p.player_name}(${p.formation_field})`).join(', ')}`);
      }

      // Test the match API endpoint with enrichLineup
      console.log(`\n4. Testing enrichLineup API endpoint...`);
      const { enrichLineupData } = require('./utils/lineup');
      
      if (match.lineup) {
        const enrichedLineup = await enrichLineupData(match.lineup, {
          homeTeamId: match.teams?.home?.team_id,
          awayTeamId: match.teams?.away?.team_id
        });
        
        const homeEnrichedFormation = enrichedLineup?.home?.filter(p => p.formation_field) || [];
        const awayEnrichedFormation = enrichedLineup?.away?.filter(p => p.formation_field) || [];
        
        console.log(`   ✅ Enriched lineup results:`);
        console.log(`   - Home enriched players with formation_field: ${homeEnrichedFormation.length}`);
        console.log(`   - Away enriched players with formation_field: ${awayEnrichedFormation.length}`);
        
        if (homeEnrichedFormation.length > 0) {
          console.log(`   - Sample home enriched formation data: ${homeEnrichedFormation.slice(0, 2).map(p => `${p.player_name}(${p.formation_field})`).join(', ')}`);
        }
      }

    } else {
      console.log(`   ❌ Failed to find updated match data`);
    }

    console.log(`\n🎯 Formation Pipeline Test Complete!`);
    
    // Summary
    const totalFormationPlayers = (match?.lineup?.home?.filter(p => p.formation_field)?.length || 0) + 
                                  (match?.lineup?.away?.filter(p => p.formation_field)?.length || 0);
    
    if (totalFormationPlayers >= 18) { // Expecting 11 + 11 starters minimum
      console.log(`✅ SUCCESS: Found ${totalFormationPlayers} players with formation data`);
    } else if (totalFormationPlayers > 0) {
      console.log(`⚠️  PARTIAL: Found ${totalFormationPlayers} players with formation data (expected 22+)`);
    } else {
      console.log(`❌ FAILURE: No formation data found`);
    }

  } catch (error) {
    console.error('❌ Error testing formation pipeline:', error);
  } finally {
    await closeDB();
  }
}

testFormationPipeline();