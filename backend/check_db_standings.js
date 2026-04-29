const mongoose = require('mongoose');
require('dotenv').config();
const Standing = require('./models/Standing');

async function checkDatabaseStandings() {
  try {
    const uri = process.env.DBURI || process.env.MONGODB_URI || process.env.DATABASE_URL;
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    const leagueId = 9; // Championship
    
    const standing = await Standing.findOne({ league_id: leagueId })
      .sort({ season_id: -1 })
      .lean();
    
    if (!standing) {
      console.log('❌ No standings found');
      return;
    }

    console.log('\n=== Standings Info ===');
    console.log('League:', standing.league_name);
    console.log('Season:', standing.season_name);
    console.log('Teams:', standing.table.length);
    
    // Find Southampton and Coventry
    const southampton = standing.table.find(t => 
      t.team_name?.toLowerCase().includes('southampton') ||
      t.participant_id === 18 // Common Southampton ID
    );
    
    const coventry = standing.table.find(t => 
      t.team_name?.toLowerCase().includes('coventry')
    );
    
    console.log('\n=== Southampton Data ===');
    if (southampton) {
      console.log(JSON.stringify(southampton, null, 2));
    } else {
      console.log('Not found - showing all teams:');
      standing.table.forEach(t => {
        console.log(`  ${t.position}. ${t.team_name || 'Unknown'} (ID: ${t.participant_id})`);
      });
    }
    
    console.log('\n=== Coventry Data ===');
    if (coventry) {
      console.log(JSON.stringify(coventry, null, 2));
    } else {
      console.log('Not found');
    }
    
    // Show a few sample entries
    console.log('\n=== Sample Entries ===');
    standing.table.slice(0, 3).forEach(team => {
      console.log(`\n${team.position}. ${team.team_name}:`);
      console.log(`  Played: ${team.played}, Won: ${team.won}, Drawn: ${team.drawn}, Lost: ${team.lost}`);
      console.log(`  GF: ${team.goals_for}, GA: ${team.goals_against}, GD: ${team.goal_difference}`);
      console.log(`  Points: ${team.points}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkDatabaseStandings();
