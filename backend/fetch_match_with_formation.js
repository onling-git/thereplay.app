// fetch_match_with_formation.js
// Fetch a specific match from SportMonks with formation data

const mongoose = require('mongoose');
const Match = require('./models/Match');
const { get } = require('./utils/sportmonks');
const { normaliseFixtureToMatchDoc } = require('./utils/normaliseFixture');

function readDbUri() {
  const fs = require('fs');
  const path = require('path');
  try {
    const configPath = path.join(__dirname, 'config', 'database.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config.uri || process.env.MONGODB_URI;
  } catch (e) {
    return process.env.MONGODB_URI;
  }
}

async function fetchMatchWithFormation() {
  const uri = readDbUri();
  if (!uri) {
    console.error('❌ No database URI found');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('📊 Connected to database');

  try {
    const matchId = 19432044;
    
    // First check if match exists
    const existingMatch = await Match.findOne({ match_id: matchId }).lean();
    if (existingMatch) {
      console.log(`✅ Match ${matchId} already exists`);
      console.log(`   Teams: ${existingMatch.teams?.home?.team_name} vs ${existingMatch.teams?.away?.team_name}`);
      return existingMatch;
    }
    
    console.log(`🔍 Fetching match ${matchId} from SportMonks...`);
    
    // Fetch from SportMonks with formations and lineups
    const includes = [
      'lineups.detailedposition',  // This should include formation data
      'formations',               // Formation information
      'events',
      'comments',
      'scores',
      'participants',
      'stage'
    ].join(';');
    
    const fixtureResponse = await get(`fixtures/${matchId}`, {
      include: includes
    });
    
    const fixture = fixtureResponse.data?.data;
    if (!fixture) {
      console.error(`❌ Match ${matchId} not found on SportMonks`);
      return null;
    }
    
    console.log(`✅ Fetched match from SportMonks:`);
    console.log(`   ${fixture.participants?.find(p => p.meta?.location === 'home')?.name || 'Home'} vs ${fixture.participants?.find(p => p.meta?.location === 'away')?.name || 'Away'}`);
    console.log(`   Status: ${fixture.state?.state}`);
    
    // Check what lineup data we got
    console.log(`\n📋 Raw SportMonks lineup data:`);
    console.log(`   - lineups array length: ${fixture.lineups?.data?.length || 0}`);
    if (fixture.lineups?.data?.length > 0) {
      fixture.lineups.data.forEach((teamLineup, i) => {
        console.log(`   Team ${i + 1} (ID: ${teamLineup.team_id}):`);
        console.log(`     - detailedposition entries: ${teamLineup.detailedposition?.data?.length || 0}`);
        
        if (teamLineup.detailedposition?.data?.length > 0) {
          const sample = teamLineup.detailedposition.data.slice(0, 3);
          sample.forEach((player, j) => {
            console.log(`     Player ${j + 1}: ${player.player?.name || 'Unknown'}`);
            console.log(`       formation_position: ${player.formation_position}`);
            console.log(`       formation_field: ${player.formation_field}`);
            console.log(`       position_id: ${player.position_id}`);
          });
        }
      });
    }
    
    // Check formations data
    console.log(`\n🎯 Formation data:`);
    console.log(`   - formations array length: ${fixture.formations?.data?.length || 0}`);
    if (fixture.formations?.data?.length > 0) {
      fixture.formations.data.forEach((formation, i) => {
        console.log(`   Formation ${i + 1}: ${formation.formation} (Team ID: ${formation.participant_id})`);
      });
    }
    
    // Normalize the fixture to our match document format
    console.log(`\n🔄 Normalizing fixture to match document...`);
    const matchDoc = normaliseFixtureToMatchDoc(fixture);
    
    console.log(`📊 Normalized match document:`);
    console.log(`   - lineup.home players: ${matchDoc.lineup?.home?.length || 0}`);
    console.log(`   - lineup.away players: ${matchDoc.lineup?.away?.length || 0}`);
    console.log(`   - lineups array entries: ${matchDoc.lineups?.length || 0}`);
    
    // Show formation data in normalized document
    if (matchDoc.lineup?.home?.length > 0) {
      console.log(`\n🏠 Home team formation data (normalized):`);
      const withFormationPos = matchDoc.lineup.home.filter(p => p.formation_position != null);
      const withFormationField = matchDoc.lineup.home.filter(p => p.formation_field != null);
      console.log(`   - Players with formation_position: ${withFormationPos.length}/${matchDoc.lineup.home.length}`);
      console.log(`   - Players with formation_field: ${withFormationField.length}/${matchDoc.lineup.home.length}`);
      
      if (withFormationField.length > 0) {
        console.log(`   Examples:`);
        withFormationField.slice(0, 3).forEach(p => {
          console.log(`   - ${p.player_name}: field="${p.formation_field}", pos=${p.formation_position}`);
        });
      }
    }
    
    // Upsert to database
    console.log(`\n💾 Saving match to database...`);
    const savedMatch = await Match.findOneAndUpdate(
      { match_id: matchId },
      matchDoc,
      { upsert: true, new: true }
    ).lean();
    
    console.log(`✅ Successfully saved match ${matchId} to database`);
    return savedMatch;
    
  } catch (error) {
    console.error('❌ Error:', error);
    if (error.response) {
      console.error('API Response:', error.response.status, error.response.statusText);
      console.error('API Data:', JSON.stringify(error.response.data, null, 2));
    }
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

fetchMatchWithFormation().catch(console.error);