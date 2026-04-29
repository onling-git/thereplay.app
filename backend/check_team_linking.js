// Check if team_id fields are populated in standings
require('dotenv').config();
const mongoose = require('mongoose');
const Standing = require('./models/Standing');
const Team = require('./models/Team');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB\n');

    // Get Premier League standings
    const standing = await Standing.findOne({ league_id: 8 }).lean();
    
    console.log('📊 Premier League Standings - Team Linking Status:\n');
    
    let linked = 0;
    let notLinked = 0;
    
    for (const entry of standing.table.slice(0, 10)) {
      const team = entry.team_id ? await Team.findById(entry.team_id).lean() : null;
      
      if (team) {
        console.log(`✅ Position ${entry.position}: ${team.name} (participant_id: ${entry.participant_id}, team_id: ${entry.team_id})`);
        linked++;
      } else {
        console.log(`❌ Position ${entry.position}: Participant #${entry.participant_id} - NOT LINKED (team_id: ${entry.team_id})`);
        notLinked++;
      }
    }
    
    console.log(`\n📈 Summary: ${linked} linked, ${notLinked} not linked`);
    
  } catch (error) {
    console.error('❌ ERROR:', error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
