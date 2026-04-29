// Check Team collection to see team_id field
require('dotenv').config();
const mongoose = require('mongoose');
const Team = require('./models/Team');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB\n');

    // Get a few teams to see the structure
    const teams = await Team.find({}).limit(5).lean();
    
    console.log('📋 Sample teams in database:\n');
    teams.forEach(team => {
      console.log('Team:', team.name);
      console.log('  _id:', team._id);
      console.log('  team_id:', team.team_id);
      console.log('  slug:', team.slug);
      console.log('');
    });
    
    console.log('\n🔍 Checking for Premier League teams in standings...\n');
    
    // Check if we have the teams from standings
    const plTeamIds = [19, 9, 14, 15, 8, 18, 236, 13, 11, 78];
    
    for (const teamId of plTeamIds) {
      const team = await Team.findOne({ team_id: teamId }).lean();
      if (team) {
        console.log(`✅ Found: ${team.name} (team_id: ${teamId})`);
      } else {
        console.log(`❌ Missing: Sportmonks team_id ${teamId}`);
      }
    }
    
    console.log('\n📊 Total teams in database:', await Team.countDocuments());
    
  } catch (error) {
    console.error('❌ ERROR:', error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
