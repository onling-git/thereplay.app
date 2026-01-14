// debug_formation_data.js
// Quick script to examine formation data structure in the database

const mongoose = require('mongoose');
const Match = require('./models/Match');

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

async function debugFormationData() {
  const uri = readDbUri();
  if (!uri) {
    console.error('❌ No database URI found');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('📊 Connected to database');

  try {
    // Find recent matches with lineup data
    const matches = await Match.find({
      $or: [
        { 'lineup.home.0': { $exists: true } },
        { 'lineup.away.0': { $exists: true } }
      ]
    })
    .sort({ _id: -1 })
    .limit(5)
    .lean();

    console.log(`\n🔍 Found ${matches.length} matches with lineup data:`);

    for (const match of matches) {
      console.log(`\n📋 Match ID: ${match.match_id}`);
      console.log(`   Teams: ${match.teams?.home?.team_name} vs ${match.teams?.away?.team_name}`);
      
      // Check home lineup formation data
      if (match.lineup?.home?.length > 0) {
        console.log(`\n🏠 Home Team Lineup (${match.lineup.home.length} players):`);
        match.lineup.home.slice(0, 3).forEach((player, i) => {
          console.log(`   ${i + 1}. ${player.player_name}`);
          console.log(`      - formation_position: ${player.formation_position}`);
          console.log(`      - formation_field: ${player.formation_field}`);
          console.log(`      - position_id: ${player.position_id}`);
          console.log(`      - jersey_number: ${player.jersey_number}`);
          console.log('');
        });
        
        // Check if any players have formation data
        const withFormationPos = match.lineup.home.filter(p => p.formation_position != null);
        const withFormationField = match.lineup.home.filter(p => p.formation_field != null);
        console.log(`   📊 Formation data summary:`);
        console.log(`      - Players with formation_position: ${withFormationPos.length}/${match.lineup.home.length}`);
        console.log(`      - Players with formation_field: ${withFormationField.length}/${match.lineup.home.length}`);
        
        if (withFormationField.length > 0) {
          console.log(`   📍 Formation field examples: ${withFormationField.slice(0, 5).map(p => p.formation_field).join(', ')}`);
        }
      }
      
      // Check away lineup formation data  
      if (match.lineup?.away?.length > 0) {
        console.log(`\n✈️  Away Team Lineup (${match.lineup.away.length} players):`);
        match.lineup.away.slice(0, 3).forEach((player, i) => {
          console.log(`   ${i + 1}. ${player.player_name}`);
          console.log(`      - formation_position: ${player.formation_position}`);
          console.log(`      - formation_field: ${player.formation_field}`);
          console.log(`      - position_id: ${player.position_id}`);
          console.log('');
        });
        
        // Check if any players have formation data
        const withFormationPos = match.lineup.away.filter(p => p.formation_position != null);
        const withFormationField = match.lineup.away.filter(p => p.formation_field != null);
        console.log(`   📊 Formation data summary:`);
        console.log(`      - Players with formation_position: ${withFormationPos.length}/${match.lineup.away.length}`);
        console.log(`      - Players with formation_field: ${withFormationField.length}/${match.lineup.away.length}`);
        
        if (withFormationField.length > 0) {
          console.log(`   📍 Formation field examples: ${withFormationField.slice(0, 5).map(p => p.formation_field).join(', ')}`);
        }
      }
      
      console.log('\n' + '='.repeat(80));
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from database');
  }
}

debugFormationData().catch(console.error);