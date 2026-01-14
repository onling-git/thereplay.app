// check_specific_match.js
// Check formation data for a specific match

const mongoose = require('mongoose');
const Match = require('./models/Match');

async function checkSpecificMatch() {
  require('dotenv').config();
  const uri = process.env.DBURI || process.env.MONGODB_URI || "mongodb://localhost:27017/thefinalplay";
  await mongoose.connect(uri);
  console.log('📊 Connected to database:', uri.substring(0, 50) + '...');

  try {
    const matchId = 19432044;
    const match = await Match.findOne({ match_id: matchId }).lean();
    
    if (!match) {
      console.log(`❌ Match ${matchId} not found in database`);
      return;
    }
    
    console.log(`✅ Found match ${matchId}:`);
    console.log(`   Teams: ${match.teams?.home?.team_name} vs ${match.teams?.away?.team_name}`);
    console.log(`   Status: ${match.match_status}`);
    console.log(`   Date: ${match.match_info?.starting_at}`);
    
    // Check lineup structure
    console.log(`\n📋 Lineup Structure:`);
    console.log(`   - lineup.home exists: ${!!match.lineup?.home}`);
    console.log(`   - lineup.away exists: ${!!match.lineup?.away}`);
    console.log(`   - lineup.home players: ${match.lineup?.home?.length || 0}`);
    console.log(`   - lineup.away players: ${match.lineup?.away?.length || 0}`);
    console.log(`   - lineups array exists: ${!!match.lineups}`);
    console.log(`   - lineups array length: ${match.lineups?.length || 0}`);
    
    // Check formation data in home lineup
    if (match.lineup?.home?.length > 0) {
      console.log(`\n🏠 Home Team Formation Data:`);
      const playersWithFormationPos = match.lineup.home.filter(p => p.formation_position != null);
      const playersWithFormationField = match.lineup.home.filter(p => p.formation_field != null);
      console.log(`   - Players with formation_position: ${playersWithFormationPos.length}/${match.lineup.home.length}`);
      console.log(`   - Players with formation_field: ${playersWithFormationField.length}/${match.lineup.home.length}`);
      
      // Show first few players
      console.log(`\n   First 5 players:`);
      match.lineup.home.slice(0, 5).forEach((player, i) => {
        console.log(`   ${i + 1}. ${player.player_name || 'Unknown'}`);
        console.log(`      position_id: ${player.position_id}`);
        console.log(`      formation_position: ${player.formation_position}`);
        console.log(`      formation_field: ${player.formation_field}`);
        console.log(`      jersey_number: ${player.jersey_number}`);
        console.log('');
      });
    }
    
    // Check formation data in away lineup  
    if (match.lineup?.away?.length > 0) {
      console.log(`\n✈️  Away Team Formation Data:`);
      const playersWithFormationPos = match.lineup.away.filter(p => p.formation_position != null);
      const playersWithFormationField = match.lineup.away.filter(p => p.formation_field != null);
      console.log(`   - Players with formation_position: ${playersWithFormationPos.length}/${match.lineup.away.length}`);
      console.log(`   - Players with formation_field: ${playersWithFormationField.length}/${match.lineup.away.length}`);
      
      // Show first few players
      console.log(`\n   First 5 players:`);
      match.lineup.away.slice(0, 5).forEach((player, i) => {
        console.log(`   ${i + 1}. ${player.player_name || 'Unknown'}`);
        console.log(`      position_id: ${player.position_id}`);
        console.log(`      formation_position: ${player.formation_position}`);
        console.log(`      formation_field: ${player.formation_field}`);
        console.log(`      jersey_number: ${player.jersey_number}`);
        console.log('');
      });
    }
    
    // Check raw lineups array
    if (match.lineups?.length > 0) {
      console.log(`\n📊 Raw Lineups Array (${match.lineups.length} entries):`);
      const withFormationPos = match.lineups.filter(p => p.formation_position != null);
      const withFormationField = match.lineups.filter(p => p.formation_field != null);
      console.log(`   - Entries with formation_position: ${withFormationPos.length}/${match.lineups.length}`);
      console.log(`   - Entries with formation_field: ${withFormationField.length}/${match.lineups.length}`);
      
      if (withFormationField.length > 0) {
        console.log(`\n   Formation field examples:`);
        withFormationField.slice(0, 5).forEach(p => {
          console.log(`   - ${p.player_name}: formation_field="${p.formation_field}", formation_position=${p.formation_position}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from database');
  }
}

checkSpecificMatch().catch(console.error);